"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PulseMark } from "./PulseMark";
import { clsx } from "clsx";

const LINKS = [
  { href: "/", label: "Pulse" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/away", label: "While Away" },
  { href: "/replay", label: "Replay" },
  { href: "/preferences", label: "Preferences" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <PulseMark size={28} animated={false} />
          <span className="font-display text-[17px] font-semibold tracking-tight text-white">
            PULSE
          </span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
