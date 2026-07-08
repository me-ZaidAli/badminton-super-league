import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { BSL } from "./BSLPalette";

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "gold",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "gold" | "cyan";
}) {
  const accent = tone === "gold" ? BSL.gold : BSL.cyan;
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="relative overflow-hidden rounded-xl px-4 py-4"
      style={{
        background:
          "linear-gradient(140deg, hsla(222,40%,18%,0.7), hsla(222,45%,10%,0.85))",
        border: `1px solid ${accent}33`,
      }}
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="pointer-events-none absolute -bottom-12 -right-8 h-24 w-24 rounded-full opacity-30 blur-2xl"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-2">
        <div
          className="text-[10px] uppercase tracking-[0.22em]"
          style={{ color: BSL.muted }}
        >
          {label}
        </div>
        {icon && (
          <div style={{ color: accent }} className="opacity-80">
            {icon}
          </div>
        )}
      </div>
      <div
        className="mt-2 text-2xl md:text-3xl font-black tabular-nums"
        style={{ color: BSL.text }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px]" style={{ color: BSL.muted }}>
          {sub}
        </div>
      )}
    </motion.div>
  );
}
