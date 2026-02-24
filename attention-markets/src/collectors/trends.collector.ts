// @ts-ignore — no types for google-trends-api
import googleTrends from 'google-trends-api';

export interface TrendsMetrics {
    topic: string;
    collected_at: Date;
    interest: number;       // 0-100 (Google's scale)
    avg_7d: number;         // average over last 7 days
    peak_7d: number;        // peak value over last 7 days
    data_points: number;
}

export class TrendsCollector {
    async collect(topic: string): Promise<TrendsMetrics> {
        console.log(`[Trends] Collecting data for: ${topic}`);

        try {
            const raw = await googleTrends.interestOverTime({
                keyword: topic,
                startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            });

            const parsed = JSON.parse(raw);
            const points: Array<{ value: number[] }> = parsed?.default?.timelineData || [];

            if (points.length === 0) {
                console.warn(`[Trends] No data for ${topic}`);
                return this.emptyMetrics(topic);
            }

            const values = points.map(p => p.value[0] as number);
            const interest = values[values.length - 1];
            const avg_7d = values.reduce((s, v) => s + v, 0) / values.length;
            const peak_7d = Math.max(...values);

            console.log(`[Trends] ${topic}: interest=${interest}, avg=${avg_7d.toFixed(1)}, peak=${peak_7d}`);

            return {
                topic,
                collected_at: new Date(),
                interest,
                avg_7d,
                peak_7d,
                data_points: values.length,
            };
        } catch (err: any) {
            console.error(`[Trends] Error collecting ${topic}:`, err.message);
            throw err;
        }
    }

    private emptyMetrics(topic: string): TrendsMetrics {
        return {
            topic,
            collected_at: new Date(),
            interest: 0,
            avg_7d: 0,
            peak_7d: 0,
            data_points: 0,
        };
    }
}
