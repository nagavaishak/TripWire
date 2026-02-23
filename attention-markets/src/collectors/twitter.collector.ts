import axios from 'axios';

const BASE_URL = 'https://api.twitter.com/2';

interface TweetMetric {
    timestamp: Date;
    retweet_count: number;
    quote_count: number;
    reply_count: number;
    like_count: number;
    impression_count: number;
    bookmark_count: number;
}

interface TwitterCollectionResult {
    topic: string;
    collected_at: Date;
    tweets: TweetMetric[];
    aggregated: {
        total_tweets: number;
        total_retweets: number;
        total_quotes: number;
        total_replies: number;
        total_likes: number;
        total_impressions: number;
        total_bookmarks: number;
        avg_engagement_rate: number;
    };
}

export class TwitterCollector {
    constructor() {
        if (!process.env.TWITTER_BEARER_TOKEN) {
            throw new Error('TWITTER_BEARER_TOKEN not set in environment');
        }
    }

    async collect(topic: string): Promise<TwitterCollectionResult> {
        console.log(`[Twitter] Collecting data for: ${topic}`);

        const TIME_WINDOW_HOURS = Number(process.env.ATTENTION_TIME_WINDOW_HOURS) || 6;
        const startTime = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

        try {
            // Twitter API v2 recent search — free tier allows up to 10 results per request
            // To get more, paginate with next_token
            const tweets: TweetMetric[] = [];
            let nextToken: string | undefined;
            let pages = 0;
            const MAX_PAGES = 10; // 10 pages × 100 tweets = 1000 tweets max

            do {
                const params: Record<string, string> = {
                    query: `${topic} lang:en -is:retweet`,
                    max_results: '100',
                    start_time: startTime,
                    'tweet.fields': 'created_at,public_metrics',
                };
                if (nextToken) params.next_token = nextToken;

                const response = await axios.get(`${BASE_URL}/tweets/search/recent`, {
                    headers: { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}` },
                    params,
                });

                const data = response.data;

                if (data.data) {
                    for (const tweet of data.data) {
                        const m = tweet.public_metrics || {};
                        tweets.push({
                            timestamp: new Date(tweet.created_at),
                            retweet_count:    m.retweet_count    || 0,
                            quote_count:      m.quote_count      || 0,
                            reply_count:      m.reply_count      || 0,
                            like_count:       m.like_count       || 0,
                            impression_count: m.impression_count || 0,
                            bookmark_count:   m.bookmark_count   || 0,
                        });
                    }
                }

                nextToken = data.meta?.next_token;
                pages++;

            } while (nextToken && pages < MAX_PAGES);

            if (tweets.length === 0) {
                console.warn(`[Twitter] No tweets found for ${topic}`);
                return this.emptyResult(topic);
            }

            const aggregated = {
                total_tweets:      tweets.length,
                total_retweets:    tweets.reduce((s, t) => s + t.retweet_count, 0),
                total_quotes:      tweets.reduce((s, t) => s + t.quote_count, 0),
                total_replies:     tweets.reduce((s, t) => s + t.reply_count, 0),
                total_likes:       tweets.reduce((s, t) => s + t.like_count, 0),
                total_impressions: tweets.reduce((s, t) => s + t.impression_count, 0),
                total_bookmarks:   tweets.reduce((s, t) => s + t.bookmark_count, 0),
                avg_engagement_rate: 0,
            };

            if (aggregated.total_impressions > 0) {
                const engagement = aggregated.total_retweets + aggregated.total_quotes + aggregated.total_replies;
                aggregated.avg_engagement_rate = engagement / aggregated.total_impressions;
            }

            console.log(`[Twitter] ${topic}: ${tweets.length} tweets, ${aggregated.total_likes} likes, ${aggregated.total_retweets} retweets`);

            return { topic, collected_at: new Date(), tweets, aggregated };

        } catch (error: any) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail || error.message;
            console.error(`[Twitter] Error collecting ${topic} (HTTP ${status}): ${detail}`);
            throw error;
        }
    }

    private emptyResult(topic: string): TwitterCollectionResult {
        return {
            topic,
            collected_at: new Date(),
            tweets: [],
            aggregated: {
                total_tweets: 0, total_retweets: 0, total_quotes: 0,
                total_replies: 0, total_likes: 0, total_impressions: 0,
                total_bookmarks: 0, avg_engagement_rate: 0,
            }
        };
    }
}
