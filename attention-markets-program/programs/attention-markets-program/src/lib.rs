use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("35mr61jToyKGyynBgFtQJ8RnEEx3aoSVa3ofyK7rAgzb");

/// Attention Markets — perpetual-style trading on Degree of Attention (DoA) scores.
///
/// Trendle model (NOT a prediction market):
///   • Users open Long/Short positions against a live DoA feed
///   • P&L is determined by the ratio of current DoA to entry DoA
///   • Positions can be opened and closed at any time — no deadline, no resolution event
///
/// P&L formula:
///   Long  → payout = stake × (current_doa / entry_doa)   [win when DoA rises]
///   Short → payout = stake × (entry_doa  / current_doa)  [win when DoA falls]
///   Payout capped at 2× stake (max 100% gain), min 0 (full loss)
///
/// Liquidity:
///   Oracle pre-funds the vault at market creation.
///   User stakes also accumulate in the vault and fund payouts.
#[program]
pub mod attention_markets_program {
    use super::*;

    /// Oracle creates a new attention market and seeds the vault with initial liquidity.
    /// `initial_funding` is the amount of lamports the oracle deposits as the liquidity pool.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        topic: String,
        initial_funding: u64,
    ) -> Result<()> {
        require!(topic.len() <= 32, AttentionError::TopicTooLong);
        require!(initial_funding > 0, AttentionError::InsufficientFunding);

        let market = &mut ctx.accounts.market;
        market.topic = topic.clone();
        market.oracle = ctx.accounts.oracle.key();
        market.doa_score = 0;
        market.is_open = true;
        market.total_long_exposure = 0;
        market.total_short_exposure = 0;
        market.market_bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;

        // Oracle seeds the vault with initial liquidity
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.oracle.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, initial_funding)?;

        msg!(
            "[AttentionMarkets] Market created: {} | funded with {} lamports",
            topic,
            initial_funding
        );
        Ok(())
    }

    /// Oracle pushes a fresh DoA score (0–10_000 basis points = 0.00–100.00).
    /// Called automatically by the backend every 5 minutes.
    pub fn update_doa(ctx: Context<UpdateDoa>, score: u16) -> Result<()> {
        require!(score <= 10_000, AttentionError::InvalidScore);
        require!(ctx.accounts.market.is_open, AttentionError::MarketClosed);

        ctx.accounts.market.doa_score = score;
        msg!(
            "[AttentionMarkets] DoA updated: {} = {}bps ({:.2}/100)",
            ctx.accounts.market.topic,
            score,
            score as f32 / 100.0
        );
        Ok(())
    }

    /// User opens a Long or Short position on the current DoA score.
    /// `amount` is the stake in lamports (min 0.001 SOL).
    /// Entry DoA is recorded at the moment of opening — P&L tracks from here.
    pub fn open_position(
        ctx: Context<OpenPosition>,
        direction: Direction,
        amount: u64,
    ) -> Result<()> {
        require!(ctx.accounts.market.is_open, AttentionError::MarketClosed);
        require!(amount >= 1_000_000, AttentionError::StakeTooSmall);

        let doa = ctx.accounts.market.doa_score;
        require!(doa > 0, AttentionError::DoaNotSet);

        // Transfer stake from trader to vault
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.trader.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount)?;

        // Record position
        let pos = &mut ctx.accounts.position;
        pos.market = ctx.accounts.market.key();
        pos.owner = ctx.accounts.trader.key();
        pos.direction = direction.clone();
        pos.amount = amount;
        pos.entry_doa = doa;
        pos.opened_at = Clock::get()?.unix_timestamp;
        pos.is_open = true;
        pos.bump = ctx.bumps.position;

        // Track open interest
        let market = &mut ctx.accounts.market;
        match direction {
            Direction::Long => {
                market.total_long_exposure =
                    market.total_long_exposure.saturating_add(amount)
            }
            Direction::Short => {
                market.total_short_exposure =
                    market.total_short_exposure.saturating_add(amount)
            }
        }

        msg!(
            "[AttentionMarkets] Position opened: {} {:?} {} lamports @ {}bps DoA",
            ctx.accounts.trader.key(),
            pos.direction,
            amount,
            doa
        );
        Ok(())
    }

    /// User closes their position and receives payout based on DoA change.
    ///
    /// Long  payout = stake × (current_doa / entry_doa)   — wins when DoA rises
    /// Short payout = stake × (entry_doa  / current_doa)  — wins when DoA falls
    ///
    /// Capped at 2× stake. If the vault is underfunded, pays what it has.
    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;

        require!(position.is_open, AttentionError::PositionAlreadyClosed);

        let current_doa = market.doa_score as u128;
        let entry_doa = position.entry_doa as u128;
        let stake = position.amount as u128;

        require!(entry_doa > 0, AttentionError::DoaNotSet);
        require!(current_doa > 0, AttentionError::DoaNotSet);

        // Calculate payout using integer arithmetic (no floats in Solana)
        let raw_payout: u128 = match position.direction {
            Direction::Long => {
                // Long: win when DoA goes up
                // payout = stake * current_doa / entry_doa
                stake
                    .checked_mul(current_doa)
                    .and_then(|v| v.checked_div(entry_doa))
                    .ok_or(AttentionError::ArithmeticError)?
            }
            Direction::Short => {
                // Short: win when DoA goes down
                // payout = stake * entry_doa / current_doa
                stake
                    .checked_mul(entry_doa)
                    .and_then(|v| v.checked_div(current_doa))
                    .ok_or(AttentionError::ArithmeticError)?
            }
        };

        // Cap at 2× stake (max 100% gain)
        let max_payout = stake.saturating_mul(2);
        let capped_payout = raw_payout.min(max_payout) as u64;

        // Pay what the vault has if underfunded (prevents panic)
        let vault_balance = ctx.accounts.vault.to_account_info().lamports();
        let actual_payout = capped_payout.min(vault_balance);

        // Mark position as closed
        position.is_open = false;

        // Update open interest
        let pnl_sign = if actual_payout >= position.amount { "+" } else { "-" };
        let pnl_abs = if actual_payout >= position.amount {
            actual_payout - position.amount
        } else {
            position.amount - actual_payout
        };

        // Transfer from vault (program-owned) to trader
        let vault_info = ctx.accounts.vault.to_account_info();
        let trader_info = ctx.accounts.trader.to_account_info();

        **vault_info.try_borrow_mut_lamports()? = vault_info
            .lamports()
            .checked_sub(actual_payout)
            .ok_or(AttentionError::InsufficientVaultFunds)?;
        **trader_info.try_borrow_mut_lamports()? = trader_info
            .lamports()
            .checked_add(actual_payout)
            .ok_or(AttentionError::ArithmeticError)?;

        msg!(
            "[AttentionMarkets] Position closed: {} {:?} | entry={}bps current={}bps | payout={} ({}{} lamports P&L)",
            ctx.accounts.trader.key(),
            position.direction,
            position.entry_doa,
            market.doa_score,
            actual_payout,
            pnl_sign,
            pnl_abs
        );
        Ok(())
    }

    /// Oracle closes the market (no new positions accepted, existing ones can still close).
    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        ctx.accounts.market.is_open = false;
        msg!("[AttentionMarkets] Market closed: {}", ctx.accounts.market.topic);
        Ok(())
    }
}

