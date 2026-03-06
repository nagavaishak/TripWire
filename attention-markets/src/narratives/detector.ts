// @ts-ignore — no types for google-trends-api
import googleTrends from 'google-trends-api';
import axios from 'axios';
import * as cheerio from 'cheerio';
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

// Pages to skip — Wikipedia meta/utility pages
const WIKI_SKIP = new Set([
    'main page', 'special:', 'wikipedia:', 'portal:', 'help:', 'file:',
    'deaths in', 'list of', 'template:', 'category:',
]);

function shouldSkip(title: string): boolean {
    const lower = title.toLowerCase();
    return WIKI_SKIP.has(lower) || [...WIKI_SKIP].some(s => lower.startsWith(s));
}

/**
 * Detect global trending topics via Wikipedia Most-Read API.
 * Returns the top-viewed Wikipedia articles for today — a reliable signal
 * for what the world is actually paying attention to (Iran, Trump, etc.)
 * No API key needed, works from any IP.
 */
export async function detectGlobalNarratives(): Promise<void> {
    try {
        // Use yesterday's date (today's full data isn't available until ~midnight UTC)
        const d = new Date(Date.now() - 86_400_000);
        const yyyy = d.getUTCFullYear();
        const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd   = String(d.getUTCDate()).padStart(2, '0');

        const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${yyyy}/${mm}/${dd}`;
        const res = await axios.get(url, {
            timeout: 15_000,
            headers: { 'User-Agent': 'TripWireAttentionOracle/1.0 (https://tripwire-oracle.app; contact@tripwire.app)' },
        });

        const articles: any[] = res.data?.items?.[0]?.articles ?? [];
        if (articles.length === 0) {
            console.log('[Narratives] Wikipedia: no trending articles found');
            return;
        }

        let inserted = 0;
        for (const article of articles.slice(0, 50)) {
            const raw   = (article.article as string).replace(/_/g, ' ').trim();
            const keyword = raw.toLowerCase();
            if (shouldSkip(keyword)) continue;

            // views = actual Wikipedia pageviews; use as growth signal
            const growth = article.views as number;

            await upsertNarrative(keyword, '_global', growth);
            inserted++;
        }

        console.log(`[Narratives] Wikipedia: ${inserted} trending topics stored`);
    } catch (err: any) {
        console.error('[Narratives] Wikipedia trending failed:', err.message);
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
