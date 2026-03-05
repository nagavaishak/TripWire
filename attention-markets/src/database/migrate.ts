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

        // Run all numbered migrations in order
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            await db.query(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
            console.log(`✓ ${file}`);
        }

        console.log('✓ All migrations complete');
        process.exit(0);
    } catch (error) {
        console.error('✗ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
