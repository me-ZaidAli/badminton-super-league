"use client";

import { useUser } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BSL } from "@/components/bsl/BSLPalette";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const role = (user as any)?.role;
    if (!role || (role !== "OWNER" && role !== "ADMIN")) {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: BSL.bgDeep }}
      >
        <div
          className="animate-pulse text-sm uppercase tracking-widest"
          style={{ color: BSL.muted }}
        >
          Loading…
        </div>
      </div>
    );
  }

  const role = (user as any)?.role;
  if (!role || (role !== "OWNER" && role !== "ADMIN")) {
    return null;
  }

  return <>{children}</>;
}
