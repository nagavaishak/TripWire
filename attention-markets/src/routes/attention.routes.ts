import { Router, Request, Response } from 'express';
import { db } from '../database/connection';

const router = Router();

/**
 * GET /api/attention/:topic
 * Returns latest attention score — backward-compatible + new TAI breakdown.
 */
router.get('/attention/:topic', async (req: Request, res: Response) => {
    const { topic } = req.params;

    try {
        const result = await db.query(`
            SELECT doa_score, computed_at,
                   tai_level, tai_momentum, tai_velocity, tai_consensus, tai_score
            FROM attention_scores
            WHERE topic = $1
            ORDER BY computed_at DESC
            LIMIT 1
        `, [topic]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Topic not found',
                available: (process.env.ATTENTION_TOPICS || '').split(',').map(t => t.trim())
            });
        }

        const { doa_score, computed_at, tai_level, tai_momentum, tai_velocity, tai_consensus, tai_score } = result.rows[0];

        // Staleness check (>10 minutes = stale)
        const age_ms = Date.now() - new Date(computed_at).getTime();
        if (age_ms > 10 * 60 * 1000) {
            return res.status(503).json({
                error: 'Data stale',
                age_minutes: (age_ms / 60000).toFixed(1)
            });
        }

        // Build TAI object — null-safe for records pre-migration
        const tai = tai_score != null ? {
            level:     parseFloat(tai_level)     || 0,
            momentum:  parseFloat(tai_momentum)  || 0.5,
            velocity:  parseFloat(tai_velocity)  || 0.5,
            consensus: parseFloat(tai_consensus) || 0,
            score:     parseFloat(tai_score)     || 0,
        } : null;

        return res.json({
            value:     parseFloat(doa_score),
            timestamp: Math.floor(new Date(computed_at).getTime() / 1000),
            topic,
            tai,
            sources: ['youtube', 'google_trends', 'farcaster'],
            weights: { youtube: 0.30, google_trends: 0.35, farcaster: 0.35 },
        });

    } catch (error) {
        console.error('[API] Error:', error);
        return res.status(500).json({ error: 'Internal error' });
    }
});

/**
 * GET /api/attention/:topic/history
 * Returns historical scores for charting — includes TAI components per point.
 */
router.get('/attention/:topic/history', async (req: Request, res: Response) => {
    const { topic } = req.params;
    const hours = parseInt(req.query.hours as string) || 24;

    try {
        const result = await db.query(`
            SELECT doa_score, computed_at,
                   youtube_ei, google_trends_ei, farcaster_ei,
                   tai_level, tai_momentum, tai_velocity, tai_consensus, tai_score
            FROM attention_scores
            WHERE topic = $1
              AND computed_at > NOW() - INTERVAL '${hours} hours'
            ORDER BY computed_at ASC
        `, [topic]);

        return res.json({
            topic,
            hours,
            sources: ['youtube', 'google_trends', 'farcaster'],
            data: result.rows.map(r => ({
                time:  Math.floor(new Date(r.computed_at).getTime() / 1000),
                value: parseFloat(r.doa_score),
                components: {
                    youtube:       parseFloat(r.youtube_ei)       || 0,
                    google_trends: parseFloat(r.google_trends_ei) || 0,
                    farcaster:     parseFloat(r.farcaster_ei)     || 0,
                },
                tai: r.tai_score != null ? {
                    level:     parseFloat(r.tai_level)     || 0,
                    momentum:  parseFloat(r.tai_momentum)  || 0.5,
                    velocity:  parseFloat(r.tai_velocity)  || 0.5,
                    consensus: parseFloat(r.tai_consensus) || 0,
                    score:     parseFloat(r.tai_score)     || 0,
                } : null,
            }))
        });
    } catch (error) {
        console.error('[API] History error:', error);
        return res.status(500).json({ error: 'Internal error' });
    }
});

/**
 * GET /api/attention
 * Returns latest scores for all tracked topics.
 */
router.get('/attention', async (_req: Request, res: Response) => {
    const topics = (process.env.ATTENTION_TOPICS || '').split(',').map(t => t.trim()).filter(Boolean);

    try {
        const results = await Promise.all(
            topics.map(topic =>
                db.query(`
                    SELECT topic, doa_score, computed_at, tai_score
                    FROM attention_scores
                    WHERE topic = $1
                    ORDER BY computed_at DESC
                    LIMIT 1
                `, [topic])
            )
        );

        const scores: Record<string, any> = {};
        results.forEach((r, i) => {
            if (r.rows.length > 0) {
                scores[topics[i]] = {
                    value:     parseFloat(r.rows[0].doa_score),
                    timestamp: Math.floor(new Date(r.rows[0].computed_at).getTime() / 1000),
                    tai_score: r.rows[0].tai_score ? parseFloat(r.rows[0].tai_score) : null,
                };
            }
        });

        return res.json({ topics: scores });
    } catch (error) {
        console.error('[API] Error:', error);
        return res.status(500).json({ error: 'Internal error' });
    }
});

export default router;
