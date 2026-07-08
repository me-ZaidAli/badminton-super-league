import { motion } from "framer-motion";
import { BSL } from "./BSLPalette";

interface Props {
  position: number;
  name: string;
  sub?: string;
  logo?: string | null;
  played: number;
  won: number;
  drawn?: number;
  lost: number;
  points: number;
  rubberDiff?: number;
}

export function LeaderRow({
  position,
  name,
  sub,
  logo,
  played,
  won,
  drawn = 0,
  lost,
  points,
  rubberDiff = 0,
}: Props) {
  const isTop = position <= 3;
  const posTone =
    position === 1
      ? BSL.gold
      : position === 2
        ? BSL.cyan
        : position === 3
          ? BSL.bronze
          : BSL.muted;
  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
      style={{
        background: isTop ? `${posTone}10` : "transparent",
        borderLeft: `3px solid ${isTop ? posTone : "transparent"}`,
      }}
      data-testid={`leader-row-${position}`}
    >
      <div
        className="w-7 text-center text-sm font-black tabular-nums"
        style={{
          color: posTone,
          textShadow: isTop ? `0 0 8px ${posTone}88` : undefined,
        }}
      >
        {position}
      </div>
      <div
        className="h-8 w-8 rounded-md shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold"
        style={{
          background: "hsla(0,0%,100%,0.06)",
          border: "1px solid hsla(0,0%,100%,0.1)",
          color: BSL.muted,
        }}
      >
        {logo ? (
          <img src={logo} alt="" className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-semibold truncate"
          style={{ color: BSL.text }}
        >
          {name}
        </div>
        {sub && (
          <div className="text-[10px] truncate" style={{ color: BSL.muted }}>
            {sub}
          </div>
        )}
      </div>
      <div
        className="hidden sm:flex items-center gap-3 text-[11px] tabular-nums"
        style={{ color: BSL.muted }}
      >
        <span>{played}P</span>
        <span style={{ color: BSL.success }}>{won}W</span>
        <span>{drawn}D</span>
        <span style={{ color: BSL.danger }}>{lost}L</span>
        <span style={{ color: rubberDiff >= 0 ? BSL.success : BSL.danger }}>
          {rubberDiff >= 0 ? "+" : ""}
          {rubberDiff}
        </span>
      </div>
      <div
        className="w-12 text-right text-base font-black tabular-nums"
        style={{ color: BSL.gold }}
      >
        {points}
      </div>
    </motion.div>
  );
}
