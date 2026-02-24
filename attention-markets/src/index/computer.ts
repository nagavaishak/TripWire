import { TwitterCollector } from '../collectors/twitter.collector';
import { RedditCollector } from '../collectors/reddit.collector';
import { YouTubeCollector } from '../collectors/youtube.collector';
import { TrendsCollector } from '../collectors/trends.collector';
import { FarcasterCollector } from '../collectors/farcaster.collector';
import { TimeDecay } from '../utils/time-decay';
import { db } from '../database/connection';

const hasReddit  = () => !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
const hasTwitter = () => !!process.env.TWITTER_BEARER_TOKEN;

interface ScoreComponents {
    twitter_ei: number;
    reddit_ei: number;
    youtube_ei: number;
    twitter_raw: number;
    reddit_raw: number;
    youtube_raw: number;
    trends_norm: number;
    farcaster_norm: number;
    trends_score: number;
    farcaster_score: number;
    computation_time_ms: number;
}

export class AttentionIndexComputer {
    private twitterCollector:   TwitterCollector | null;
    private redditCollector:    RedditCollector | null;
    private youtubeCollector:   YouTubeCollector;
    private trendsCollector:    TrendsCollector;
    private farcasterCollector: FarcasterCollector;

    constructor() {
        this.twitterCollector   = hasTwitter() ? new TwitterCollector() : null;
        this.redditCollector    = hasReddit()  ? new RedditCollector()  : null;
        this.youtubeCollector   = new YouTubeCollector();
        this.trendsCollector    = new TrendsCollector();
        this.farcasterCollector = new FarcasterCollector();

        const active = ['YouTube', 'Google Trends', 'Farcaster'];
        if (hasTwitter()) active.unshift('Twitter');
        if (hasReddit())  active.push('Reddit');
        console.log(`[AttentionIndex] Active sources: ${active.join(', ')}`);
    }

    async compute(topic: string): Promise<number> {
        const startTime = Date.now();
        console.log(`\n[AttentionIndex] Computing for ${topic}...`);

        try {
            // Collect from all available platforms in parallel
            const [twitter, reddit, youtube, trends, farcaster] = await Promise.all([
                this.twitterCollector ? this.twitterCollector.collect(topic) : Promise.resolve(null),
                this.redditCollector  ? this.redditCollector.collect(topic)  : Promise.resolve(null),
                this.youtubeCollector.collect(topic).catch(() => null),
                this.trendsCollector.collect(topic).catch(() => null),
                this.farcasterCollector.collect(topic).catch(() => null),
            ]);

            // Store raw data
            const stores: Promise<void>[] = [];
            if (youtube)  stores.push(this.storeRawData(topic, 'youtube', youtube));
            if (trends)   stores.push(this.storeRawData(topic, 'trends', trends));
            if (farcaster) stores.push(this.storeRawData(topic, 'farcaster', farcaster));
            if (twitter)  stores.push(this.storeRawData(topic, 'twitter', twitter));
            if (reddit)   stores.push(this.storeRawData(topic, 'reddit',  reddit));
            await Promise.all(stores);

            // Compute platform-specific scores
            const HALF_LIFE = Number(process.env.ATTENTION_HALF_LIFE_MINUTES) || 90;

            // Apply time-decay to Twitter if available
            const decayed_twitter = twitter
                ? TimeDecay.weightTwitterMetrics(twitter.tweets, HALF_LIFE)
                : null;

            const twitter_score   = decayed_twitter ? this.computeTwitterScore(decayed_twitter) : 0;
            const reddit_score    = reddit     ? this.computeRedditScore(reddit)     : 0;
            const youtube_score   = youtube    ? this.computeYouTubeScore(youtube)   : 0;
            const farcaster_score = farcaster  ? this.computeFarcasterScore(farcaster) : 0;

            // Apply time-decay to Google Trends (has hourly timestamps)
            const trends_score = trends && trends.interest_over_time.length > 0
                ? TimeDecay.weightedAverage(
                    trends.interest_over_time.map(p => ({ timestamp: p.time, value: p.value })),
                    HALF_LIFE
                  )
                : (trends ? trends.current_interest : 0);

            if (hasTwitter()) console.log(`  Twitter raw:       ${twitter_score.toFixed(2)}`);
            if (hasReddit())  console.log(`  Reddit raw:        ${reddit_score.toFixed(2)}`);
            console.log(`  YouTube raw:       ${youtube_score.toFixed(2)}`);
            console.log(`  Google Trends:     ${trends_score.toFixed(2)} / 100`);
            console.log(`  Farcaster raw:     ${farcaster_score.toFixed(2)}`);

            // Normalize to 0-1
            const twitter_norm   = this.normalize(twitter_score,   0, 50000);
            const reddit_norm    = this.normalize(reddit_score,     0, 10000);
            const youtube_norm   = this.normalize(youtube_score,    0, 200000);
            const trends_norm    = trends_score / 100;   // Google is 0-100
            const farcaster_norm = this.normalize(farcaster_score,  0, 5000);

            // Weighted aggregation based on available sources
            const ytAvail = !!youtube;
            let EI = 0;
            if (hasTwitter() && hasReddit()) {
                EI = twitter_norm * 0.30 + reddit_norm * 0.15 + trends_norm * 0.25 + youtube_norm * 0.15 + farcaster_norm * 0.15;
            } else if (hasTwitter()) {
                EI = twitter_norm * 0.35 + trends_norm * 0.30 + youtube_norm * 0.20 + farcaster_norm * 0.15;
            } else if (hasReddit()) {
                EI = reddit_norm * 0.25 + trends_norm * 0.30 + youtube_norm * 0.25 + farcaster_norm * 0.20;
            } else if (ytAvail) {
                // Free MVP: Trends 35% + YouTube 30% + Farcaster 35%
                EI = trends_norm * 0.35 + youtube_norm * 0.30 + farcaster_norm * 0.35;
            } else {
                // YouTube unavailable: split its 30% between Trends and Farcaster
                console.warn(`  [AttentionIndex] YouTube unavailable — using Trends 50% + Farcaster 50%`);
                EI = trends_norm * 0.50 + farcaster_norm * 0.50;
            }

            const DoA = EI * 100;

            await this.storeScore(topic, DoA, {
                twitter_ei: twitter_norm,
                reddit_ei:  reddit_norm,
                youtube_ei: youtube_norm,
                twitter_raw: twitter_score,
                reddit_raw:  reddit_score,
                youtube_raw: youtube_score,
                trends_norm,
                farcaster_norm,
                trends_score,
                farcaster_score,
                computation_time_ms: Date.now() - startTime,
            });

            console.log(`  → DoA: ${DoA.toFixed(2)} (${Date.now() - startTime}ms)\n`);

            return DoA;

        } catch (error) {
            console.error(`[AttentionIndex] Error computing ${topic}:`, error);
            throw error;
        }
    }

