// @ts-ignore — no types for google-trends-api
import googleTrends from 'google-trends-api';
import { db } from '../database/connection';

/**
 * Detect rising narratives using Google Trends relatedQueries.
 * "Rising" queries have the highest % increase in search volume — breakout detection.
 *
 * Called from the scheduler after each compute cycle (fire-and-forget, never blocks).
 */
export async function detectNarratives(baseTopic: string): Promise<void> {
    try {
        const raw = await googleTrends.relatedQueries({ keyword: baseTopic });
        const data = JSON.parse(raw);
        const rankedList: any[] = data?.default?.rankedList || [];

        // rankedList[0] = top queries, rankedList[1] = rising queries
        const rising: any[] = rankedList[1]?.rankedKeyword || [];

        if (rising.length === 0) {
            console.log(`[Narratives] No rising queries for ${baseTopic}`);
            return;
        }

        let inserted = 0;
        for (const item of rising.slice(0, 10)) {
            const keyword = item.query?.toLowerCase()?.trim();
            if (!keyword || keyword === baseTopic.toLowerCase()) continue;

            // Google Trends returns "Breakout" string for extremely new queries (near-zero → significant)
            const growth = item.value === 'Breakout' ? 50000 : (Number(item.value) || 0);

            await db.query(
                `INSERT INTO narratives (keyword, source, growth) VALUES ($1, $2, $3)`,
                [keyword, baseTopic, growth]
            );
            inserted++;
        }

        console.log(`[Narratives] ${baseTopic}: ${inserted} rising narratives stored`);
    } catch (err: any) {
        // Never block the main compute pipeline
        console.error(`[Narratives] Detection failed for ${baseTopic}:`, err.message);
    }
}
