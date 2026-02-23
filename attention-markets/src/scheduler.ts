import cron from 'node-cron';
import { AttentionIndexComputer } from './index/computer';

export class AttentionScheduler {
    private computer: AttentionIndexComputer;
    private topics: string[];
    private interval: string;

    constructor() {
        this.computer = new AttentionIndexComputer();
        this.topics = (process.env.ATTENTION_TOPICS || 'Solana,AI').split(',').map(t => t.trim());
        this.interval = process.env.ATTENTION_UPDATE_INTERVAL_MINUTES || '5';
    }

    start() {
        console.log('\n╔══════════════════════════════════════╗');
        console.log('║   Attention Index Scheduler Started  ║');
        console.log('╚══════════════════════════════════════╝');
        console.log(`Topics:      ${this.topics.join(', ')}`);
        console.log(`Interval:    Every ${this.interval} minutes`);
        console.log(`Half-life:   ${process.env.ATTENTION_HALF_LIFE_MINUTES || 90} minutes\n`);

        // Run immediately on start
        this.runUpdate();

        // Then on schedule
        cron.schedule(`*/${this.interval} * * * *`, () => {
            this.runUpdate();
        });
    }

    private async runUpdate() {
        const updateStart = new Date();
        console.log(`\n⏰ [${updateStart.toISOString()}] Update cycle starting...`);
        console.log('─'.repeat(60));

        for (const topic of this.topics) {
            try {
                const doa = await this.computer.compute(topic);
                console.log(`✓ ${topic.padEnd(15)} → ${doa.toFixed(2)} DoA`);
            } catch (error: any) {
                console.error(`✗ ${topic.padEnd(15)} → FAILED: ${error.message}`);
            }
        }

        const duration = Date.now() - updateStart.getTime();
        console.log('─'.repeat(60));
        console.log(`Update complete in ${(duration / 1000).toFixed(1)}s`);
        console.log(`Next update in ${this.interval} minutes\n`);
    }
}
