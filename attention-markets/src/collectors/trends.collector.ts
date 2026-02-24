// @ts-ignore — no types for google-trends-api
import googleTrends from 'google-trends-api';

export interface TrendsDataPoint {
    time: Date;
    value: number;
}

export interface TrendsMetrics {
    topic: string;
    collected_at: Date;
    interest_over_time: TrendsDataPoint[];  // hourly, last 24h
    avg_interest: number;
    current_interest: number;
    peak_interest_24h: number;
    trend_direction: 'rising' | 'falling' | 'stable';
}

export class TrendsCollector {
    async collect(topic: string): Promise<TrendsMetrics> {
        console.log(`[GoogleTrends] Collecting data for: ${topic}`);

        try {
            const raw = await googleTrends.interestOverTime({
                keyword: topic,
                startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
                endTime: new Date(),
                granularTimeResolution: true,  // hourly data
            });

            const parsed = JSON.parse(raw);
            const timeline: any[] = parsed?.default?.timelineData || [];

            if (timeline.length === 0) {
                console.warn(`[GoogleTrends] No data for ${topic}`);
                return this.emptyMetrics(topic);
            }

            const interest_over_time: TrendsDataPoint[] = timeline.map(p => ({
                time: new Date(Number(p.time) * 1000),
                value: p.value?.[0] || 0,
            }));

            const values = interest_over_time.map(p => p.value).filter(v => v > 0);
            const current_interest = values[values.length - 1] || 0;
            const prev_interest    = values[values.length - 2] || current_interest;
            const avg_interest     = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
            const peak_interest_24h = Math.max(...values, 0);

            let trend_direction: 'rising' | 'falling' | 'stable' = 'stable';
            if (current_interest > prev_interest * 1.1) trend_direction = 'rising';
            else if (current_interest < prev_interest * 0.9) trend_direction = 'falling';

            console.log(`[GoogleTrends] ${topic}: current=${current_interest}, avg=${avg_interest.toFixed(1)}, trend=${trend_direction}`);

            return { topic, collected_at: new Date(), interest_over_time, avg_interest, current_interest, peak_interest_24h, trend_direction };

        } catch (err: any) {
            console.error(`[GoogleTrends] Error collecting ${topic}:`, err.message);
            return this.emptyMetrics(topic);  // graceful fallback
        }
    }

    private emptyMetrics(topic: string): TrendsMetrics {
        return {
            topic, collected_at: new Date(),
            interest_over_time: [], avg_interest: 0,
            current_interest: 0, peak_interest_24h: 0,
            trend_direction: 'stable',
        };
    }
}
