-- Raw metrics from each platform
CREATE TABLE IF NOT EXISTS attention_raw_data (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL,  -- 'twitter', 'reddit', 'youtube'
    metrics JSONB NOT NULL,          -- Platform-specific metrics
    collected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_topic_platform_time ON attention_raw_data (topic, platform, collected_at DESC);

-- Computed attention scores
CREATE TABLE IF NOT EXISTS attention_scores (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(50) NOT NULL,
    doa_score DECIMAL(8,4) NOT NULL,  -- Dollar of Attention (0-100+ scale)

    -- Component scores (for debugging)
    twitter_ei DECIMAL(6,4),          -- Twitter Engagement Index contribution
    reddit_ei DECIMAL(6,4),
    youtube_ei DECIMAL(6,4),

    -- Raw scores (pre-normalization)
    twitter_raw_score DECIMAL(12,2),
    reddit_raw_score DECIMAL(12,2),
    youtube_raw_score DECIMAL(12,2),

    -- Metadata
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    computation_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scores_topic_time ON attention_scores (topic, computed_at DESC);

-- Health monitoring
CREATE TABLE IF NOT EXISTS collector_health (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,      -- 'success', 'failed', 'degraded'
    error_message TEXT,
    response_time_ms INTEGER,
    checked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_topic_platform_time ON collector_health (topic, platform, checked_at DESC);
