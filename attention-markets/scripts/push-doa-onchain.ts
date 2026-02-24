/**
 * push-doa-onchain.ts
 *
 * Fetches current DoA scores from the oracle API and pushes them
 * to the on-chain Anchor program via update_doa().
 *
 * Usage:
 *   ts-node scripts/push-doa-onchain.ts
 *
 * Env vars (optional):
 *   ORACLE_API_URL  — defaults to https://attention-markets-api.onrender.com
 *   SOLANA_RPC_URL  — defaults to https://api.devnet.solana.com
 *   SOLANA_PRIVATE_KEY — base58 or JSON array; falls back to ~/.config/solana/oracle-keypair.json
 */

import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';

const PROGRAM_ID = new PublicKey('35mr61jToyKGyynBgFtQJ8RnEEx3aoSVa3ofyK7rAgzb');
const ORACLE_API = process.env.ORACLE_API_URL || 'https://attention-markets-api.onrender.com';
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const TOPICS = ['Solana', 'AI'];

function loadKeypair(): Keypair {
  const pk = process.env.SOLANA_PRIVATE_KEY;
  if (pk) {
    return pk.startsWith('[')
      ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(pk)))
      : Keypair.fromSecretKey(Buffer.from(pk, 'base64'));
  }
  const keyPath = path.join(os.homedir(), '.config', 'solana', 'oracle-keypair.json');
  const raw = fs.readFileSync(keyPath, 'utf-8');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

async function fetchDoaScore(topic: string): Promise<number | null> {
  try {
    const res = await axios.get(`${ORACLE_API}/api/attention/${encodeURIComponent(topic)}`, {
      timeout: 10_000,
    });
    return res.data?.value ?? null;
  } catch (err: any) {
    console.error(`  [fetch] ${topic}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log(`[push-doa] Connecting to ${RPC_URL}`);
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(loadKeypair());
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  // Load IDL from the built artifact
  const idlPath = path.join(
    __dirname,
    '..',
    '..',
    'attention-markets-program',
    'target',
    'idl',
    'attention_markets_program.json'
  );
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
  const program = new anchor.Program(idl, provider);

  console.log(`[push-doa] Oracle wallet: ${wallet.publicKey.toBase58()}`);

  for (const topic of TOPICS) {
    console.log(`\n[push-doa] Processing topic: ${topic}`);

    // Derive market PDA
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), Buffer.from(topic)],
      PROGRAM_ID
    );

    // Check if market exists
    const marketInfo = await connection.getAccountInfo(marketPda);
    if (!marketInfo) {
      console.log(`  Market not found on-chain for ${topic} (run create_market first)`);
      continue;
    }

    // Fetch DoA from oracle API
    const doa = await fetchDoaScore(topic);
    if (doa === null) {
      console.log(`  Skipping ${topic} — could not fetch DoA`);
      continue;
    }

    // Convert to basis points (0-10000)
    const scoreBps = Math.round(Math.min(100, Math.max(0, doa)) * 100);
    console.log(`  DoA = ${doa.toFixed(2)} → ${scoreBps}bps`);

    try {
      const tx = await program.methods
        .updateDoa(scoreBps)
        .accounts({
          market: marketPda,
          oracle: wallet.publicKey,
        })
        .rpc();

      console.log(`  update_doa OK → ${tx.slice(0, 16)}...`);
    } catch (err: any) {
      console.error(`  update_doa FAILED for ${topic}: ${err.message}`);
    }
  }

  console.log('\n[push-doa] Done');
}

main().catch(console.error);
