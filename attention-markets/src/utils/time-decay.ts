/**
 * Exponential Time-Decay Weighting
 *
 * Formula: weight(Δ) = e^(-ln(2) × Δ / half_life)
 *
 * Example with 90-minute half-life:
 * - Content from  5 min ago: 97% weight
 * - Content from 90 min ago: 50% weight
 * - Content from 180 min ago: 25% weight
 */

interface TimestampedValue {
    timestamp: Date;
    value: number;
}

export class TimeDecay {
    static weightedAverage(
        values: TimestampedValue[],
        half_life_minutes: number
    ): number {
        if (values.length === 0) return 0;

        const now = Date.now();
        const LN2 = Math.LN2;

        let weighted_sum = 0;
        let total_weight = 0;

        for (const item of values) {
            const age_minutes = (now - item.timestamp.getTime()) / 60000;
            const weight = Math.exp(-LN2 * age_minutes / half_life_minutes);

            weighted_sum += item.value * weight;
            total_weight += weight;
        }

        return total_weight > 0 ? weighted_sum / total_weight : 0;
    }

    static weightTwitterMetrics(
        tweets: Array<{
            timestamp: Date;
            retweet_count: number;
            quote_count: number;
            reply_count: number;
            like_count: number;
            impression_count: number;
            bookmark_count: number;
        }>,
        half_life_minutes: number
    ): {
        retweets: number;
        quotes: number;
        replies: number;
        likes: number;
        impressions: number;
        bookmarks: number;
    } {
        if (tweets.length === 0) {
            return { retweets: 0, quotes: 0, replies: 0, likes: 0, impressions: 0, bookmarks: 0 };
        }

        const now = Date.now();
        const LN2 = Math.LN2;

        let weighted_retweets = 0;
        let weighted_quotes = 0;
        let weighted_replies = 0;
        let weighted_likes = 0;
        let weighted_impressions = 0;
        let weighted_bookmarks = 0;
        let total_weight = 0;

        for (const tweet of tweets) {
            const ts = tweet.timestamp.getTime();
            if (isNaN(ts)) continue;  // skip tweets with invalid timestamps
            const age_minutes = Math.max(0, (now - ts) / 60000);
            const weight = Math.exp(-LN2 * age_minutes / half_life_minutes);

            weighted_retweets += tweet.retweet_count * weight;
            weighted_quotes += tweet.quote_count * weight;
            weighted_replies += tweet.reply_count * weight;
            weighted_likes += tweet.like_count * weight;
            weighted_impressions += tweet.impression_count * weight;
            weighted_bookmarks += tweet.bookmark_count * weight;
            total_weight += weight;
        }

        if (total_weight === 0) {
            return { retweets: 0, quotes: 0, replies: 0, likes: 0, impressions: 0, bookmarks: 0 };
        }

        return {
            retweets: weighted_retweets / total_weight,
            quotes: weighted_quotes / total_weight,
            replies: weighted_replies / total_weight,
            likes: weighted_likes / total_weight,
            impressions: weighted_impressions / total_weight,
            bookmarks: weighted_bookmarks / total_weight
        };
    }
}
