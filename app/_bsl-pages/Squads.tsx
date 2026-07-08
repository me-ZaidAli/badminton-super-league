import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/routing";
import { motion } from "framer-motion";
import { Users, ChevronRight, Moon } from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BslSubNav } from "@/components/BslSubNav";
import { BSL } from "@/components/bsl/BSLPalette";

interface SquadClub {
  id: number;
  name: string;
  logoUrl: string | null;
  division: string;
  additionalDivisions: string[];
  sleepingAt: string | null;
}

// Accent rotation kept strictly inside the locked BSL palette (gold / cyan).
const ACCENTS = [BSL.gold, BSL.cyan] as const;

function ClubTile({ club, index }: { club: SquadClub; index: number }) {
  const accent = ACCENTS[index % ACCENTS.length];
  const divisions = [club.division, ...(club.additionalDivisions || [])].filter(
    Boolean,
  );
  return (
    <Link href={`/squads/${club.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.45,
          delay: Math.min(index * 0.04, 0.4),
          ease: [0.16, 1, 0.3, 1],
        }}
        whileHover={{ y: -6, scale: 1.02 }}
        className="group relative cursor-pointer rounded-3xl overflow-hidden aspect-square flex flex-col items-center justify-center p-6"
        style={{
          background:
            "linear-gradient(150deg, hsla(222,40%,18%,0.92) 0%, hsla(222,50%,8%,0.96) 100%)",
          border: `1px solid ${accent}44`,
          boxShadow: `0 24px 60px -24px hsla(222,80%,2%,0.9), inset 0 1px 0 hsla(0,0%,100%,0.05)`,
        }}
        data-testid={`tile-squad-club-${club.id}`}
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${accent}22, transparent 70%)`,
          }}
        />
        <div
          className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-2xl flex items-center justify-center overflow-hidden mb-4"
          style={{
            background: "hsla(0,0%,100%,0.04)",
            border: `1px solid ${BSL.border}`,
          }}
        >
          {club.logoUrl ? (
            <img
              src={club.logoUrl}
              alt={club.name}
              className="h-full w-full object-contain p-1.5"
              data-testid={`img-squad-logo-${club.id}`}
            />
          ) : (
            <span className="text-3xl font-black" style={{ color: accent }}>
              {club.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="relative text-center">
          <div
            className="text-sm sm:text-base font-black uppercase tracking-tight text-white leading-tight"
            data-testid={`text-squad-name-${club.id}`}
          >
            {club.name}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
            {divisions.slice(0, 3).map((d) => (
              <span
                key={d}
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: `${accent}1f`, color: accent }}
              >
                {d}
              </span>
            ))}
            {club.sleepingAt && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1"
                style={{ background: `${BSL.muted}22`, color: BSL.muted }}
              >
                <Moon className="h-2.5 w-2.5" /> Sleeping
              </span>
            )}
          </div>
        </div>
        <div
          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: accent }}
        >
          <ChevronRight className="h-5 w-5" />
        </div>
      </motion.div>
    </Link>
  );
}

export default function Squads() {
  const { data: clubs, isLoading } = useQuery<SquadClub[]>({
    queryKey: ["/api/bsl/squads"],
  });

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <BslSubNav />
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
            style={{
              background: `${BSL.cyan}1a`,
              border: `1px solid ${BSL.cyan}44`,
            }}
          >
            <Users className="h-3.5 w-3.5" style={{ color: BSL.cyan }} />
            <span
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: BSL.cyan }}
            >
              Birmingham Super League
            </span>
          </div>
          <h1
            className="text-4xl sm:text-6xl font-black uppercase tracking-tight"
            style={{ textShadow: `0 6px 24px hsla(42,95%,55%,0.25)` }}
            data-testid="heading-meet-the-squads"
          >
            Meet The <span style={{ color: BSL.gold }}>Squads</span>
          </h1>
          <p
            className="mt-3 text-sm sm:text-base max-w-xl mx-auto"
            style={{ color: BSL.muted }}
          >
            Tap a club to see its players, line up by division.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl aspect-square animate-pulse"
                style={{ background: "hsla(222,40%,18%,0.6)" }}
              />
            ))}
          </div>
        ) : !clubs || clubs.length === 0 ? (
          <div
            className="text-center py-20 rounded-2xl"
            style={{
              background: "hsla(222,40%,12%,0.5)",
              border: `1px dashed ${BSL.border}`,
            }}
            data-testid="text-no-squads"
          >
            <Users
              className="h-10 w-10 mx-auto mb-3"
              style={{ color: BSL.faint }}
            />
            <div className="font-bold text-white">No active clubs yet</div>
            <div className="text-sm mt-1" style={{ color: BSL.muted }}>
              Clubs appear here once they're approved and active in the league.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
            {clubs.map((c, i) => (
              <ClubTile key={c.id} club={c} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
