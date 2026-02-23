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
