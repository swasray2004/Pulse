"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { formatPct } from "@/lib/format";

interface NoiseEntry {
  symbol: string;
  companyName: string;
  attention: { priceChangePct: number };
}

export function SignalNoisePanel({ noise }: { noise: NoiseEntry[] }) {
  const [open, setOpen] = useState(false);
  if (noise.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left gap-4"
      >
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white/60">
            <span className="font-mono font-bold text-white/40">{noise.length}</span>
            {" "}movement{noise.length === 1 ? "" : "s"} filtered as background noise
          </p>
          <p className="mt-0.5 text-[11px] text-white/25 leading-relaxed">
            Low-significance activity — not worth your attention today
          </p>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0"
        >
          <ChevronDown className="h-4 w-4 text-white/25" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.05] pt-4 sm:grid-cols-3">
              {noise.map((n) => (
                <div
                  key={n.symbol}
                  className="flex items-center justify-between rounded-xl bg-white/[0.025] border border-white/[0.05] px-3 py-2 text-[11px]"
                >
                  <span className="font-mono font-semibold text-white/40">{n.symbol}</span>
                  <span
                    className={
                      n.attention.priceChangePct >= 0
                        ? "text-[#48B586]/70 font-mono font-semibold tabular-nums"
                        : "text-[#F14D64]/70 font-mono font-semibold tabular-nums"
                    }
                  >
                    {formatPct(n.attention.priceChangePct)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
