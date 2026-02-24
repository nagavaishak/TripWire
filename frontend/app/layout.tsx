import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TripWire — Attention Has a Price Now",
  description: "Real-time attention trading on Solana. TripWire reads YouTube, Google Trends, and Farcaster — then puts the signal on-chain.",
  openGraph: {
    title: "TripWire — Attention Has a Price Now",
    description: "Real-time attention trading on Solana.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased scanlines">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
