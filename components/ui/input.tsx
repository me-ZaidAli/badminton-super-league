import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, ...props }, ref) => {
    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        if (type === "number" || type === "tel") {
          e.target.select();
        }
        onFocus?.(e);
      },
      [type, onFocus],
    );
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/35 transition-colors duration-150 outline-none focus-visible:border-cyan-400/50 focus-visible:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onFocus={handleFocus}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
