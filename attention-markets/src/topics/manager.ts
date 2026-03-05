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

export async function getAllTopics(): Promise<Topic[]> {
    const result = await db.query(
        `SELECT id, name, slug, status FROM topics ORDER BY id`
    );
    return result.rows;
}
