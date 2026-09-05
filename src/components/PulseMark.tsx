"use client";

import { motion } from "framer-motion";

// An original mark for PULSE: a circular badge with a live ECG-style pulse
// line running through it, rendered in the signal→pulse gradient. Inspired
// by the blue/teal duotone the user asked for, but an independent design —
// not a reproduction of any existing company's logo.
export function PulseMark({ size = 32, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pulseMarkGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C8CFF" />
          <stop offset="45%" stopColor="#5B6EF5" />
          <stop offset="100%" stopColor="#0BE39F" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#pulseMarkGrad)" fillOpacity="0.14" stroke="url(#pulseMarkGrad)" strokeWidth="1.4" />
      {animated ? (
        <motion.path
          d="M6 21 L13 21 L16 12 L21 29 L24 17 L27 21 L34 21"
          stroke="url(#pulseMarkGrad)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : (
        <path
          d="M6 21 L13 21 L16 12 L21 29 L24 17 L27 21 L34 21"
          stroke="url(#pulseMarkGrad)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </svg>
  );
}
