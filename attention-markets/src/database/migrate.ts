import { db } from './connection';
import fs from 'fs';
import path from 'path';

async function migrate() {
    console.log('Running database migrations...');

    try {
        // 001: base schema
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        await db.query(schema);
        console.log('✓ 001 base schema');

        // 002: add Google Trends + Farcaster columns
        const m002 = path.join(__dirname, 'migrations', '002_add_trends_farcaster.sql');
        if (fs.existsSync(m002)) {
            await db.query(fs.readFileSync(m002, 'utf-8'));
            console.log('✓ 002 trends + farcaster columns');
        }

        console.log('✓ All migrations complete');
        process.exit(0);
    } catch (error) {
        console.error('✗ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
