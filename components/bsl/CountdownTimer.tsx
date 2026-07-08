import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BSL } from "./BSLPalette";

function diff(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { d, h, m, s };
}

export function CountdownTimer({
  target,
}: {
  target: Date | string | null | undefined;
}) {
  const tgt = target ? new Date(target) : null;
  const [t, setT] = useState(() =>
    tgt ? diff(tgt) : { d: 0, h: 0, m: 0, s: 0 },
  );
  useEffect(() => {
    if (!tgt) return;
    const i = setInterval(() => setT(diff(tgt)), 1000);
    return () => clearInterval(i);
  }, [target]);
  if (!tgt)
    return (
      <div className="text-xs" style={{ color: BSL.muted }}>
        No league day scheduled
      </div>
    );
  const cell = (label: string, value: number) => (
    <div
      className="flex flex-col items-center"
      data-testid={`countdown-${label}`}
    >
      <motion.div
        key={value}
        initial={{ scale: 1.15, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="font-mono text-3xl md:text-4xl font-black tabular-nums"
        style={{ color: BSL.gold, textShadow: `0 0 24px ${BSL.gold}66` }}
      >
        {String(value).padStart(2, "0")}
      </motion.div>
      <div
        className="text-[10px] uppercase tracking-[0.3em] mt-1"
        style={{ color: BSL.muted }}
      >
        {label}
      </div>
    </div>
  );
  return (
    <div className="flex items-center gap-3 md:gap-5">
      {cell("days", t.d)}
      <div className="text-2xl font-thin" style={{ color: BSL.faint }}>
        :
      </div>
      {cell("hrs", t.h)}
      <div className="text-2xl font-thin" style={{ color: BSL.faint }}>
        :
      </div>
      {cell("min", t.m)}
      <div className="text-2xl font-thin" style={{ color: BSL.faint }}>
        :
      </div>
      {cell("sec", t.s)}
    </div>
  );
}
