use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("35mr61jToyKGyynBgFtQJ8RnEEx3aoSVa3ofyK7rAgzb");

/// Attention Markets — prediction markets backed by on-chain DoA (Degree of Attention) scores.
///
/// Flow:
///   1. Oracle calls `create_market` (topic, threshold_bps, deadline)
///   2. Users call `place_bet` (HIGH / LOW, amount SOL)
///   3. Oracle calls `update_doa` periodically to keep the on-chain score fresh
///   4. Oracle calls `resolve_market` after the deadline
///   5. Winners call `claim_winnings` to receive proportional payouts
#[program]
pub mod attention_markets_program {
    use super::*;

    /// Create a new attention market for a topic.
    ///
    /// * `topic`     — topic identifier, e.g. "Solana" or "AI" (max 32 bytes)
    /// * `threshold` — DoA score threshold in basis points (0–10_000 = 0.00–100.00)
    /// * `deadline`  — Unix timestamp (seconds) when betting closes
    pub fn create_market(
        ctx: Context<CreateMarket>,
        topic: String,
        threshold: u16,
        deadline: i64,
    ) -> Result<()> {
        require!(topic.len() <= 32, AttentionError::TopicTooLong);
        require!(threshold <= 10_000, AttentionError::InvalidThreshold);
        require!(
            deadline > Clock::get()?.unix_timestamp,
            AttentionError::DeadlinePassed
        );

        let market = &mut ctx.accounts.market;
        market.topic = topic.clone();
        market.threshold = threshold;
        market.deadline = deadline;
        market.oracle = ctx.accounts.oracle.key();
        market.doa_score = 0;
        market.total_high = 0;
        market.total_low = 0;
        market.resolved = false;
        market.high_wins = false;
        market.market_bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;

        msg!(
            "[AttentionMarkets] Created: {} | threshold={}bps | deadline={}",
            topic,
            threshold,
            deadline
        );
        Ok(())
    }

    /// Oracle pushes a fresh DoA score on-chain (basis points: 0–10_000).
    /// Called by the attention-markets backend every 5 minutes.
    pub fn update_doa(ctx: Context<UpdateDoa>, score: u16) -> Result<()> {
        require!(score <= 10_000, AttentionError::InvalidScore);
        require!(!ctx.accounts.market.resolved, AttentionError::MarketResolved);

        ctx.accounts.market.doa_score = score;
        msg!(
            "[AttentionMarkets] DoA updated: {} = {}bps ({:.2}/100)",
            ctx.accounts.market.topic,
            score,
            score as f32 / 100.0
        );
        Ok(())
    }

    /// Place a SOL bet on HIGH (DoA > threshold) or LOW (DoA ≤ threshold).
    /// Minimum bet: 0.001 SOL (1_000_000 lamports).
    pub fn place_bet(ctx: Context<PlaceBet>, side: BetSide, amount: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.market.resolved, AttentionError::MarketResolved);
        require!(now < ctx.accounts.market.deadline, AttentionError::DeadlinePassed);
        require!(amount >= 1_000_000, AttentionError::BetTooSmall);

        // Transfer SOL from bettor to vault PDA
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.bettor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount)?;

        // Record the position
        let pos = &mut ctx.accounts.position;
        pos.market = ctx.accounts.market.key();
        pos.owner = ctx.accounts.bettor.key();
        pos.side = side.clone();
        pos.amount = amount;
        pos.claimed = false;
        pos.bump = ctx.bumps.position;

        // Update market totals
        let market = &mut ctx.accounts.market;
        match side {
            BetSide::High => market.total_high = market.total_high.saturating_add(amount),
            BetSide::Low => market.total_low = market.total_low.saturating_add(amount),
        }

        msg!(
            "[AttentionMarkets] Bet: {} on {:?} for {} lamports (pool: high={} low={})",
            ctx.accounts.bettor.key(),
            pos.side,
            amount,
            market.total_high,
            market.total_low,
        );
        Ok(())
    }

    /// Oracle resolves the market using the current on-chain DoA score.
    /// HIGH wins if doa_score > threshold; LOW wins otherwise.
    pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, AttentionError::MarketResolved);

        market.high_wins = market.doa_score > market.threshold;
        market.resolved = true;

        msg!(
            "[AttentionMarkets] Resolved: {} | doa={}bps | threshold={}bps | {} WINS",
            market.topic,
            market.doa_score,
            market.threshold,
            if market.high_wins { "HIGH" } else { "LOW" }
        );
        Ok(())
    }

    /// Winner claims their proportional payout from the prize pool.
    /// Payout = (position.amount / total_winning_side) * total_pool
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;

        require!(market.resolved, AttentionError::MarketNotResolved);
        require!(!position.claimed, AttentionError::AlreadyClaimed);

        let on_winning_side = match &position.side {
            BetSide::High => market.high_wins,
            BetSide::Low => !market.high_wins,
        };
        require!(on_winning_side, AttentionError::NotAWinner);

        let total_pool = market
            .total_high
            .checked_add(market.total_low)
            .ok_or(AttentionError::ArithmeticError)?;
        let winning_pool = if market.high_wins {
            market.total_high
        } else {
            market.total_low
        };
        require!(winning_pool > 0, AttentionError::EmptyPool);

        // Proportional payout (no protocol fee for the hackathon)
        let payout = (position.amount as u128)
            .checked_mul(total_pool as u128)
            .and_then(|v| v.checked_div(winning_pool as u128))
            .ok_or(AttentionError::ArithmeticError)? as u64;

        position.claimed = true;

        // Transfer payout: vault (program-owned) → winner
        let vault_info = ctx.accounts.vault.to_account_info();
        let winner_info = ctx.accounts.winner.to_account_info();

        **vault_info.try_borrow_mut_lamports()? = vault_info
            .lamports()
            .checked_sub(payout)
            .ok_or(AttentionError::InsufficientVaultFunds)?;
        **winner_info.try_borrow_mut_lamports()? = winner_info
            .lamports()
            .checked_add(payout)
            .ok_or(AttentionError::ArithmeticError)?;

        msg!(
            "[AttentionMarkets] Claimed: {} receives {} lamports",
            ctx.accounts.winner.key(),
            payout
        );
        Ok(())
    }
}

