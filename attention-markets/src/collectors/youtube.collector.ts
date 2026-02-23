import { google, youtube_v3 } from 'googleapis';

interface YouTubeMetrics {
    topic: string;
    collected_at: Date;

    // Raw totals
    video_count: number;
    total_views: number;
    total_likes: number;
    total_comments: number;

    // View-weighted (prevents spam - Trendle model)
    avg_view_weighted_likes: number;
    avg_view_weighted_comments: number;
}

export class YouTubeCollector {
    private youtube: youtube_v3.Youtube;

    constructor() {
        if (!process.env.YOUTUBE_API_KEY) {
            throw new Error('YOUTUBE_API_KEY not set');
        }

        this.youtube = google.youtube({
            version: 'v3',
            auth: process.env.YOUTUBE_API_KEY
        });
    }

    async collect(topic: string): Promise<YouTubeMetrics> {
        console.log(`[YouTube] Collecting data for: ${topic}`);

        try {
            // Search for videos (last 7 days)
            const searchResponse = await this.youtube.search.list({
                part: ['id'],
                q: topic,
                type: ['video'],
                maxResults: 50,
                order: 'relevance',
                publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            });

            if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
                console.warn(`[YouTube] No videos found for ${topic}`);
                return this.emptyMetrics(topic);
            }

            const videoIds = searchResponse.data.items
                .map(item => item.id?.videoId)
                .filter((id): id is string => !!id);

            // Get detailed statistics
            const videosResponse = await this.youtube.videos.list({
                part: ['statistics'],
                id: videoIds
            });

            const videos = videosResponse.data.items || [];

            const total_views = videos.reduce((sum, v) =>
                sum + Number(v.statistics?.viewCount || 0), 0);

            const total_likes = videos.reduce((sum, v) =>
                sum + Number(v.statistics?.likeCount || 0), 0);

            const total_comments = videos.reduce((sum, v) =>
                sum + Number(v.statistics?.commentCount || 0), 0);

            // View-weighted metrics (manipulation-resistant)
            const view_weighted_likes_ratios = videos.map(v => {
                const views = Number(v.statistics?.viewCount || 0);
                const likes = Number(v.statistics?.likeCount || 0);
                return views > 0 ? likes / views : 0;
            });

            const view_weighted_comments_ratios = videos.map(v => {
                const views = Number(v.statistics?.viewCount || 0);
                const comments = Number(v.statistics?.commentCount || 0);
                return views > 0 ? comments / views : 0;
            });

            const avg_view_weighted_likes = view_weighted_likes_ratios.length > 0 ?
                view_weighted_likes_ratios.reduce((sum, r) => sum + r, 0) / view_weighted_likes_ratios.length : 0;

            const avg_view_weighted_comments = view_weighted_comments_ratios.length > 0 ?
                view_weighted_comments_ratios.reduce((sum, r) => sum + r, 0) / view_weighted_comments_ratios.length : 0;

            console.log(`[YouTube] ${topic}: ${videos.length} videos, ${total_views} views`);

            return {
                topic,
                collected_at: new Date(),
                video_count: videos.length,
                total_views,
                total_likes,
                total_comments,
                avg_view_weighted_likes,
                avg_view_weighted_comments
            };

        } catch (error) {
            console.error(`[YouTube] Error collecting ${topic}:`, error);
            throw error;
        }
    }

    private emptyMetrics(topic: string): YouTubeMetrics {
        return {
            topic,
            collected_at: new Date(),
            video_count: 0,
            total_views: 0,
            total_likes: 0,
            total_comments: 0,
            avg_view_weighted_likes: 0,
            avg_view_weighted_comments: 0
        };
    }
}
