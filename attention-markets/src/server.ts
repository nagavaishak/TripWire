import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './database/connection';
import attentionRoutes from './routes/attention.routes';
import { AttentionScheduler } from './scheduler';
import { SwitchboardOracle } from './oracle/switchboard';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Oracle instance — shared between scheduler and /api/oracle/feeds endpoint
const oracle = new SwitchboardOracle();

app.use(cors());
app.use(express.json());

app.use('/api', attentionRoutes);

// Oracle feed registry endpoint
app.get('/api/oracle/feeds', (_req, res) => {
    const feeds = oracle.getFeeds();
    res.json({
        onChainEnabled: oracle.isOnChainEnabled(),
        feeds: feeds.map(f => ({
            topic:     f.topic,
            feedHash:  f.feedHash,
            jobUrl:    f.jobUrl,
            lastUpdated: f.lastUpdated,
            // Instructions for Solana programs to consume this feed:
            usage: `await PullFeed.fetchUpdateIx({ feedHash: "${f.feedHash}", ... })`,
        })),
    });
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Oracle health — checks feed freshness and on-chain status
app.get('/api/oracle/health', async (_req, res) => {
    try {
        const topics = (process.env.ATTENTION_TOPICS || 'Solana,AI').split(',').map(t => t.trim());

        const checks = await Promise.all(topics.map(async topic => {
            const result = await db.query(`
                SELECT doa_score, computed_at
                FROM attention_scores
                WHERE topic = $1
                ORDER BY computed_at DESC
                LIMIT 1
            `, [topic]);

            if (result.rows.length === 0) {
                return { topic, status: 'no_data', ageSeconds: null, value: null };
            }

            const { doa_score, computed_at } = result.rows[0];
            const ageSeconds = Math.round((Date.now() - new Date(computed_at).getTime()) / 1000);
            const status = ageSeconds < 600 ? 'ok' : 'stale';

            return { topic, status, ageSeconds, value: parseFloat(doa_score) };
        }));

        const allOk = checks.every(c => c.status === 'ok');
        res.status(allOk ? 200 : 503).json({
            status: allOk ? 'healthy' : 'degraded',
            onChainEnabled: oracle.isOnChainEnabled(),
            walletPubkey: process.env.SOLANA_PRIVATE_KEY ? 'DL9xjSMy36gthoGvDv6iyWwshwiFwYTeJTp6oZ3jDqC3' : null,
            feeds: checks,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(PORT, () => {
    const topics = (process.env.ATTENTION_TOPICS || 'Solana,AI').split(',').map(t => t.trim());

    console.log(`\n🚀 Attention Markets API running on port ${PORT}`);
    console.log(`   Health:   http://localhost:${PORT}/health`);
    console.log(`   Oracle:   http://localhost:${PORT}/api/oracle/feeds`);
    topics.forEach(t => {
        console.log(`   ${t.padEnd(8)}  http://localhost:${PORT}/api/attention/${encodeURIComponent(t)}`);
    });
    console.log(`   All:      http://localhost:${PORT}/api/attention\n`);

    const scheduler = new AttentionScheduler(oracle);
    scheduler.start();
});

process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await db.end();
    process.exit(0);
});
