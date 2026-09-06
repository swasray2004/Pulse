"use client";

import { motion } from "framer-motion";

export function PulseMark({
  size = 32,
  animated = true,
}: {
  size?: number;
  animated?: boolean;
}) {
  const content = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <defs>
        <clipPath id="growwCircleClip">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <g clipPath="url(#growwCircleClip)">
        {/* Top electric blue segment (#5367FE) */}
        <rect width="100" height="100" fill="#5367FE" />

        {/* Bottom vibrant cyan-mint trendline wave (#00F3BB) */}
        <path
          d="M -10 110 L -10 76 L 14 74 C 24 64 34 47 43 47 C 50 47 53 57 60 57 C 67 57 77 39 88 23 L 110 0 L 110 110 Z"
          fill="#00F3BB"
        />
      </g>
    </svg>
  );

  if (!animated) {
    return content;
  }

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="inline-flex items-center justify-center shrink-0"
    >
      {content}
    </motion.div>
  );
}

