import axios from 'axios';

export interface FarcasterMetrics {
    topic: string;
    collected_at: Date;
    cast_count: number;
    total_reactions: number;
    total_replies: number;
    total_recasts: number;
    total_views: number;
    total_quotes: number;
    avg_engagement_rate: number;
}

export class FarcasterCollector {
    private readonly BASE = 'https://api.warpcast.com/v2';

    async collect(topic: string): Promise<FarcasterMetrics> {
        console.log(`[Farcaster] Collecting data for: ${topic}`);

        try {
            const res = await axios.get(`${this.BASE}/search-casts`, {
                params: { q: topic, limit: 100 },
                timeout: 10_000,
            });

            const casts: any[] = res.data?.result?.casts || [];

            if (casts.length === 0) {
                console.warn(`[Farcaster] No casts found for ${topic}`);
                return this.emptyMetrics(topic);
            }

            const total_reactions = casts.reduce((s, c) => s + (c.reactions?.count || 0), 0);
            const total_replies   = casts.reduce((s, c) => s + (c.replies?.count || 0), 0);
            const total_recasts   = casts.reduce((s, c) => s + (c.combinedRecastCount || 0), 0);
            const total_views     = casts.reduce((s, c) => s + (c.viewCount || 0), 0);
            const total_quotes    = casts.reduce((s, c) => s + (c.quoteCount || 0), 0);

            const avg_engagement_rate = total_views > 0
                ? (total_reactions + total_replies + total_recasts) / total_views
                : 0;

            console.log(`[Farcaster] ${topic}: ${casts.length} casts, ${total_reactions} reactions, ${total_recasts} recasts`);

            return {
                topic,
                collected_at: new Date(),
                cast_count: casts.length,
                total_reactions,
                total_replies,
                total_recasts,
                total_views,
                total_quotes,
                avg_engagement_rate,
            };
        } catch (err: any) {
            console.error(`[Farcaster] Error collecting ${topic}:`, err.message);
            throw err;
        }
    }

    private emptyMetrics(topic: string): FarcasterMetrics {
        return {
            topic,
            collected_at: new Date(),
            cast_count: 0,
            total_reactions: 0,
            total_replies: 0,
            total_recasts: 0,
            total_views: 0,
            total_quotes: 0,
            avg_engagement_rate: 0,
        };
    }
}
