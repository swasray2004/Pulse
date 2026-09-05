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
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>

      <body className="min-h-screen font-body antialiased">
        <Nav />

        <main className="mx-auto max-w-[1400px] px-5 pb-24 pt-8 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
