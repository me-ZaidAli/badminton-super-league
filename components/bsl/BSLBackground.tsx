import { motion } from "framer-motion";
// poster image moved to public
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const poster = "/bsl_poster.jpg";
import { BSL } from "./BSLPalette";

export function BSLBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: BSL.bgDeep }}
    >
      {/* Hero poster muted in background */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `url(${poster})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          filter: "saturate(1.1) blur(2px)",
        }}
      />
      {/* Vignette + wash */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% 0%, hsla(195,100%,60%,0.18), transparent 55%),
            radial-gradient(ellipse 100% 90% at 50% 100%, hsla(42,95%,55%,0.10), transparent 55%),
            linear-gradient(180deg, hsla(222,60%,4%,0.65) 0%, hsla(222,70%,3%,0.95) 100%)
          `,
        }}
      />
      {/* Drifting cyan light beams */}
      <motion.div
        className="absolute top-[-10%] left-[20%] h-[50vh] w-[2px]"
        style={{
          background: `linear-gradient(180deg, transparent, ${BSL.cyan}, transparent)`,
          transform: "rotate(15deg)",
          filter: "blur(1px)",
        }}
        animate={{ opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[-15%] right-[28%] h-[60vh] w-[3px]"
        style={{
          background: `linear-gradient(180deg, transparent, ${BSL.cyan}, transparent)`,
          transform: "rotate(-12deg)",
          filter: "blur(2px)",
        }}
        animate={{ opacity: [0.5, 0.15, 0.5] }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
      {/* Subtle grain */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  );
}
