import { motion } from "framer-motion";
import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { BSL } from "./BSLPalette";

type Variant = "gold" | "cyan" | "ghost" | "danger";
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  testid?: string;
  children: ReactNode;
}

export function ActionButton({
  variant = "gold",
  icon,
  fullWidth,
  loading,
  children,
  className = "",
  disabled,
  testid,
  ...rest
}: Props) {
  const styles: Record<Variant, React.CSSProperties> = {
    gold: {
      background: `linear-gradient(135deg, ${BSL.gold}, ${BSL.goldDim})`,
      color: "hsl(222, 50%, 8%)",
      boxShadow: `0 8px 24px -8px ${BSL.gold}`,
    },
    cyan: {
      background: `linear-gradient(135deg, ${BSL.cyan}, ${BSL.cyanDim})`,
      color: "hsl(222, 50%, 8%)",
      boxShadow: `0 8px 24px -8px ${BSL.cyan}`,
    },
    ghost: {
      background: "hsla(0,0%,100%,0.06)",
      color: BSL.text,
      border: `1px solid hsla(0,0%,100%,0.15)`,
    },
    danger: {
      background: `linear-gradient(135deg, ${BSL.danger}, hsl(0,80%,40%))`,
      color: "white",
    },
  };
  return (
    <motion.button
      whileHover={!disabled && !loading ? { scale: 1.03, y: -1 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-wider transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""} ${className}`}
      style={styles[variant]}
      data-testid={testid}
      {...(rest as any)}
    >
      {loading && (
        <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {!loading && icon}
      <span>{children}</span>
    </motion.button>
  );
}
