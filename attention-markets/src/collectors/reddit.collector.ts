// Reddit collector — stub until credentials are configured
// Replace this file with the full snoowrap implementation when Reddit is enabled

export class RedditCollector {
    constructor() {
        throw new Error('Reddit credentials not configured. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env');
    }

    async collect(_topic: string): Promise<never> {
        throw new Error('Reddit collector not available');
    }
}
