import { Router, Request, Response } from 'express';
import { db } from '../database/connection';

const router = Router();

/**
 * GET /api/narratives
 * Returns top rising narratives across all topics (last 24h).
 */
router.get('/narratives', async (_req: Request, res: Response) => {
    try {
        const result = await db.query(`
            SELECT keyword, source, growth, detected_at
            FROM narratives
            WHERE detected_at > NOW() - INTERVAL '24 hours'
            ORDER BY growth DESC
            LIMIT 20
        `);

        return res.json({
            narratives: result.rows,
            generated_at: new Date().toISOString(),
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'Internal error' });
    }
});

/**
 * GET /api/narratives/:topic
 * Returns rising narratives for a specific base topic.
 */
router.get('/narratives/:topic', async (req: Request, res: Response) => {
    const { topic } = req.params;

    try {
        const result = await db.query(`
            SELECT keyword, growth, detected_at
            FROM narratives
            WHERE source = $1
              AND detected_at > NOW() - INTERVAL '24 hours'
            ORDER BY growth DESC
            LIMIT 10
        `, [topic]);

        return res.json({ topic, narratives: result.rows });
    } catch (err: any) {
        return res.status(500).json({ error: 'Internal error' });
    }
});

export default router;
