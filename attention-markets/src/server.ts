import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './database/connection';
import attentionRoutes from './routes/attention.routes';
import { AttentionScheduler } from './scheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', attentionRoutes);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    const topics = (process.env.ATTENTION_TOPICS || 'Solana,AI').split(',').map(t => t.trim());

    console.log(`\n🚀 Attention Markets API running on port ${PORT}`);
    console.log(`   Health:  http://localhost:${PORT}/health`);
    topics.forEach(t => {
        console.log(`   ${t.padEnd(8)} http://localhost:${PORT}/api/attention/${encodeURIComponent(t)}`);
    });
    console.log(`   All:     http://localhost:${PORT}/api/attention\n`);

    const scheduler = new AttentionScheduler();
    scheduler.start();
});

process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await db.end();
    process.exit(0);
});
