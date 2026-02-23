import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

db.on('connect', () => {
    console.log('✓ Database connected');
});

db.on('error', (err) => {
    console.error('Database error:', err);
});
