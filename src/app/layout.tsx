import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "PULSE — Your market, monitored for you",
  description:
    "PULSE is a smart market watchlist. Don't monitor the market — let PULSE tell you what changed, why it matters, and what deserves your attention.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>

      <body className="min-h-screen font-body antialiased relative overflow-x-hidden">
        {/* Subtle atmospheric ambient lighting — refined premium fintech feel */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
          {/* Soft indigo glow top-left */}
          <div className="absolute -top-[180px] left-[5%] h-[600px] w-[600px] rounded-full bg-[#5367FE]/10 blur-[160px]" />
          {/* Very subtle mint breath top-right — much lower opacity so it doesn't bleed into cards */}
          <div className="absolute -top-[100px] right-[0%] h-[500px] w-[500px] rounded-full bg-[#00F3BB]/6 blur-[180px]" />
          {/* Deep indigo base glow */}
          <div className="absolute bottom-[0%] left-[20%] h-[400px] w-[700px] rounded-full bg-[#5367FE]/7 blur-[150px]" />
        </div>

        <Nav />

        <main className="relative z-10 mx-auto max-w-[1400px] px-5 pb-24 pt-8 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
