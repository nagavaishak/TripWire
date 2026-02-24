/**
 * Test: Full attention index computation with all 3 free sources
 * Run: npx ts-node tests/test-full-index.ts
 *
 * Requires: DATABASE_URL env var (PostgreSQL)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { AttentionIndexComputer } from '../src/index/computer';

const TOPICS = (process.env.ATTENTION_TOPICS || 'Solana,AI').split(',').map(t => t.trim());

async function main() {
    console.log('=== Full Attention Index Test ===');
    console.log(`Topics: ${TOPICS.join(', ')}`);
    console.log(`Sources: YouTube + Google Trends + Farcaster\n`);

    const computer = new AttentionIndexComputer();
    const results: Record<string, number> = {};

    for (const topic of TOPICS) {
        try {
            const doa = await computer.compute(topic);
            results[topic] = doa;

            // Assertions
            if (doa < 0 || doa > 100) {
                throw new Error(`DoA out of range: ${doa} (expected 0-100)`);
            }
            console.log(`✓ ${topic}: DoA = ${doa.toFixed(2)}`);
        } catch (err) {
            console.error(`✗ ${topic}: ${err}`);
            process.exit(1);
        }
    }

    console.log('\n=== Summary ===');
    for (const [topic, doa] of Object.entries(results)) {
        const bar = '█'.repeat(Math.round(doa / 5));
        console.log(`  ${topic.padEnd(10)} ${doa.toFixed(1).padStart(5)} │${bar}`);
    }

    console.log('\n✓ Full index test passed\n');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
