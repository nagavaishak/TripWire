import { db } from '../database/connection';

export interface MomentumResult {
    raw: number;
    score: number; // [0,1] — 0.5 = neutral, >0.5 = rising, <0.5 = falling
}

/**
 * Compute attention momentum.
 * Compares current EI (level) against the EI ~30 minutes ago.
 *
 * momentum = (EI_now - EI_past) / EI_past
 * Clamped to [-1, 1], normalized to [0, 1].
 */
export async function computeMomentum(topic: string, currentLevel: number): Promise<MomentumResult> {
    try {
        const result = await db.query(`
            SELECT COALESCE(tai_level, doa_score / 100.0) AS level_score
            FROM attention_scores
            WHERE topic = $1
              AND computed_at BETWEEN NOW() - INTERVAL '35 minutes'
                                  AND NOW() - INTERVAL '25 minutes'
            ORDER BY computed_at DESC
            LIMIT 1
        `, [topic]);

        if (result.rows.length === 0) {
            return { raw: 0, score: 0.5 }; // neutral — no history yet
        }

        const prevLevel = parseFloat(result.rows[0].level_score);
        if (prevLevel <= 0) return { raw: 0, score: 0.5 };

        const raw = (currentLevel - prevLevel) / prevLevel;
        const clamped = Math.max(-1, Math.min(1, raw));
        const score = (clamped + 1) / 2;

        return { raw, score };
    } catch {
        return { raw: 0, score: 0.5 };
    }
}
