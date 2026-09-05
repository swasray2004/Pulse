"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { formatPct } from "@/lib/format";
import { Card } from "./ui/primitives";

interface NoiseEntry {
  symbol: string;
  companyName: string;
  attention: { priceChangePct: number };
}

export function SignalNoisePanel({ noise }: { noise: NoiseEntry[] }) {
  const [open, setOpen] = useState(false);
  if (noise.length === 0) return null;

  return (
    <Card className="mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-sm font-medium text-white/80">
            {noise.length} movement{noise.length === 1 ? "" : "s"} filtered as noise
          </p>
          <p className="mt-0.5 text-xs text-white/35">
            PULSE intentionally hides low-significance movements. The goal isn&apos;t to maximize
            information — it&apos;s to minimize unnecessary attention.
          </p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-white/40" />
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
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/5 pt-4 sm:grid-cols-3">
              {noise.map((n) => (
                <div
                  key={n.symbol}
                  className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2 text-xs"
                >
                  <span className="font-mono text-white/50">{n.symbol}</span>
                  <span className={n.attention.priceChangePct >= 0 ? "text-white/40" : "text-white/40"}>
                    {formatPct(n.attention.priceChangePct)} — Normal
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