// ── Account structs ──────────────────────────────────────────────────────────

/// On-chain state for a single attention market.
#[account]
pub struct Market {
    /// Topic identifier (e.g. "Solana")
    pub topic: String,
    /// DoA threshold in basis points (HIGH wins if doa_score > threshold)
    pub threshold: u16,
    /// Unix timestamp when betting closes
    pub deadline: i64,
    /// Pubkey of the authorised oracle (can call update_doa and resolve_market)
    pub oracle: Pubkey,
    /// Latest DoA score pushed by the oracle (basis points)
    pub doa_score: u16,
    /// Total lamports bet on HIGH
    pub total_high: u64,
    /// Total lamports bet on LOW
    pub total_low: u64,
    /// Whether the market has been resolved
    pub resolved: bool,
    /// True if HIGH side won (only meaningful after resolved = true)
    pub high_wins: bool,
    /// PDA bump for this account
    pub market_bump: u8,
    /// PDA bump for the associated vault account
    pub vault_bump: u8,
}

impl Market {
    // discriminator(8) + string(4+32) + u16(2) + i64(8) + pubkey(32)
    // + u16(2) + u64(8) + u64(8) + bool(1) + bool(1) + u8(1) + u8(1) = 108
    pub const LEN: usize = 8 + (4 + 32) + 2 + 8 + 32 + 2 + 8 + 8 + 1 + 1 + 1 + 1;
}

/// SOL vault — holds the pooled bets for a market.
/// Owned by this program so lamports can be moved without CPI.
#[account]
pub struct Vault {
    pub bump: u8,
}

impl Vault {
    pub const LEN: usize = 8 + 1;
}

/// A single user position in a market.
#[account]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub side: BetSide,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Position {
    // discriminator(8) + pubkey(32) + pubkey(32) + enum(1) + u64(8) + bool(1) + u8(1)
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum BetSide {
    High,
    Low,
}

// ── Instruction contexts ─────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(topic: String)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer  = oracle,
        space  = Market::LEN,
        seeds  = [b"market", topic.as_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// Vault PDA that will hold all bet lamports for this market.
    #[account(
        init,
        payer  = oracle,
        space  = Vault::LEN,
        seeds  = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub oracle: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateDoa<'info> {
    #[account(mut, has_one = oracle)]
    pub market: Account<'info, Market>,
    pub oracle: Signer<'info>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(
        mut,
        seeds = [b"market", market.topic.as_bytes()],
        bump  = market.market_bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump  = market.vault_bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = bettor,
        space = Position::LEN,
        seeds = [b"position", market.key().as_ref(), bettor.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut, has_one = oracle)]
    pub market: Account<'info, Market>,
    pub oracle: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(
        seeds = [b"market", market.topic.as_bytes()],
        bump  = market.market_bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump  = market.vault_bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        has_one = market,
        constraint = position.owner == winner.key() @ AttentionError::NotPositionOwner,
        seeds = [b"position", market.key().as_ref(), winner.key().as_ref()],
        bump  = position.bump,
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub winner: Signer<'info>,
}

// ── Errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum AttentionError {
    #[msg("Topic must be 32 characters or fewer")]
    TopicTooLong,
    #[msg("Threshold must be 0-10000 basis points")]
    InvalidThreshold,
    #[msg("Deadline must be in the future / deadline has passed")]
    DeadlinePassed,
    #[msg("Score must be 0-10000 basis points")]
    InvalidScore,
    #[msg("Market is already resolved")]
    MarketResolved,
    #[msg("Market has not been resolved yet")]
    MarketNotResolved,
    #[msg("Minimum bet is 0.001 SOL (1_000_000 lamports)")]
    BetTooSmall,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("This position is not on the winning side")]
    NotAWinner,
    #[msg("Winning pool is empty")]
    EmptyPool,
    #[msg("Arithmetic overflow or division by zero")]
    ArithmeticError,
    #[msg("Vault has insufficient funds for payout")]
    InsufficientVaultFunds,
    #[msg("You are not the position owner")]
    NotPositionOwner,
}
