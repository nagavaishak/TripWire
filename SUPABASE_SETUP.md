# Supabase Setup Guide

This guide walks you through setting up TripWire with Supabase as your PostgreSQL database.

## Why Supabase?

- **Free tier** - 500MB database, perfect for development/demos
- **Managed PostgreSQL** - No database maintenance needed
- **Automatic backups** - Built-in backup and restore
- **Nice dashboard** - View and manage your data easily
- **Fast setup** - Up and running in 5 minutes
- **Same PostgreSQL** - All our advanced features (advisory locks, transactions) work perfectly

## Step-by-Step Setup

### 1. Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email

### 2. Create New Project

1. Click "New Project"
2. Choose your organization (or create one)
3. Fill in project details:
   - **Name**: `tripwire` (or anything you want)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free (sufficient for development)
4. Click "Create new project"
5. Wait ~2 minutes while Supabase provisions your database

### 3. Get Connection String

1. In your project dashboard, click **Settings** (gear icon in sidebar)
2. Click **Database** in the settings menu
3. Scroll down to **Connection string** section
4. Select the **Nodejs** tab
5. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklm.supabase.co:5432/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with the database password you set earlier

### 4. Configure TripWire

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and update the `DATABASE_URL`:
   ```bash
   DATABASE_URL=postgresql://postgres:YOUR_ACTUAL_PASSWORD@db.abcdefghijklm.supabase.co:5432/postgres
   ```

3. **CRITICAL:** Generate a secure master encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output and paste it into `MASTER_ENCRYPTION_KEY` in `.env`

4. Save the `.env` file

### 5. Run Database Migrations

Run the migrations to create all necessary tables:

```bash
npm run migrate
```

You should see output like:
```
Running migration: 001_initial_schema.sql
Running migration: 002_add_audit_log.sql
Running migration: 003_add_idempotency_tracking.sql
...
All migrations completed successfully!
```

### 6. Verify Setup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test the health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```

   You should see:
   ```json
   {
     "status": "ok",
     "database": "connected",
     "marketPoller": {...}
   }
   ```

### 7. View Your Data in Supabase

1. Go to your Supabase project dashboard
2. Click **Table Editor** in the sidebar
3. You'll see all the tables created by migrations:
   - `users`
   - `automation_wallets`
   - `rules`
   - `executions`
   - `execution_locks`
   - `withdrawals`
   - `dead_letter_queue`
   - `secrets_audit`
   - `audit_log`
   - `market_snapshots`

You can browse data, run queries, and manage your database from here!

## Connection Pooling

Supabase provides connection pooling automatically. Our app is configured with:
- `max: 10` connections (good for free tier)
- `idleTimeoutMillis: 30000` (30 seconds)
- `connectionTimeoutMillis: 2000` (2 seconds)

These settings work perfectly with Supabase's free tier limits.

## Testing

To run integration tests against Supabase:

1. Ensure `DATABASE_URL` is set in `.env`
2. Run tests:
   ```bash
   npm test
   ```

Tests will connect to your Supabase database and create/cleanup test data automatically.

**Pro tip:** Create a separate Supabase project for testing to avoid mixing test data with development data.

## Troubleshooting

### Connection Refused

**Problem:** `Error: connect ECONNREFUSED`

**Solution:**
- Check your connection string has the correct password
- Ensure your IP is not blocked (Supabase free tier allows all IPs by default)
- Verify your project is fully initialized (check Supabase dashboard)

### Too Many Connections

**Problem:** `Error: remaining connection slots are reserved`

**Solution:**
- Supabase free tier has connection limits
- Our app uses connection pooling with max 10 connections (within limits)
- If you get this error, restart the app to clear stale connections
- Consider upgrading to Pro tier for more connections

### Password Authentication Failed

**Problem:** `Error: password authentication failed`

**Solution:**
- Double-check your database password in the connection string
- Get the password from your Supabase dashboard (Settings > Database > Reset Database Password if needed)
- Make sure there are no extra spaces or special characters in `.env`

### Migrations Fail

**Problem:** Migrations fail with `relation already exists`

**Solution:**
- Migrations have already been run
- Check the `migrations_history` table in Supabase to see what's been applied
- If you need to reset: Go to Supabase SQL Editor and drop all tables, then re-run migrations

## Production Deployment

When deploying to production:

1. **Use Supabase Pro** - Better performance, more connections
2. **Enable SSL** - Already enabled by default in Supabase
3. **Set up backups** - Configure automatic backups in Supabase
4. **Monitor usage** - Check Supabase dashboard for connection/query metrics
5. **Environment variables** - Set `DATABASE_URL` in your hosting platform (Railway, Vercel, etc.)

## Cost Estimate

**Free Tier (Suitable for hackathon/demo):**
- 500MB database storage
- Unlimited API requests
- 50,000 monthly active users
- 500MB bandwidth
- **Cost: $0/month**

**Pro Tier (Production-ready):**
- 8GB database storage
- Unlimited API requests
- 100,000 monthly active users
- 50GB bandwidth
- Daily backups
- **Cost: $25/month**

## Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- Check TripWire issues on GitHub
