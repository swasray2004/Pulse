"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/primitives";

const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "priceSensitivity", label: "Price movement", hint: "How much raw price change should count" },
  { key: "volumeSensitivity", label: "Volume anomalies", hint: "Weight unusual trading volume" },
  { key: "relativePerformanceSensitivity", label: "Market outperformance", hint: "Weight beating the benchmark/sector" },
  { key: "eventSensitivity", label: "Earnings & news", hint: "Weight corroborating events" },
  { key: "breakoutSensitivity", label: "52-week highs/lows", hint: "Weight breakout-level moves" },
];

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getPreferences().then((r) =>
      setPrefs(
        r.preferences ?? {
          priceSensitivity: 0.5,
          volumeSensitivity: 0.5,
          newsSensitivity: 0.5,
          eventSensitivity: 0.7,
          relativePerformanceSensitivity: 0.5,
          breakoutSensitivity: 0.5,
        }
      )
    );
  }, []);

  async function update(key: string, value: number) {
    setPrefs((p) => (p ? { ...p, [key]: value } : p));
    setSaving(true);
    try {
      await api.updatePreferences({ [key]: value });
    } finally {
      setSaving(false);
    }
  }

  if (!prefs) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-white">What should PULSE pay attention to?</h1>
      <p className="mt-1 text-sm text-white/40">
        There&apos;s no universal definition of a meaningful change. These sensitivities shift your Attention
        Score toward what matters to you — within bounds, so preference alone can never manufacture a false
        signal.
      </p>

      <Card className="mt-6 space-y-6">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <div className="mb-1.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">{field.label}</p>
                <p className="text-xs text-white/35">{field.hint}</p>
              </div>
              <span className="font-mono text-xs text-white/50">{Math.round((prefs[field.key] ?? 0) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs[field.key] ?? 0.5}
              onChange={(e) => update(field.key, parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-signal-500"
            />
          </div>
        ))}
      </Card>

      <motion.p
        animate={{ opacity: saving ? 1 : 0 }}
        className="mt-3 text-right text-xs text-white/30"
      >
        Saving...
      </motion.p>
    </div>
  );
}
