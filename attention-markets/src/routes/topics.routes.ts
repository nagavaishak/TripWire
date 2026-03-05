import { Router, Request, Response } from 'express';
import { getAllTopics } from '../topics/manager';
import { db } from '../database/connection';

const router = Router();

/**
 * GET /api/topics
 * Returns all topics with their latest DoA and TAI scores.
 */
router.get('/topics', async (_req: Request, res: Response) => {
    try {
        const topics = await getAllTopics();

        const topicsWithScores = await Promise.all(
            topics.map(async topic => {
                const result = await db.query(`
                    SELECT doa_score, tai_score, computed_at
                    FROM attention_scores
                    WHERE topic = $1
                    ORDER BY computed_at DESC
                    LIMIT 1
                `, [topic.name]);

                const latest = result.rows[0];
                return {
                    ...topic,
                    doa:          latest ? parseFloat(latest.doa_score) : null,
                    tai_score:    latest?.tai_score ? parseFloat(latest.tai_score) : null,
                    last_updated: latest?.computed_at ?? null,
                };
            })
        );

        return res.json({ topics: topicsWithScores });
    } catch (err: any) {
        return res.status(500).json({ error: 'Internal error' });
    }
});

export default router;
