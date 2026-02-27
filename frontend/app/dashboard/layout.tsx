import { SolanaWalletProvider } from '@/components/wallet/WalletProvider';
import { WalletButton } from '@/components/trading/WalletButton';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      <div className="min-h-screen bg-[#0A0A0B]">
        {/* Dashboard Nav */}
        <nav className="sticky top-0 z-40 bg-[#0A0A0B]/95 backdrop-blur-xl border-b border-[#222225]">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                <circle cx="14" cy="14" r="12" stroke="#FFB800" strokeWidth="1.5" opacity="0.3" />
                <circle cx="14" cy="14" r="7" stroke="#FFB800" strokeWidth="1.5" opacity="0.6" />
                <circle cx="14" cy="14" r="2.5" fill="#FFB800" />
                <line x1="14" y1="14" x2="24" y2="9" stroke="#FFB800" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
              </svg>
              <span className="font-[family-name:var(--font-space)] font-bold text-[#EAEAEC]">TripWire</span>
              <span className="text-[9px] font-[family-name:var(--font-mono)] text-[#FFB800] border border-[#FFB800]/30 bg-[#FFB800]/8 px-1.5 py-0.5 rounded uppercase tracking-widest">
                Beta
              </span>
            </Link>

            {/* Nav tabs */}
            <div className="flex items-center gap-1">
              <NavTab href="/dashboard" label="Trade" />
              <NavTab href="/dashboard/portfolio" label="Portfolio" />
            </div>

            {/* Home link */}
            <a
              href="/"
              className="shrink-0 hidden sm:flex items-center gap-1.5 text-xs font-[family-name:var(--font-mono)] text-[#55555E] hover:text-[#8A8A95] transition-colors"
            >
              <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 6L8 1L14 6V14H10V10H6V14H2V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              Home
            </a>

            {/* Wallet */}
            <WalletButton />
          </div>
        </nav>

        {children}
      </div>
    </SolanaWalletProvider>
  );
}

function NavTab({ href, label }: { href: string; label: string }) {
  // We use a plain anchor since this is a server component layout
  return (
    <a
      href={href}
      className="px-3 py-1.5 text-sm font-[family-name:var(--font-inter)] text-[#8A8A95] hover:text-[#EAEAEC] transition-colors rounded-lg hover:bg-[#111113]"
    >
      {label}
    </a>
  );
}
