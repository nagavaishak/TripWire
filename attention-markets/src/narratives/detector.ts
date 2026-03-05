// @ts-ignore — no types for google-trends-api
import googleTrends from 'google-trends-api';
import { db } from '../database/connection';

function narrativeStatus(growth: number): string {
    return growth >= 50_000 ? 'trending' : 'emerging';
}

async function upsertNarrative(keyword: string, source: string, growth: number): Promise<void> {
    const status = narrativeStatus(growth);
    await db.query(
        `INSERT INTO narratives (keyword, source, growth, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (keyword, source) DO UPDATE
           SET growth      = GREATEST(narratives.growth, EXCLUDED.growth),
               detected_at = NOW(),
               status      = EXCLUDED.status`,
        [keyword, source, growth, status]
    );
}

/**
 * Detect rising narratives using Google Trends relatedQueries for a specific topic.
 * Called after each compute cycle per active topic.
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

            // Google Trends returns "Breakout" for extremely new queries
            const growth = item.value === 'Breakout' ? 50_000 : (Number(item.value) || 0);
            await upsertNarrative(keyword, baseTopic, growth);
            inserted++;
        }

        console.log(`[Narratives] ${baseTopic}: ${inserted} rising narratives stored`);
    } catch (err: any) {
        console.error(`[Narratives] Detection failed for ${baseTopic}:`, err.message);
    }
}

/**
 * Detect global breakout topics via Google Trends dailyTrends (US).
 * Catches events like "Iran war" that are unrelated to configured topics.
 * Called once per scheduler cycle.
 */
export async function detectGlobalNarratives(): Promise<void> {
    try {
        const raw = await googleTrends.dailyTrends({ geo: 'US' });
        const data = JSON.parse(raw);
        const days: any[] = data?.default?.trendingSearchesDays || [];
        const searches: any[] = days[0]?.trendingSearches || [];

        if (searches.length === 0) {
            console.log('[Narratives] Global: no daily trends found');
            return;
        }

        let inserted = 0;
        for (const item of searches.slice(0, 20)) {
            const keyword = item.title?.query?.toLowerCase()?.trim();
            if (!keyword) continue;

            // Parse traffic: "200K+" → 200000, "2M+" → 2000000
            const traffic: string = item.formattedTraffic || '0';
            const multiplier = traffic.includes('M') ? 1_000_000 : traffic.includes('K') ? 1_000 : 1;
            const num = parseFloat(traffic.replace(/[^0-9.]/g, '')) || 0;
            const growth = Math.round(num * multiplier);

            await upsertNarrative(keyword, '_global', growth);
            inserted++;
        }

        console.log(`[Narratives] Global: ${inserted} trending topics stored`);
    } catch (err: any) {
        console.error('[Narratives] Global detection failed:', err.message);
    }
}

/**
 * Age out narratives that haven't been refreshed:
 *   emerging/trending → fading after 2 h
 *   fading → dead after 6 h
 */
export async function updateNarrativeLifecycle(): Promise<void> {
    try {
        await db.query(`
            UPDATE narratives SET status = 'fading'
            WHERE status IN ('emerging', 'trending')
              AND detected_at < NOW() - INTERVAL '2 hours'
        `);
        await db.query(`
            UPDATE narratives SET status = 'dead'
            WHERE status = 'fading'
              AND detected_at < NOW() - INTERVAL '6 hours'
        `);
    } catch (err: any) {
        console.error('[Narratives] Lifecycle update failed:', err.message);
    }
}
