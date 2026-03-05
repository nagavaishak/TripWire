-- Migration 005: Remove noise topics auto-promoted from related queries.
-- These are sub-queries of Solana/AI, not independent narratives.
-- Only keep the original 5 hand-curated topics.

DELETE FROM topics
WHERE name NOT IN ('Solana', 'AI', 'Bitcoin', 'Ethereum', 'Memecoins');
