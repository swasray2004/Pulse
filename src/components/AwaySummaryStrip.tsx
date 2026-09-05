"use client";

import { motion } from "framer-motion";
import { NumberMorph } from "./NumberMorph";
import { Card } from "./ui/primitives";

interface AwaySummaryStripProps {
  awayLabel: string;
  totalMovements: number;
  meaningfulCount: number;
  filteredCount: number;
  isLongAbsence: boolean;
}

export function AwaySummaryStrip({
  awayLabel,
  totalMovements,
  meaningfulCount,
  filteredCount,
  isLongAbsence,
}: AwaySummaryStripProps) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
      <p className="font-display text-2xl font-semibold text-white sm:text-3xl">
        Your market changed <span className="text-gradient">while you were away.</span>
      </p>
      <p className="mt-1 text-sm text-white/40">
        {isLongAbsence ? "You were away for" : "Away for"}{" "}
        <span className="font-medium text-white/70">{awayLabel}</span>
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-xl">
        <Card className="!p-4">
          <p className="font-display text-2xl font-bold text-white">
            <NumberMorph value={totalMovements} />
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/35">Movements</p>
        </Card>
        <Card className="!p-4 border-pulse-500/20">
          <p className="font-display text-2xl font-bold text-pulse-400">
            <NumberMorph value={meaningfulCount} />
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/35">Deserve attention</p>
        </Card>
        <Card className="!p-4">
          <p className="font-display text-2xl font-bold text-white/40">
            <NumberMorph value={filteredCount} />
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/35">Filtered as noise</p>
        </Card>
      </div>
    </motion.div>
  );
}
