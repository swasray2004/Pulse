"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PulseMark } from "./PulseMark";
import { clsx } from "clsx";
import { LogOut, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { usePulseStore } from "@/lib/store";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Pulse" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/away", label: "While Away" },
  { href: "/replay", label: "Replay" },
  { href: "/preferences", label: "Preferences" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      usePulseStore.getState().setActiveWatchlistId(null);
      await api.logout();
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Logout failed:", e);
    } finally {
      setLoggingOut(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchQuery.trim().toUpperCase();
    if (trimmed) {
      router.push(`/stock/${trimmed}`);
      setSearchQuery("");
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050608]/80 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <PulseMark size={28} animated={false} />
          <span className="font-display text-[17px] font-bold tracking-tight text-white flex items-center gap-1.5">
            Groww
            <span className="rounded-md bg-[#00F3BB]/12 border border-[#00F3BB]/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#00F3BB]">
              Pulse
            </span>
          </span>
        </Link>

        {/* Center Search */}
        {!isAuthPage && (
          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center relative w-[280px] lg:w-[360px]"
          >
            <Search className="absolute left-3.5 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stocks, e.g. NVDA"
              className="w-full rounded-xl bg-white/[0.05] border border-white/[0.08] pl-9 pr-4 py-2 text-[13px] text-white placeholder:text-white/30 outline-none transition-all focus:border-[#5367FE]/50 focus:bg-white/[0.08] focus:ring-1 focus:ring-[#5367FE]/20"
            />
          </form>
        )}

        {!isAuthPage ? (
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-0.5 sm:flex">
              {LINKS.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={clsx(
                      "relative rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all duration-200",
                      active
                        ? "text-white"
                        : "text-white/45 hover:text-white/80 hover:bg-white/[0.04]",
                    )}
                  >
                    {link.label}
                    {active && (
                      <span className="absolute bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-[#00F3BB]" />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-2 h-4 w-px bg-white/10" />

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Log out"
              className="ml-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/70 disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <Link
            href={pathname === "/login" ? "/signup" : "/login"}
            className="rounded-xl bg-[#5367FE] hover:bg-[#687BFE] px-4 py-2 text-xs font-bold text-white transition-all shadow-[0_0_20px_rgba(83,103,254,0.35)] hover:shadow-[0_0_28px_rgba(83,103,254,0.5)]"
          >
            {pathname === "/login" ? "Register" : "Login"}
          </Link>
        )}
      </div>
    </header>
  );
}
