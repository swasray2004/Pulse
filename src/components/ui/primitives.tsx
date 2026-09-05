"use client";

import { clsx } from "clsx";
import { motion } from "framer-motion";
import { ReactNode } from "react";

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={clsx(
        "glass rounded-2xl p-5 shadow-glass",
        hover && "transition-all duration-300 hover:border-white/15 hover:bg-ink-800/60",
        className
      )}
    >
      {children}
    </div>
  );
}

const BADGE_STYLES: Record<string, string> = {
  HIGH_ATTENTION: "bg-pulse-500/15 text-pulse-400 border-pulse-500/30",
  IMPORTANT: "bg-signal-500/15 text-signal-400 border-signal-500/30",
  INTERESTING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  NORMAL: "bg-white/5 text-white/40 border-white/10",
};

export function ClassificationBadge({ classification }: { classification: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        BADGE_STYLES[classification] ?? BADGE_STYLES.NORMAL
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {classification.replace("_", " ")}
    </span>
  );
}

export function StateBadge({ state }: { state: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/55">
      {state.replace(/_/g, " ")}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton rounded-xl", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex flex-col items-center gap-3 rounded-2xl px-8 py-16 text-center"
    >
      <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
      <p className="max-w-sm text-sm text-white/50">{description}</p>
      {action}
    </motion.div>
  );
}
