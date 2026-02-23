import { db } from './connection';
import fs from 'fs';
import path from 'path';

async function migrate() {
    console.log('Running database migrations...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    try {
        await db.query(schema);
        console.log('✓ Migrations complete');
        process.exit(0);
    } catch (error) {
        console.error('✗ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
