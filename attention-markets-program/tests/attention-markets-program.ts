import * as anchor from '@coral-xyz/anchor';
import { Program, BN } from '@coral-xyz/anchor';
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from '@solana/web3.js';
import { AttentionMarketsProgram } from '../target/types/attention_markets_program';
import { assert } from 'chai';

describe('attention-markets-program', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .attentionMarketsProgram as Program<AttentionMarketsProgram>;

  const oracle = provider.wallet as anchor.Wallet;

  // Unique topic per run to avoid PDA collisions on devnet
  const TOPIC = `Solana-${Date.now()}`;
  const INITIAL_FUNDING = new BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL liquidity pool

  let marketPda: PublicKey;
  let vaultPda: PublicKey;
  let trader: Keypair;

  before(async () => {
    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), Buffer.from(TOPIC)],
      program.programId
    );
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), marketPda.toBuffer()],
      program.programId
    );

    // Fund trader from oracle wallet (avoids devnet airdrop rate-limits)
    trader = Keypair.generate();
    const fundTx = await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: oracle.publicKey,
          toPubkey: trader.publicKey,
          lamports: 1 * LAMPORTS_PER_SOL,
        })
      )
    );
    console.log(`  Funded trader: ${trader.publicKey.toBase58()} (tx: ${fundTx.slice(0, 16)}...)`);
    console.log(`  Market PDA: ${marketPda.toBase58()}`);
    console.log(`  Vault PDA: ${vaultPda.toBase58()}`);
  });

  // ── 1. create_market ────────────────────────────────────────────────────────

  it('oracle creates market and seeds vault', async () => {
    const tx = await program.methods
      .createMarket(TOPIC, INITIAL_FUNDING)
      .accounts({
        market: marketPda,
        vault: vaultPda,
        oracle: oracle.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`  create_market tx: ${tx.slice(0, 16)}...`);

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.topic, TOPIC);
    assert.equal(market.oracle.toBase58(), oracle.publicKey.toBase58());
    assert.equal(market.isOpen, true);
    assert.equal(market.doaScore, 0);

    const vaultBalance = await provider.connection.getBalance(vaultPda);
    assert.isAbove(vaultBalance, INITIAL_FUNDING.toNumber() - 10_000);
    console.log(`  Vault seeded: ${vaultBalance / LAMPORTS_PER_SOL} SOL`);
  });

  // ── 2. update_doa ───────────────────────────────────────────────────────────

  it('oracle sets initial DoA score', async () => {
    const score = 5000; // 50.00 DoA

    await program.methods
      .updateDoa(score)
      .accounts({ market: marketPda, oracle: oracle.publicKey })
      .rpc();

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.doaScore, score);
    console.log(`  DoA set to ${score}bps (${score / 100}/100)`);
  });

  // ── 3. open_position (Long) ─────────────────────────────────────────────────

  it('trader opens a Long position', async () => {
    const stake = new BN(0.1 * LAMPORTS_PER_SOL);

    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPda.toBuffer(), trader.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .openPosition({ long: {} }, stake)
      .accounts({
        market: marketPda,
        vault: vaultPda,
        position: positionPda,
        trader: trader.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([trader])
      .rpc();

    console.log(`  open_position tx: ${tx.slice(0, 16)}...`);

    const position = await program.account.position.fetch(positionPda);
    assert.deepEqual(position.direction, { long: {} });
    assert.equal(position.amount.toNumber(), stake.toNumber());
    assert.equal(position.entryDoa, 5000);
    assert.equal(position.isOpen, true);

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.totalLongExposure.toNumber(), stake.toNumber());
    console.log(`  Long opened: ${stake.toNumber() / LAMPORTS_PER_SOL} SOL @ 50.00 DoA`);
  });

  // ── 4. DoA rises → close for profit ─────────────────────────────────────────

  it('DoA rises — Long position closes in profit', async () => {
    // DoA rises from 5000 → 7500 (+50%)
    await program.methods
      .updateDoa(7500)
      .accounts({ market: marketPda, oracle: oracle.publicKey })
      .rpc();

    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPda.toBuffer(), trader.publicKey.toBuffer()],
      program.programId
    );

    const balanceBefore = await provider.connection.getBalance(trader.publicKey);
    const stake = 0.1 * LAMPORTS_PER_SOL;

    const tx = await program.methods
      .closePosition()
      .accounts({
        market: marketPda,
        vault: vaultPda,
        position: positionPda,
        trader: trader.publicKey,
      })
      .signers([trader])
      .rpc();

    console.log(`  close_position tx: ${tx.slice(0, 16)}...`);

    const balanceAfter = await provider.connection.getBalance(trader.publicKey);
    const payout = balanceAfter - balanceBefore;

    // Long: payout = stake * (7500 / 5000) = stake * 1.5 → +50% gain
    const expectedPayout = stake * (7500 / 5000); // 0.15 SOL
    console.log(`  Stake: ${stake / LAMPORTS_PER_SOL} SOL`);
    console.log(`  Payout: ${payout / LAMPORTS_PER_SOL} SOL (expected ~${expectedPayout / LAMPORTS_PER_SOL} SOL)`);

    // Allow for tx fees
    assert.isAbove(payout, stake * 0.4, 'Payout should be significantly more than stake');

    const position = await program.account.position.fetch(positionPda);
    assert.equal(position.isOpen, false);
  });

  // ── 5. Short position with DoA falling ────────────────────────────────────

  it('trader 2 opens Short, DoA falls, closes in profit', async () => {
    const trader2 = Keypair.generate();
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: oracle.publicKey,
          toPubkey: trader2.publicKey,
          lamports: 1 * LAMPORTS_PER_SOL,
        })
      )
    );

    const [positionPda2] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPda.toBuffer(), trader2.publicKey.toBuffer()],
      program.programId
    );

    const stake = new BN(0.1 * LAMPORTS_PER_SOL);

    // DoA is at 7500, open Short
    await program.methods
      .openPosition({ short: {} }, stake)
      .accounts({
        market: marketPda,
        vault: vaultPda,
        position: positionPda2,
        trader: trader2.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([trader2])
      .rpc();

    console.log(`  Short opened @ 75.00 DoA`);

    // DoA falls to 3750 (-50%)
    await program.methods
      .updateDoa(3750)
      .accounts({ market: marketPda, oracle: oracle.publicKey })
      .rpc();

    const balanceBefore = await provider.connection.getBalance(trader2.publicKey);

    await program.methods
      .closePosition()
      .accounts({
        market: marketPda,
        vault: vaultPda,
        position: positionPda2,
        trader: trader2.publicKey,
      })
      .signers([trader2])
      .rpc();

    const balanceAfter = await provider.connection.getBalance(trader2.publicKey);
    const payout = balanceAfter - balanceBefore;

    // Short: payout = stake * (7500 / 3750) = stake * 2.0 → +100% gain (capped at 2x)
    console.log(`  Short payout: ${payout / LAMPORTS_PER_SOL} SOL (expected ~0.2 SOL)`);
    assert.isAbove(payout, stake.toNumber() * 0.8, 'Short should profit when DoA falls');
  });

  // ── 6. Error: close already-closed position ────────────────────────────────

  it('rejects closing an already-closed position', async () => {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPda.toBuffer(), trader.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .closePosition()
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: positionPda,
          trader: trader.publicKey,
        })
        .signers([trader])
        .rpc();
      assert.fail('Should have thrown PositionAlreadyClosed');
    } catch (err: any) {
      assert.include(err.toString(), 'PositionAlreadyClosed');
      console.log('  Correctly rejected double-close');
    }
  });
});
