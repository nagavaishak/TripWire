/**
 * monitor-feeds.ts
 * 48-hour reliability test for the Switchboard oracle.
 * Polls every 5 minutes, logs uptime and accuracy.
 * Target: >90% uptime over 48 hours.
 *
 * Usage: ts-node scripts/monitor-feeds.ts
 * Stop:  Ctrl+C (prints final report)
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.API_URL || 'https://attention-markets-api.onrender.com';
const POLL_INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const LOG_FILE = path.join(__dirname, '..', 'oracle-monitor.log');

interface PollResult {
    ts: string;
    topic: string;
    value: number | null;
    ageSeconds: number | null;
    status: 'ok' | 'stale' | 'error';
    error?: string;
}

interface Stats {
    total: number;
    ok: number;
    stale: number;
    errors: number;
}

const stats: Record<string, Stats> = {};
const startTime = Date.now();

function log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

async function poll(topic: string): Promise<PollResult> {
    try {
        const res = await axios.get(
            `${API_BASE}/api/attention/${encodeURIComponent(topic)}`,
            { timeout: 10_000 }
        );
        const value = res.data.value as number;
        const ageSeconds = Math.round(Date.now() / 1000 - res.data.timestamp);
        const status = ageSeconds < 600 ? 'ok' : 'stale';
        return { ts: new Date().toISOString(), topic, value, ageSeconds, status };
    } catch (err: any) {
        return { ts: new Date().toISOString(), topic, value: null, ageSeconds: null, status: 'error', error: err.message };
    }
}

function updateStats(topic: string, status: 'ok' | 'stale' | 'error') {
    if (!stats[topic]) stats[topic] = { total: 0, ok: 0, stale: 0, errors: 0 };
    stats[topic].total++;
    stats[topic][status]++;
}

function printReport() {
    const elapsed = ((Date.now() - startTime) / 3600000).toFixed(1);
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║          Oracle Reliability Report        ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`  Runtime: ${elapsed} hours\n`);

    for (const [topic, s] of Object.entries(stats)) {
        const uptime = s.total > 0 ? ((s.ok / s.total) * 100).toFixed(1) : '0.0';
        const target = parseFloat(uptime) >= 90 ? '✅' : '❌';
        console.log(`  ${target} ${topic.padEnd(10)} Uptime: ${uptime}% | OK: ${s.ok} | Stale: ${s.stale} | Errors: ${s.errors} / ${s.total} polls`);
    }
    console.log(`\n  Log saved to: ${LOG_FILE}\n`);
}

async function runCycle() {
    const topics = (process.env.ATTENTION_TOPICS || 'Solana,AI').split(',').map(t => t.trim());
    const results = await Promise.all(topics.map(poll));

    for (const r of results) {
        updateStats(r.topic, r.status);
        const icon = r.status === 'ok' ? '✅' : r.status === 'stale' ? '⚠️ ' : '❌';
        log(`${icon} ${r.topic.padEnd(10)} DoA=${r.value?.toFixed(4) ?? 'N/A'} age=${r.ageSeconds ?? '?'}s status=${r.status}${r.error ? ' err=' + r.error : ''}`);
    }
}

async function main() {
    log('=== Oracle monitor started ===');
    log(`  API: ${API_BASE}`);
    log(`  Poll interval: ${POLL_INTERVAL_MS / 60000} minutes`);
    log(`  Target uptime: >90% over 48 hours`);
    log('');

    process.on('SIGINT', () => {
        log('=== Monitor stopped ===');
        printReport();
        process.exit(0);
    });

    // Run immediately, then on interval
    await runCycle();
    setInterval(runCycle, POLL_INTERVAL_MS);

    // Print interim report every hour
    setInterval(() => {
        printReport();
    }, 60 * 60 * 1000);
}

main();
