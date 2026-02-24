/**
 * Test: Google Trends + Farcaster collectors
 * Run: npx ts-node tests/test-new-collectors.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { TrendsCollector } from '../src/collectors/trends.collector';
import { FarcasterCollector } from '../src/collectors/farcaster.collector';

async function testTrends() {
    console.log('\n=== Google Trends Collector ===');
    const collector = new TrendsCollector();

    for (const topic of ['Solana', 'AI']) {
        const metrics = await collector.collect(topic);
        console.log(`\n[${topic}]`);
        console.log(`  current_interest:   ${metrics.current_interest}`);
        console.log(`  avg_interest:       ${metrics.avg_interest.toFixed(1)}`);
        console.log(`  peak_interest_24h:  ${metrics.peak_interest_24h}`);
        console.log(`  trend_direction:    ${metrics.trend_direction}`);
        console.log(`  hourly_datapoints:  ${metrics.interest_over_time.length}`);

        if (metrics.current_interest === 0) {
            console.warn(`  WARNING: Zero interest for ${topic} — check Google Trends`);
        }
        if (metrics.interest_over_time.length < 20) {
            console.warn(`  WARNING: Only ${metrics.interest_over_time.length} hourly points (expected ~24)`);
        }
    }
}

async function testFarcaster() {
    console.log('\n=== Farcaster Collector ===');
    const collector = new FarcasterCollector();

    for (const topic of ['Solana', 'AI']) {
        const metrics = await collector.collect(topic);
        console.log(`\n[${topic}]`);
        console.log(`  cast_count:       ${metrics.cast_count}`);
        console.log(`  total_reactions:  ${metrics.total_reactions}`);
        console.log(`  total_replies:    ${metrics.total_replies}`);
        console.log(`  total_recasts:    ${metrics.total_recasts}`);
        console.log(`  total_quotes:     ${metrics.total_quotes}`);

        if (metrics.cast_count === 0) {
            console.warn(`  WARNING: Zero casts for ${topic} — check Warpcast API`);
        }
    }
}

async function main() {
    try {
        await testTrends();
        await testFarcaster();
        console.log('\n✓ All collector tests passed\n');
    } catch (err) {
        console.error('\n✗ Collector test failed:', err);
        process.exit(1);
    }
}

main();
