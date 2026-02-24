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

  // Test topic — unique per run to avoid PDA collisions on devnet
  const TOPIC = `Solana-${Date.now()}`;
  const THRESHOLD = 5000; // 50.00 DoA score
  const DEADLINE = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  let marketPda: PublicKey;
  let vaultPda: PublicKey;
  let bettor: Keypair;

  before(async () => {
    // Derive PDAs
    [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), Buffer.from(TOPIC)],
      program.programId
    );
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), marketPda.toBuffer()],
      program.programId
    );

    // Fund a bettor keypair from oracle wallet (avoids devnet airdrop rate-limits)
    bettor = Keypair.generate();
    const fundTx = await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: oracle.publicKey,
          toPubkey: bettor.publicKey,
          lamports: 2 * LAMPORTS_PER_SOL,
        })
      )
    );
    console.log(`  Funded bettor via ${fundTx.slice(0, 16)}...`);
    console.log(`  Bettor: ${bettor.publicKey.toBase58()}`);
    console.log(`  Market PDA: ${marketPda.toBase58()}`);
    console.log(`  Vault PDA: ${vaultPda.toBase58()}`);
  });

  // ── 1. create_market ────────────────────────────────────────────────────────

  it('creates a market', async () => {
    const tx = await program.methods
      .createMarket(TOPIC, THRESHOLD, new BN(DEADLINE))
      .accounts({
        market: marketPda,
        vault: vaultPda,
        oracle: oracle.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`  create_market tx: ${tx}`);

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.topic, TOPIC);
    assert.equal(market.threshold, THRESHOLD);
    assert.equal(market.oracle.toBase58(), oracle.publicKey.toBase58());
    assert.equal(market.resolved, false);
    assert.equal(market.totalHigh.toNumber(), 0);
    assert.equal(market.totalLow.toNumber(), 0);
  });

  // ── 2. update_doa ───────────────────────────────────────────────────────────

  it('oracle updates DoA score', async () => {
    const score = 6200; // 62.00 — above threshold, so HIGH would win

    const tx = await program.methods
      .updateDoa(score)
      .accounts({
        market: marketPda,
        oracle: oracle.publicKey,
      })
      .rpc();

    console.log(`  update_doa tx: ${tx}`);

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.doaScore, score);
  });

  // ── 3. place_bet ────────────────────────────────────────────────────────────

  it('bettor places a HIGH bet', async () => {
    const betAmount = new BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL

    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPda.toBuffer(), bettor.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .placeBet({ high: {} }, betAmount)
      .accounts({
        market: marketPda,
        vault: vaultPda,
        position: positionPda,
        bettor: bettor.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([bettor])
      .rpc();

    console.log(`  place_bet tx: ${tx}`);

    const market = await program.account.market.fetch(marketPda);
    const position = await program.account.position.fetch(positionPda);

    assert.equal(market.totalHigh.toNumber(), betAmount.toNumber());
    assert.equal(market.totalLow.toNumber(), 0);
    assert.equal(position.amount.toNumber(), betAmount.toNumber());
    assert.equal(position.claimed, false);
    assert.deepEqual(position.side, { high: {} });

    // Verify vault received the funds
    const vaultBalance = await provider.connection.getBalance(vaultPda);
    assert.isAbove(vaultBalance, betAmount.toNumber());
    console.log(`  Vault balance: ${vaultBalance / LAMPORTS_PER_SOL} SOL`);
  });

  // ── 4. resolve_market ───────────────────────────────────────────────────────

  it('oracle resolves the market', async () => {
    const tx = await program.methods
      .resolveMarket()
      .accounts({
        market: marketPda,
        oracle: oracle.publicKey,
      })
      .rpc();

    console.log(`  resolve_market tx: ${tx}`);

    const market = await program.account.market.fetch(marketPda);
    assert.equal(market.resolved, true);
    // DoA (6200) > threshold (5000) → HIGH wins
    assert.equal(market.highWins, true);
    console.log(`  HIGH wins: ${market.highWins} (doa=${market.doaScore} > threshold=${market.threshold})`);
  });

  // ── 5. claim_winnings ───────────────────────────────────────────────────────

  it('winner claims their payout', async () => {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPda.toBuffer(), bettor.publicKey.toBuffer()],
      program.programId
    );

    const balanceBefore = await provider.connection.getBalance(bettor.publicKey);

    const tx = await program.methods
      .claimWinnings()
      .accounts({
        market: marketPda,
        vault: vaultPda,
        position: positionPda,
        winner: bettor.publicKey,
      })
      .signers([bettor])
      .rpc();

    console.log(`  claim_winnings tx: ${tx}`);

    const balanceAfter = await provider.connection.getBalance(bettor.publicKey);
    const position = await program.account.position.fetch(positionPda);

    assert.equal(position.claimed, true);
    // With only 1 bettor (0.1 SOL on HIGH, 0 on LOW), payout = 0.1 SOL total pool
    assert.isAbove(balanceAfter, balanceBefore, 'Winner should have more SOL after claiming');
    console.log(`  Balance change: +${(balanceAfter - balanceBefore) / LAMPORTS_PER_SOL} SOL`);
  });

  // ── Error cases ─────────────────────────────────────────────────────────────

  it('rejects double claim', async () => {
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), marketPda.toBuffer(), bettor.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .claimWinnings()
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: positionPda,
          winner: bettor.publicKey,
        })
        .signers([bettor])
        .rpc();
      assert.fail('Should have thrown AlreadyClaimed error');
    } catch (err: any) {
      assert.include(err.toString(), 'AlreadyClaimed');
      console.log('  Correctly rejected double claim');
    }
  });
});
