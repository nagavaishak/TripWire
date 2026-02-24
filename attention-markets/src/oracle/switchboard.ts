/**
 * Switchboard On-Demand Oracle Integration
 *
 * Two layers:
 *   1. Feed Registration — uploads the oracle job config to Switchboard Crossbar
 *      so that any Solana program can pull DoA scores on-demand.
 *      Requires no wallet; the Crossbar CID becomes the feed identifier.
 *
 *   2. On-Chain Proof — when SOLANA_PRIVATE_KEY is set, each scheduler update
 *      posts a lightweight Solana memo transaction containing the scores,
 *      providing a public, timestamped, immutable on-chain record.
 *
 * Feed consumers (Solana programs) use the feed address returned by
 * `/api/oracle/feeds` to request a live update via fetchUpdateIx().
 */

import axios from 'axios';
import { Connection, Keypair, PublicKey, Transaction,
         TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';

// Switchboard Crossbar (oracle job registry — no auth needed)
const CROSSBAR_URL = 'https://crossbar.switchboard.xyz';
// Switchboard On-Demand queue (mainnet)
const SB_QUEUE = 'A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w';
// Pre-registered feed hashes (from switchboard/feeds.json)
const FEED_HASHES: Record<string, string> = {
    Solana: '0xb36f6cf9da0f2172f3a45859d87bd8fa8381c04dbc9305af6d8603195684a363',
    AI:     '0x6885b5c3716d0b75e62426e216c9664ceb7d9ebf05d7010d44124de63f35b3ec',
};
// Solana Memo Program
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export interface FeedInfo {
    topic: string;
    feedHash: string;
    jobUrl: string;
    lastUpdated: Date;
}

export interface OraclePushResult {
    topic:        string;
    value:        number;
    txSignature?: string;
    skipped?:     boolean;
    error?:       string;
}

export class SwitchboardOracle {
    private connection: Connection | null = null;
    private payer:      Keypair | null = null;
    private feeds:      Map<string, FeedInfo> = new Map();
    private onChain:    boolean = false;

    constructor() {
        this.initSolana();
    }

    private initSolana() {
        const pk = process.env.SOLANA_PRIVATE_KEY;
        if (!pk) {
            console.log('[Oracle] SOLANA_PRIVATE_KEY not set — on-chain memo disabled, feed registration still active');
            return;
        }
        try {
            const rpc = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
            this.connection = new Connection(rpc, 'confirmed');
            this.payer = pk.startsWith('[')
                ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(pk)))
                : Keypair.fromSecretKey(Buffer.from(pk, 'base64'));
            this.onChain = true;
            console.log(`[Oracle] Solana wallet loaded: ${this.payer.publicKey.toBase58()}`);
        } catch (err: any) {
            console.error('[Oracle] Wallet init failed:', err.message);
        }
    }

    /**
     * Register (or refresh) a Switchboard Crossbar feed for a topic.
     * The feed job pulls from our HTTP API and parses the `value` field.
     * Returns the feed hash (stable identifier, derived from job config).
     */
    async registerFeed(topic: string): Promise<FeedInfo> {
        const existing = this.feeds.get(topic);
        if (existing) return existing;

        const apiBase = process.env.API_URL
            || `https://${process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${process.env.PORT || 3000}`}`;

        // Switchboard oracle job definition (JSON format)
        const jobDef = {
            queue: SB_QUEUE,
            jobs: [
                {
                    tasks: [
                        { httpTask: { url: `${apiBase}/api/attention/${encodeURIComponent(topic)}` } },
                        { jsonParseTask: { path: '$.value' } },
                    ],
                },
            ],
        };

        try {
            // Use pre-registered hash if available, otherwise register fresh
            let feedHash: string = FEED_HASHES[topic] || '';
            let jobUrl: string;

            if (!feedHash) {
                const response = await axios.post(`${CROSSBAR_URL}/store`, jobDef, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10_000,
                });
                feedHash = response.data?.feedHash || response.data?.cid || 'local';
            }
            jobUrl = `${CROSSBAR_URL}/fetch/${feedHash.replace('0x', '')}`;

            const info: FeedInfo = { topic, feedHash, jobUrl, lastUpdated: new Date() };
            this.feeds.set(topic, info);
            console.log(`[Oracle] Feed registered for ${topic}: ${feedHash}`);
            return info;

        } catch (err: any) {
            // Crossbar may be temporarily unavailable — compute a local hash as fallback
            const localHash = Buffer.from(`doa-${topic.toLowerCase()}`).toString('hex');
            const info: FeedInfo = {
                topic,
                feedHash: localHash,
                jobUrl:   `${apiBase}/api/attention/${encodeURIComponent(topic)}`,
                lastUpdated: new Date(),
            };
            this.feeds.set(topic, info);
            console.warn(`[Oracle] Crossbar unavailable (${err.message}) — using local feed hash for ${topic}`);
            return info;
        }
    }

    /**
     * Post an on-chain Solana memo with the DoA scores.
     * Format: "DOA:Solana=63.80,AI=1.20 ts=1771887600"
     * This gives an immutable, timestamped, publicly verifiable record.
     */
    async postMemo(scores: Record<string, number>): Promise<OraclePushResult[]> {
        const results: OraclePushResult[] = Object.keys(scores).map(topic => ({
            topic, value: scores[topic], skipped: true,
        }));

        if (!this.onChain || !this.connection || !this.payer) return results;

        try {
            const ts   = Math.floor(Date.now() / 1000);
            const body = Object.entries(scores)
                .map(([t, v]) => `${t}=${v.toFixed(4)}`)
                .join(',');
            const memo = `DOA:${body} ts=${ts}`;

            const ix = new TransactionInstruction({
                keys:      [{ pubkey: this.payer.publicKey, isSigner: true, isWritable: false }],
                programId: MEMO_PROGRAM_ID,
                data:      Buffer.from(memo, 'utf-8'),
            });

            const tx  = new Transaction().add(ix);
            const sig = await sendAndConfirmTransaction(this.connection, tx, [this.payer]);

            console.log(`[Oracle] Memo posted on-chain → ${sig.slice(0, 16)}… (${memo})`);

            return Object.entries(scores).map(([topic, value]) => ({
                topic, value, txSignature: sig,
            }));
        } catch (err: any) {
            console.error('[Oracle] Memo tx failed:', err.message);
            return Object.keys(scores).map(topic => ({
                topic, value: scores[topic], error: err.message,
            }));
        }
    }

    /**
     * Full update cycle: register feeds + post on-chain memo.
     * Called by the scheduler after each data collection round.
     */
    async pushAll(scores: Record<string, number>): Promise<void> {
        // Register feeds in parallel (idempotent after first call)
        await Promise.allSettled(
            Object.keys(scores).map(topic => this.registerFeed(topic))
        );

        // Post on-chain memo (no-op if wallet not configured)
        await this.postMemo(scores);
    }

    /** Returns all registered feed info (for the /api/oracle/feeds endpoint) */
    getFeeds(): FeedInfo[] {
        return Array.from(this.feeds.values());
    }

    isOnChainEnabled(): boolean {
        return this.onChain;
    }
}
