export function Footer() {
  return (
    <footer className="border-t border-[#222225] py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
            <circle cx="14" cy="14" r="12" stroke="#FFB800" strokeWidth="1.5" opacity="0.3" />
            <circle cx="14" cy="14" r="7" stroke="#FFB800" strokeWidth="1.5" opacity="0.6" />
            <circle cx="14" cy="14" r="2.5" fill="#FFB800" />
            <line x1="14" y1="14" x2="24" y2="9" stroke="#FFB800" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
          </svg>
          <span className="font-[family-name:var(--font-space)] font-bold text-sm text-[#EAEAEC]">TripWire</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <a
            href="https://solscan.io/account/35mr61jToyKGyynBgFtQJ8RnEEx3aoSVa3ofyK7rAgzb?cluster=devnet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E] hover:text-[#8A8A95] transition-colors uppercase tracking-widest"
          >
            On-chain ↗
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E] hover:text-[#8A8A95] transition-colors uppercase tracking-widest"
          >
            GitHub ↗
          </a>
        </div>

        {/* Right */}
        <p className="text-[11px] font-[family-name:var(--font-mono)] text-[#55555E]">
          Solana Devnet · Not financial advice
        </p>
      </div>
    </footer>
  );
}
