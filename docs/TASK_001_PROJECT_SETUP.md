# Task 001: Project Setup and Dependencies

## Objective
Initialize Node.js/TypeScript project with all required dependencies and basic folder structure.

## Requirements

1. Initialize TypeScript configuration
2. Install core dependencies:
   - express (API server)
   - pg (PostgreSQL client)
   - @solana/web3.js (Solana interaction)
   - @sendgrid/mail (email notifications)
   - dotenv (environment variables)
   - axios (HTTP client for Kalshi/Jupiter)
   - winston (logging)

3. Install dev dependencies:
   - typescript
   - @types/node, @types/express, @types/pg
   - ts-node, nodemon
   - jest, @types/jest (testing)
   - eslint, prettier (code quality)

4. Create basic folder structure:
```
   src/
     services/     (business logic)
     models/       (DB models)
     controllers/  (API handlers)
     utils/        (helpers)
     types/        (TypeScript types)
   tests/
   docs/
```

5. Create basic configuration files:
   - tsconfig.json
   - .eslintrc.js
   - .prettierrc
   - .env.example
   - .gitignore

6. Create initial index.ts with basic Express server

## Acceptance Criteria
- `npm install` runs without errors
- `npm run dev` starts Express server on port 3000
- TypeScript compiles without errors
- Basic health check endpoint responds at GET /health

## Estimated Time
2-3 hours