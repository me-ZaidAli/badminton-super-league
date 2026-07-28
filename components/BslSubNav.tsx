"use client";

import { usePathname, useRouter } from "next/navigation";
import NextLink from "next/link";
import { useUser, useLogout } from "@/hooks/use-auth";
import {
  Trophy,
  Wallet as WalletIcon,
  Users,
  User as UserIcon,
  Award,
  Settings,
  Swords,
  Medal,
  LogIn,
  LogOut,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type Item = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  match?: (path: string) => boolean;
  show?: boolean;
};

export function BslSubNav() {
  const { data: user } = useUser();
  const logout = useLogout();
  const router = useRouter();
  const pathname = usePathname();
  const u = user as any;

  const items: Item[] = [
    { href: "/", label: "League", icon: Trophy, match: (p) => p === "/" },
    { href: "/challenge-zone", label: "Challenge Zone", icon: Swords },
    { href: "/player-leaderboard", label: "Player Leaderboard", icon: Medal },
    {
      href: "/squads",
      label: "Squads",
      icon: Users,
      match: (p) => p === "/squads" || p.startsWith("/squads/"),
    },
    { href: "/results", label: "Results", icon: Award },
    { href: "/prizes", label: "Prize Vault", icon: Award },
    { href: "/wallet", label: "Wallet", icon: WalletIcon, show: !!u },
    { href: "/my-club", label: "My Club", icon: Users, show: !!u },
    { href: "/profile", label: "My Profile", icon: UserIcon, show: !!u },
    {
      href: "/admin",
      label: "Admin",
      icon: Settings,
      show: u?.role === "OWNER" || u?.role === "ADMIN",
      match: (p) => p.startsWith("/admin"),
    },
  ];

  const visible = items.filter((i) => i.show !== false);

  return (
    <nav
      className="sticky top-16 md:top-0 z-30 backdrop-blur-md border-b border-cyan-400/20 bg-[hsla(222,55%,4%,0.85)]"
      data-testid="subnav-bsl"
    >
      <div className="max-w-7xl mx-auto px-3 md:px-6">
        <div className="flex gap-1.5 overflow-x-auto py-2 scrollbar-thin">
          {visible.map((it) => {
            const active = it.match ? it.match(pathname) : pathname === it.href;
            const Icon = it.icon;
            return (
              <NextLink
                key={it.href}
                href={it.href}
                className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  active
                    ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.35)]"
                    : "border-cyan-400/20 text-cyan-200/70 hover:bg-cyan-500/10 hover:text-cyan-100"
                }`}
                data-testid={`subnav-link-${it.href.replace(/[^a-z0-9]+/gi, "-")}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{it.label}</span>
              </NextLink>
            );
          })}
          {u ? (
            <button
              type="button"
              onClick={() => logout.mutate(undefined, { onSuccess: () => router.push("/login") })}
              className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition border-cyan-400/20 text-cyan-200/70 hover:bg-cyan-500/10 hover:text-cyan-100"
              data-testid="subnav-link-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          ) : (
            <NextLink
              href="/login"
              className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition border-cyan-400/20 text-cyan-200/70 hover:bg-cyan-500/10 hover:text-cyan-100"
              data-testid="subnav-link-login"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </NextLink>
          )}
        </div>
      </div>
    </nav>
  );
}
