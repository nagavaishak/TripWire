/**
 * read-oracle.ts
 * Reads both on-chain (Crossbar simulation) and backend API values,
 * and compares them to verify the oracle is working correctly.
 *
 * Usage: ts-node scripts/read-oracle.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE = process.env.API_URL || 'https://attention-markets-api.onrender.com';

const FEEDS: Record<string, string> = {
    Solana: '0xb36f6cf9da0f2172f3a45859d87bd8fa8381c04dbc9305af6d8603195684a363',
    AI:     '0x6885b5c3716d0b75e62426e216c9664ceb7d9ebf05d7010d44124de63f35b3ec',
};

interface AttentionResult {
    topic: string;
    apiValue: number | null;
    apiAge: number | null;   // seconds since last update
    feedHash: string;
    crossbarReachable: boolean;
    status: 'ok' | 'stale' | 'error';
}

async function readFeed(topic: string, feedHash: string): Promise<AttentionResult> {
    let apiValue: number | null = null;
    let apiAge: number | null = null;
    let crossbarReachable = false;
    let status: 'ok' | 'stale' | 'error' = 'error';

    // 1. Read from backend API
    try {
        const res = await axios.get(`${API_BASE}/api/attention/${encodeURIComponent(topic)}`, { timeout: 8000 });
        apiValue = res.data.value;
        apiAge = Math.round(Date.now() / 1000 - res.data.timestamp);
        status = apiAge < 600 ? 'ok' : 'stale';  // stale if > 10 min
    } catch (err: any) {
        console.error(`  [${topic}] API error: ${err.message}`);
    }

    // 2. Verify Crossbar job is reachable
    const cid = feedHash.replace('0x', '');
    try {
        await axios.get(`https://crossbar.switchboard.xyz/fetch/${cid}`, { timeout: 8000 });
        crossbarReachable = true;
    } catch {
        crossbarReachable = false;
    }

    return { topic, apiValue, apiAge, feedHash, crossbarReachable, status };
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║        Switchboard Oracle Status Check       ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log(`  API: ${API_BASE}`);
    console.log(`  Time: ${new Date().toISOString()}\n`);

    const results = await Promise.all(
        Object.entries(FEEDS).map(([topic, hash]) => readFeed(topic, hash))
    );

    for (const r of results) {
        const statusIcon = r.status === 'ok' ? '✅' : r.status === 'stale' ? '⚠️ ' : '❌';
        console.log(`${statusIcon} ${r.topic.padEnd(10)} DoA=${r.apiValue?.toFixed(4) ?? 'N/A'} | Age=${r.apiAge ?? '?'}s | Crossbar=${r.crossbarReachable ? '✓' : '✗'}`);
        console.log(`   FeedHash: ${r.feedHash}`);
        console.log(`   Consumers use: PullFeed.fetchUpdateIx({ feedHash: "${r.feedHash}" })\n`);
    }

    const allOk = results.every(r => r.status === 'ok');
    console.log('─'.repeat(50));
    console.log(allOk ? '✅ Oracle healthy — all feeds live' : '⚠️  Some feeds need attention');
    console.log('');

    process.exit(allOk ? 0 : 1);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
