import cron from 'node-cron';
import { AttentionIndexComputer } from './index/computer';
import { SwitchboardOracle } from './oracle/switchboard';
import { AnchorOracle } from './oracle/anchor-oracle';
import { getActiveTopics, promoteNarrativesToTopics } from './topics/manager';
import { detectNarratives, detectGlobalNarratives, updateNarrativeLifecycle } from './narratives/detector';

export class AttentionScheduler {
    private computer: AttentionIndexComputer;
    private oracle: SwitchboardOracle;
    private anchorOracle: AnchorOracle;
    private interval: string;

    constructor(oracle: SwitchboardOracle) {
        this.computer = new AttentionIndexComputer();
        this.oracle = oracle;
        this.anchorOracle = new AnchorOracle();
        this.interval = process.env.ATTENTION_UPDATE_INTERVAL_MINUTES || '5';
    }

    start() {
        console.log('\n╔══════════════════════════════════════╗');
        console.log('║   Attention Index Scheduler Started  ║');
        console.log('╚══════════════════════════════════════╝');
        console.log(`Interval:    Every ${this.interval} minutes`);
        console.log(`Half-life:   ${process.env.ATTENTION_HALF_LIFE_MINUTES || 90} minutes`);
        console.log(`Topics:      DB-driven (topics table)\n`);

        // Run immediately on start
        this.runUpdate();

        // Then on schedule
        cron.schedule(`*/${this.interval} * * * *`, () => {
            this.runUpdate();
        });
    }

    private async runUpdate() {
        const updateStart = new Date();
        console.log(`\n⏰ [${updateStart.toISOString()}] TAI update cycle starting...`);
        console.log('─'.repeat(60));

        // Read active topics from DB each cycle (supports hot-add of topics)
        const topics = await getActiveTopics();
        console.log(`Topics: ${topics.join(', ')}`);

        const scores: Record<string, number> = {};

        for (const topic of topics) {
            try {
                const doa = await this.computer.compute(topic);
                scores[topic] = doa;
                console.log(`✓ ${topic.padEnd(15)} → ${doa.toFixed(2)} DoA (TAI)`);
            } catch (error: any) {
                console.error(`✗ ${topic.padEnd(15)} → FAILED: ${error.message}`);
            }
        }

        if (Object.keys(scores).length > 0) {
            await this.oracle.pushAll(scores);
            await this.anchorOracle.pushAll(scores);
        }

        // Narrative detection + lifecycle + auto-promotion — fire-and-forget
        // Order matters: global detection → promote → per-topic → lifecycle
        detectGlobalNarratives()
            .then(() => promoteNarrativesToTopics())
            .catch((err: any) => console.error('[Narratives] Global/promote failed:', err.message));

        Promise.allSettled([
            ...topics.map(topic => detectNarratives(topic)),
            updateNarrativeLifecycle(),
        ]).then(results => {
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) console.warn(`[Narratives] ${failed} task(s) failed`);
        });

        const duration = Date.now() - updateStart.getTime();
        console.log('─'.repeat(60));
        console.log(`Update complete in ${(duration / 1000).toFixed(1)}s`);
        console.log(`Next update in ${this.interval} minutes\n`);
    }
}
