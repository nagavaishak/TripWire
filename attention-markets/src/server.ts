import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './database/connection';
import attentionRoutes from './routes/attention.routes';
import narrativesRoutes from './routes/narratives.routes';
import topicsRoutes from './routes/topics.routes';
import { AttentionScheduler } from './scheduler';
import { SwitchboardOracle } from './oracle/switchboard';
import { getActiveTopics } from './topics/manager';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const oracle = new SwitchboardOracle();

app.use(cors());
app.use(express.json());

app.use('/api', attentionRoutes);
app.use('/api', narrativesRoutes);
app.use('/api', topicsRoutes);

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
            usage: `await PullFeed.fetchUpdateIx({ feedHash: "${f.feedHash}", ... })`,
        })),
    });
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/oracle/health', async (_req, res) => {
    try {
        const topics = await getActiveTopics();

        const checks = await Promise.all(topics.map(async topic => {
            const result = await db.query(`
                SELECT doa_score, computed_at, tai_score
                FROM attention_scores
                WHERE topic = $1
                ORDER BY computed_at DESC
                LIMIT 1
            `, [topic]);

            if (result.rows.length === 0) {
                return { topic, status: 'no_data', ageSeconds: null, value: null, tai_score: null };
            }

            const { doa_score, computed_at, tai_score } = result.rows[0];
            const ageSeconds = Math.round((Date.now() - new Date(computed_at).getTime()) / 1000);
            const status = ageSeconds < 600 ? 'ok' : 'stale';

            return {
                topic, status, ageSeconds,
                value: parseFloat(doa_score),
                tai_score: tai_score ? parseFloat(tai_score) : null,
            };
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
    console.log(`\n Attention Markets API running on port ${PORT}`);
    console.log(`   Health:     http://localhost:${PORT}/health`);
    console.log(`   Oracle:     http://localhost:${PORT}/api/oracle/feeds`);
    console.log(`   Topics:     http://localhost:${PORT}/api/topics`);
    console.log(`   Narratives: http://localhost:${PORT}/api/narratives`);
    console.log(`   All:        http://localhost:${PORT}/api/attention\n`);

    const scheduler = new AttentionScheduler(oracle);
    scheduler.start();
});

process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await db.end();
    process.exit(0);
});
