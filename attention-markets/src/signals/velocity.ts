import { db } from '../database/connection';

export interface VelocityResult {
    raw: number;
    score: number; // [0,1] — 0.5 = neutral, >0.5 = accelerating, <0.5 = decelerating
}

/**
 * Compute engagement velocity from Farcaster.
 * Compares total engagement between the last two collection cycles.
 *
 * engagement = reactions + replies + recasts + quotes
 * velocity   = (engagement_now - engagement_prev) / engagement_prev
 * Clamped to [-1, 1], normalized to [0, 1].
 *
 * NOTE: We use engagement metrics, NOT cast_count (capped at 100 by the API).
 */
export async function computeVelocity(topic: string): Promise<VelocityResult> {
    try {
        const result = await db.query(`
            SELECT
                COALESCE((metrics->>'total_reactions')::float, 0)
                + COALESCE((metrics->>'total_replies')::float,   0)
                + COALESCE((metrics->>'total_recasts')::float,   0)
                + COALESCE((metrics->>'total_quotes')::float,    0) AS engagement,
                collected_at
            FROM attention_raw_data
            WHERE topic = $1 AND platform = 'farcaster'
            ORDER BY collected_at DESC
            LIMIT 2
        `, [topic]);

        if (result.rows.length < 2) return { raw: 0, score: 0.5 };

        const current = parseFloat(result.rows[0].engagement || '0');
        const prev    = parseFloat(result.rows[1].engagement || '0');

        if (prev <= 0) return { raw: 0, score: 0.5 };

        const raw     = (current - prev) / prev;
        const clamped = Math.max(-1, Math.min(1, raw));
        const score   = (clamped + 1) / 2;

        return { raw, score };
    } catch {
        return { raw: 0, score: 0.5 };
    }
}
