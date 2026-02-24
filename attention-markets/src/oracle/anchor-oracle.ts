/**
 * Anchor Program Oracle
 *
 * Calls update_doa() on the deployed Attention Markets Anchor program
 * every time the scheduler computes a new DoA score.
 *
 * Program ID: 35mr61jToyKGyynBgFtQJ8RnEEx3aoSVa3ofyK7rAgzb (Solana devnet)
 *
 * Env vars:
 *   SOLANA_PRIVATE_KEY  — base58 or JSON array; if absent, on-chain push is skipped
 *   SOLANA_RPC_URL      — defaults to https://api.devnet.solana.com
 *   ANCHOR_PROGRAM_ID   — override program ID
 *   ANCHOR_MARKET_FUNDING_LAMPORTS — initial vault funding per market (default 0.1 SOL)
 */

import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PROGRAM_ID = new PublicKey(
    process.env.ANCHOR_PROGRAM_ID || '35mr61jToyKGyynBgFtQJ8RnEEx3aoSVa3ofyK7rAgzb'
);
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const MARKET_FUNDING = parseInt(
    process.env.ANCHOR_MARKET_FUNDING_LAMPORTS || '100000000' // 0.1 SOL
);

function loadKeypair(): Keypair | null {
    const pk = process.env.SOLANA_PRIVATE_KEY;
    if (pk) {
        try {
            return pk.startsWith('[')
                ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(pk)))
                : Keypair.fromSecretKey(Buffer.from(pk, 'base64'));
        } catch (err: any) {
            console.error('[AnchorOracle] Failed to parse SOLANA_PRIVATE_KEY:', err.message);
            return null;
        }
    }
    // Fallback: local keypair file
    const keyPath = path.join(os.homedir(), '.config', 'solana', 'oracle-keypair.json');
    if (fs.existsSync(keyPath)) {
        try {
            return Keypair.fromSecretKey(
                Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, 'utf-8')))
            );
        } catch {
            return null;
        }
    }
    return null;
}

export class AnchorOracle {
    private program: anchor.Program | null = null;
    private wallet: anchor.Wallet | null = null;
    private enabled: boolean = false;

    constructor() {
        this.init();
    }

    private init() {
        const keypair = loadKeypair();
        if (!keypair) {
            console.log('[AnchorOracle] No keypair found — on-chain update_doa disabled');
            return;
        }

        try {
            const connection = new Connection(RPC_URL, 'confirmed');
            this.wallet = new anchor.Wallet(keypair);
            const provider = new anchor.AnchorProvider(connection, this.wallet, {
                commitment: 'confirmed',
                preflightCommitment: 'confirmed',
            });
            anchor.setProvider(provider);

            const idlPath = path.join(__dirname, 'attention_markets_program.json');
            const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
            this.program = new anchor.Program(idl, provider);
            this.enabled = true;

            console.log(`[AnchorOracle] Initialized | wallet: ${keypair.publicKey.toBase58()}`);
            console.log(`[AnchorOracle] Program: ${PROGRAM_ID.toBase58()} | RPC: ${RPC_URL}`);
        } catch (err: any) {
            console.error('[AnchorOracle] Init failed:', err.message);
        }
    }

    /** Derive the market PDA for a topic */
    private marketPda(topic: string): PublicKey {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('market'), Buffer.from(topic)],
            PROGRAM_ID
        );
        return pda;
    }

    /** Derive the vault PDA for a market */
    private vaultPda(marketKey: PublicKey): PublicKey {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault'), marketKey.toBuffer()],
            PROGRAM_ID
        );
        return pda;
    }

    /** Check if a market account exists on-chain */
    private async marketExists(marketPda: PublicKey): Promise<boolean> {
        if (!this.program) return false;
        try {
            const info = await this.program.provider.connection.getAccountInfo(marketPda);
            return info !== null;
        } catch {
            return false;
        }
    }

    /**
     * Ensure a market exists for the topic. If not, create it.
     * Safe to call every cycle — idempotent after first call.
     */
    private async ensureMarket(topic: string): Promise<void> {
        if (!this.program || !this.wallet) return;

        const marketKey = this.marketPda(topic);
        if (await this.marketExists(marketKey)) return;

        console.log(`[AnchorOracle] Creating market for ${topic}...`);
        try {
            const vaultKey = this.vaultPda(marketKey);
            const tx = await this.program.methods
                .createMarket(topic, new anchor.BN(MARKET_FUNDING))
                .accounts({
                    market: marketKey,
                    vault: vaultKey,
                    oracle: this.wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();
            console.log(`[AnchorOracle] Market created for ${topic} → ${tx.slice(0, 16)}...`);
        } catch (err: any) {
            console.error(`[AnchorOracle] create_market failed for ${topic}:`, err.message);
        }
    }

    /**
     * Push a DoA score on-chain for a single topic.
     * Converts the float score (0–100) to basis points (0–10_000).
     */
    async pushScore(topic: string, doa: number): Promise<void> {
        if (!this.enabled || !this.program || !this.wallet) return;

        await this.ensureMarket(topic);

        const scoreBps = Math.round(Math.min(100, Math.max(0, doa)) * 100);
        const marketKey = this.marketPda(topic);

        try {
            const tx = await this.program.methods
                .updateDoa(scoreBps)
                .accounts({
                    market: marketKey,
                    oracle: this.wallet.publicKey,
                })
                .rpc();
            console.log(
                `[AnchorOracle] update_doa: ${topic} = ${scoreBps}bps (${doa.toFixed(2)}/100) → ${tx.slice(0, 16)}...`
            );
        } catch (err: any) {
            console.error(`[AnchorOracle] update_doa failed for ${topic}:`, err.message);
        }
    }

    /**
     * Push all scores. Called by the scheduler after each compute cycle.
     */
    async pushAll(scores: Record<string, number>): Promise<void> {
        if (!this.enabled) return;

        await Promise.allSettled(
            Object.entries(scores).map(([topic, doa]) => this.pushScore(topic, doa))
        );
    }

    isEnabled(): boolean {
        return this.enabled;
    }
}
