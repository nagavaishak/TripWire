import cron from 'node-cron';
import { AttentionIndexComputer } from './index/computer';
import { SwitchboardOracle } from './oracle/switchboard';
import { AnchorOracle } from './oracle/anchor-oracle';

export class AttentionScheduler {
    private computer: AttentionIndexComputer;
    private oracle: SwitchboardOracle;
    private anchorOracle: AnchorOracle;
    private topics: string[];
    private interval: string;

    constructor(oracle: SwitchboardOracle) {
        this.computer = new AttentionIndexComputer();
        this.oracle = oracle;
        this.anchorOracle = new AnchorOracle();
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

        const scores: Record<string, number> = {};

        for (const topic of this.topics) {
            try {
                const doa = await this.computer.compute(topic);
                scores[topic] = doa;
                console.log(`✓ ${topic.padEnd(15)} → ${doa.toFixed(2)} DoA`);
            } catch (error: any) {
                console.error(`✗ ${topic.padEnd(15)} → FAILED: ${error.message}`);
            }
        }

        if (Object.keys(scores).length > 0) {
            // Switchboard memo (existing)
            await this.oracle.pushAll(scores);
            // Anchor program update_doa (Trendle model)
            await this.anchorOracle.pushAll(scores);
        }

        const duration = Date.now() - updateStart.getTime();
        console.log('─'.repeat(60));
        console.log(`Update complete in ${(duration / 1000).toFixed(1)}s`);
        console.log(`Next update in ${this.interval} minutes\n`);
    }
}