    private computeTwitterScore(metrics: {
        retweets: number; quotes: number; replies: number;
        likes: number; bookmarks: number; impressions: number;
    }): number {
        return (
            metrics.retweets    * 3.0 +
            metrics.quotes      * 2.5 +
            metrics.replies     * 1.5 +
            metrics.likes       * 1.0 +
            metrics.bookmarks   * 2.0 +
            metrics.impressions * 0.001
        );
    }

    private computeRedditScore(metrics: any): number {
        return (
            metrics.level.total_score    * 2.0 +
            metrics.level.total_comments * 3.0 +
            metrics.level.posts_count    * 10.0 +
            metrics.momentum.total_score    * 3.0 +
            metrics.momentum.total_comments * 3.0 +
            metrics.momentum.posts_count    * 10.0 +
            metrics.velocity.total_score * 4.0 +
            metrics.velocity.max_speed   * 50.0 +
            metrics.velocity.posts_count * 10.0
        );
    }

    private computeYouTubeScore(metrics: {
        total_views: number;
        avg_view_weighted_likes: number;
        avg_view_weighted_comments: number;
    }): number {
        return (
            metrics.total_views                * 0.01 +
            metrics.avg_view_weighted_likes    * 1000 +
            metrics.avg_view_weighted_comments * 2000
        );
    }

    private computeFarcasterScore(metrics: {
        total_reactions: number;
        total_replies: number;
        total_recasts: number;
        total_quotes: number;
        cast_count: number;
    }): number {
        return (
            metrics.total_reactions * 2.0 +
            metrics.total_recasts   * 3.0 +
            metrics.total_replies   * 1.5 +
            metrics.total_quotes    * 2.5 +
            metrics.cast_count      * 5.0
        );
    }

    private normalize(value: number, min: number, max: number): number {
        return Math.max(0, Math.min(1, (value - min) / Math.max(max - min, 1)));
    }

    private async storeRawData(topic: string, platform: string, metrics: any): Promise<void> {
        await db.query(
            `INSERT INTO attention_raw_data (topic, platform, metrics) VALUES ($1, $2, $3)`,
            [topic, platform, JSON.stringify(metrics)]
        );
    }

    private async storeScore(topic: string, doa: number, components: ScoreComponents): Promise<void> {
        await db.query(`
            INSERT INTO attention_scores (
                topic, doa_score,
                twitter_ei, reddit_ei, youtube_ei,
                twitter_raw_score, reddit_raw_score, youtube_raw_score,
                google_trends_ei, farcaster_ei,
                google_trends_raw_score, farcaster_raw_score,
                computation_time_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
            topic, doa,
            components.twitter_ei, components.reddit_ei, components.youtube_ei,
            components.twitter_raw, components.reddit_raw, components.youtube_raw,
            components.trends_norm, components.farcaster_norm,
            components.trends_score, components.farcaster_score,
            components.computation_time_ms,
        ]);
    }
}
