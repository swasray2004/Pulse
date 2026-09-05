"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface NumberMorphProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

// Springs from the previous value to the new one whenever `value` changes —
// used for prices, attention scores, and the away-summary counters so state
// changes read as motion rather than a jump-cut.
export function NumberMorph({ value, decimals = 0, prefix = "", suffix = "", className }: NumberMorphProps) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 120, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(value.toFixed(decimals));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      motionValue.jump(value);
      setDisplay(value.toFixed(decimals));
      return;
    }
    motionValue.set(value);
  }, [value, decimals, motionValue]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(v.toFixed(decimals)));
    return unsub;
  }, [spring, decimals]);

  return (
    <motion.span className={className}>
      {prefix}
      {display}
      {suffix}
    </motion.span>
  );
}
