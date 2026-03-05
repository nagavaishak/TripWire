import { db } from '../database/connection';

export interface Topic {
    id:     number;
    name:   string;
    slug:   string;
    status: 'active' | 'inactive';
}

export async function getActiveTopics(): Promise<string[]> {
    try {
        const result = await db.query(
            `SELECT name FROM topics WHERE status = 'active' ORDER BY id`
        );
        if (result.rows.length > 0) {
            return result.rows.map((r: any) => r.name);
        }
    } catch {
        // topics table doesn't exist yet — fall back to env var
    }
    return (process.env.ATTENTION_TOPICS || 'Solana,AI').split(',').map(t => t.trim());
}

const CURATED_TOPICS = ['Solana', 'AI', 'Bitcoin', 'Ethereum', 'Memecoins'];

export async function cleanupNoiseTopics(): Promise<void> {
    try {
        const result = await db.query(
            `DELETE FROM topics WHERE name NOT IN (${CURATED_TOPICS.map((_, i) => `$${i + 1}`).join(',')})`,
            CURATED_TOPICS
        );
        if (result.rowCount && result.rowCount > 0) {
            console.log(`[Topics] Cleaned up ${result.rowCount} noise topics`);
        }
    } catch (err: any) {
        console.error('[Topics] Cleanup failed:', err.message);
    }
}

export async function getAllTopics(): Promise<Topic[]> {
    const result = await db.query(
        `SELECT id, name, slug, status FROM topics ORDER BY id`
    );
    return result.rows;
}

/**
 * Auto-promote global narratives to tracked topics when they hit breakout level.
 * Threshold: growth >= 50,000 (Breakout tier) and seen in the last 2 hours.
 * Caps at MAX_AUTO_TOPICS active topics to avoid runaway growth.
 */
const MAX_AUTO_TOPICS = 10;

export async function promoteNarrativesToTopics(): Promise<void> {
    try {
        // How many active topics do we already have?
        const countRes = await db.query(
            `SELECT COUNT(*) AS c FROM topics WHERE status = 'active'`
        );
        const activeCount = parseInt(countRes.rows[0].c, 10);
        if (activeCount >= MAX_AUTO_TOPICS) return;

        const slots = MAX_AUTO_TOPICS - activeCount;

        // Only promote from _global (dailyTrends) — per-topic related queries
        // are sub-phrases of existing topics and create noise cards.
        const candidates = await db.query(`
            SELECT keyword, MAX(growth) AS growth
            FROM narratives
            WHERE source     = '_global'
              AND growth     >= 50000
              AND status     = 'trending'
              AND detected_at > NOW() - INTERVAL '2 hours'
              AND LOWER(keyword) NOT IN (SELECT LOWER(name) FROM topics)
            GROUP BY keyword
            ORDER BY growth DESC
            LIMIT $1
        `, [slots]);

        for (const row of candidates.rows) {
            const name = row.keyword
                .split(' ')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
            const slug = row.keyword.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            await db.query(`
                INSERT INTO topics (name, slug, status)
                VALUES ($1, $2, 'active')
                ON CONFLICT (name) DO UPDATE SET status = 'active'
            `, [name, slug]);

            console.log(`[Topics] Auto-promoted: "${name}" (breakout narrative)`);
        }
    } catch (err: any) {
        console.error('[Topics] Promotion failed:', err.message);
    }
}
