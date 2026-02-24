import { Nav } from '@/components/landing/Nav';
import { Hero } from '@/components/landing/Hero';
import { TickerTape } from '@/components/landing/TickerTape';
import { OracleFlow } from '@/components/landing/OracleFlow';
import { GridBreak } from '@/components/landing/GridBreak';
import { MarketPreview } from '@/components/landing/MarketPreview';
import { BetaAccess } from '@/components/landing/BetaAccess';
import { Footer } from '@/components/landing/Footer';
import { SmoothScroll } from '@/components/landing/SmoothScroll';

export default function LandingPage() {
  return (
    <SmoothScroll>
      <div className="min-h-screen bg-[#0A0A0B] text-[#EAEAEC] overflow-x-hidden">
        <Nav />
        <Hero />
        <TickerTape />
        <OracleFlow />
        <GridBreak />
        <MarketPreview />
        <BetaAccess />
        <Footer />
      </div>
    </SmoothScroll>
  );
}