// ── Account structs ──────────────────────────────────────────────────────────

#[account]
pub struct Market {
    /// Topic identifier, e.g. "Solana" or "AI"
    pub topic: String,
    /// Pubkey of the authorised oracle
    pub oracle: Pubkey,
    /// Latest DoA score in basis points (0–10_000 = 0.00–100.00)
    pub doa_score: u16,
    /// Whether new positions can be opened
    pub is_open: bool,
    /// Total lamports of open LONG exposure
    pub total_long_exposure: u64,
    /// Total lamports of open SHORT exposure
    pub total_short_exposure: u64,
    pub market_bump: u8,
    pub vault_bump: u8,
}

impl Market {
    // discriminator(8) + string(4+32) + pubkey(32) + u16(2) + bool(1) + u64(8) + u64(8) + u8(1) + u8(1)
    pub const LEN: usize = 8 + (4 + 32) + 32 + 2 + 1 + 8 + 8 + 1 + 1;
}

/// Vault PDA — holds all SOL (oracle liquidity + user stakes).
#[account]
pub struct Vault {
    pub bump: u8,
}

impl Vault {
    pub const LEN: usize = 8 + 1;
}

#[account]
pub struct Position {
    pub market: Pubkey,
    pub owner: Pubkey,
    pub direction: Direction,
    /// Stake in lamports
    pub amount: u64,
    /// DoA score (bps) at time of opening
    pub entry_doa: u16,
    pub opened_at: i64,
    pub is_open: bool,
    pub bump: u8,
}

impl Position {
    // discriminator(8) + pubkey(32) + pubkey(32) + enum(1) + u64(8) + u16(2) + i64(8) + bool(1) + u8(1)
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 2 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum Direction {
    Long,  // Bets DoA will rise
    Short, // Bets DoA will fall
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
pub struct OpenPosition<'info> {
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
        payer = trader,
        space = Position::LEN,
        seeds = [b"position", market.key().as_ref(), trader.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub trader: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
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
        constraint = position.owner == trader.key() @ AttentionError::NotPositionOwner,
        seeds = [b"position", market.key().as_ref(), trader.key().as_ref()],
        bump  = position.bump,
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub trader: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    #[account(mut, has_one = oracle)]
    pub market: Account<'info, Market>,
    pub oracle: Signer<'info>,
}

// ── Errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum AttentionError {
    #[msg("Topic must be 32 characters or fewer")]
    TopicTooLong,
    #[msg("Initial funding must be greater than 0")]
    InsufficientFunding,
    #[msg("Score must be 0-10000 basis points")]
    InvalidScore,
    #[msg("Market is closed — no new positions")]
    MarketClosed,
    #[msg("Minimum stake is 0.001 SOL (1_000_000 lamports)")]
    StakeTooSmall,
    #[msg("DoA score has not been set yet — wait for first oracle update")]
    DoaNotSet,
    #[msg("Position is already closed")]
    PositionAlreadyClosed,
    #[msg("Vault has insufficient funds")]
    InsufficientVaultFunds,
    #[msg("Arithmetic overflow or division by zero")]
    ArithmeticError,
    #[msg("You are not the position owner")]
    NotPositionOwner,
}
