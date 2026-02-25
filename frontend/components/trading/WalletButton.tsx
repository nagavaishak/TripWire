'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState, useRef } from 'react';

function truncate(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function WalletButton() {
  const { publicKey, disconnect, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const [balance, setBalance] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    const fetch = async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        setBalance(bal / 1e9);
      } catch { setBalance(null); }
    };
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [publicKey, connection]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="inline-flex items-center gap-2 bg-[#FFB800] text-[#0A0A0B] font-[family-name:var(--font-space)] font-bold text-sm px-4 py-2 rounded-lg hover:bg-[#FFB800]/90 transition-all active:scale-95"
      >
        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
        </svg>
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu((s) => !s)}
        className="inline-flex items-center gap-2.5 bg-[#111113] border border-[#222225] hover:border-[#2E2E33] text-[#EAEAEC] text-sm px-3 py-2 rounded-lg transition-all"
      >
        <span className="w-2 h-2 rounded-full bg-[#00FF88]" />
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#8A8A95]">
          {truncate(publicKey.toBase58())}
        </span>
        {balance !== null && (
          <>
            <span className="text-[#222225]">·</span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-[#FFB800]">
              {balance.toFixed(3)} SOL
            </span>
          </>
        )}
        <svg viewBox="0 0 16 16" className="w-3 h-3 text-[#55555E] fill-current" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
        </svg>
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1.5 bg-[#111113] border border-[#222225] rounded-xl overflow-hidden shadow-xl z-50 min-w-[160px]">
          <a
            href={`https://solscan.io/account/${publicKey.toBase58()}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#8A8A95] hover:text-[#EAEAEC] hover:bg-[#18181B] transition-colors font-[family-name:var(--font-inter)]"
            onClick={() => setShowMenu(false)}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.75 3.75a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z"/>
            </svg>
            View on Solscan
          </a>
          <button
            onClick={() => { disconnect(); setShowMenu(false); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#FF3B5C] hover:bg-[#FF3B5C]/8 transition-colors font-[family-name:var(--font-inter)]"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M2 2.75C2 1.784 2.784 1 3.75 1h5.5c.966 0 1.75.784 1.75 1.75v1.5a.75.75 0 01-1.5 0v-1.5a.25.25 0 00-.25-.25h-5.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h5.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 15h-5.5A1.75 1.75 0 012 13.25V2.75zm10.03 4.47a.75.75 0 010 1.06l-1.25 1.25a.75.75 0 01-1.06-1.06l-.97-.97H4.75a.75.75 0 010-1.5h4l.97-.97a.75.75 0 011.06 0l1.25 1.25z" clipRule="evenodd"/>
            </svg>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
