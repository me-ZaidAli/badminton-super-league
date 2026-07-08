import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Download, ImageIcon, FileImage, X } from "lucide-react";
import { BSL } from "./BSLPalette";

// Use VisuallyHidden styling for the a11y title we don't want to render.
const SR_ONLY: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

export type SnapshotPlayer = {
  id: number;
  name: string;
  grade?: string | null;
  avatarUrl?: string | null;
};

export type SnapshotPair = {
  pairLabel: string; // "Pair A"
  category: string; // "MD" | "WD" | "XD"
  categoryLong?: string; // "Men's Doubles"
  division: string; // "Premier Division"
  members: SnapshotPlayer[]; // 0–2
};

export type SnapshotClub = {
  name: string;
  logoUrl?: string | null;
  inviteCode?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pair: SnapshotPair;
  club: SnapshotClub;
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pair"
  );
}
function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function BslPairSnapshot({ open, onOpenChange, pair, club }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"png" | "jpg" | null>(null);

  async function download(kind: "png" | "jpg") {
    if (!cardRef.current) return;
    setBusy(kind);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: kind === "jpg" ? "#0a0f1f" : null,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });
      const mime = kind === "png" ? "image/png" : "image/jpeg";
      const ext = kind === "png" ? "png" : "jpg";
      const data = canvas.toDataURL(mime, kind === "jpg" ? 0.95 : undefined);
      const a = document.createElement("a");
      a.href = data;
      a.download = `bsl-${slugify(club.name)}-${slugify(pair.division)}-${pair.category}-${slugify(pair.pairLabel)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(null);
    }
  }

  const [p1, p2] = pair.members;
  const sub =
    pair.categoryLong ||
    (
      {
        MD: "Men's Doubles",
        WD: "Women's Doubles",
        XD: "Mixed Doubles",
      } as Record<string, string>
    )[pair.category] ||
    pair.category;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 border-0 overflow-hidden"
        style={{ background: BSL.bgDeep }}
        data-testid="dialog-pair-snapshot"
      >
        <DialogTitle style={SR_ONLY}>
          Team snapshot — {pair.pairLabel}
        </DialogTitle>

        {/* The actual snapshot card — html2canvas captures THIS node */}
        <div
          className="p-4 sm:p-6 flex items-center justify-center"
          style={{ background: BSL.bgDeep }}
        >
          <div
            ref={cardRef}
            className="relative w-full overflow-hidden"
            style={{
              aspectRatio: "16 / 10",
              borderRadius: 24,
              background: `
                radial-gradient(circle at 20% 0%, ${BSL.cyan}55, transparent 55%),
                radial-gradient(circle at 100% 100%, ${BSL.gold}44, transparent 55%),
                linear-gradient(135deg, ${BSL.bgDeep} 0%, ${BSL.card} 100%)
              `,
              border: `2px solid ${BSL.border}`,
              boxShadow: `0 30px 90px ${BSL.cyan}33, 0 0 0 1px ${BSL.gold}22 inset`,
              color: BSL.text,
            }}
          >
            {/* Diagonal court-line pattern */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.08,
                pointerEvents: "none",
                backgroundImage: `repeating-linear-gradient(45deg, ${BSL.gold} 0 1px, transparent 1px 22px)`,
              }}
            />
            {/* Big watermark "BSL" */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                right: -20,
                bottom: -40,
                fontSize: 240,
                fontWeight: 900,
                color: BSL.cyan,
                opacity: 0.06,
                letterSpacing: -8,
                lineHeight: 1,
                pointerEvents: "none",
              }}
            >
              BSL
            </div>

            {/* HEADER ── club logo + name + invite */}
            <div className="flex items-center gap-3 px-6 pt-5 relative">
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: BSL.cardSoft,
                  border: `1.5px solid ${BSL.gold}66`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {club.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={club.logoUrl}
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  <span
                    style={{ fontWeight: 900, color: BSL.gold, fontSize: 22 }}
                  >
                    {initials(club.name)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: 3,
                    color: BSL.cyan,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Birmingham Super League
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: BSL.text,
                    lineHeight: 1.1,
                    marginTop: 2,
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {club.name}
                </div>
              </div>
              <div className="text-right" style={{ flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: BSL.faint,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  Division
                </div>
                <div style={{ fontSize: 13, color: BSL.gold, fontWeight: 800 }}>
                  {pair.division}
                </div>
              </div>
            </div>

            {/* DIVIDER glow */}
            <div
              className="mx-6 my-3"
              style={{
                height: 1,
                background: `linear-gradient(90deg, transparent, ${BSL.cyan}88, transparent)`,
              }}
            />

            {/* CATEGORY BADGE */}
            <div className="px-6 flex items-center gap-3">
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: 4,
                  color: BSL.bgDeep,
                  background: `linear-gradient(135deg, ${BSL.gold}, ${BSL.bronze})`,
                  padding: "6px 14px",
                  borderRadius: 8,
                  boxShadow: `0 4px 18px ${BSL.gold}66`,
                }}
              >
                {pair.category}
              </span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: BSL.text }}>
                  {sub}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: BSL.muted,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                  }}
                >
                  {pair.pairLabel}
                </div>
              </div>
            </div>

            {/* PLAYERS — two big columns + VS */}
            <div className="px-6 mt-4 relative flex items-stretch gap-4">
              <PlayerColumn player={p1} accent={BSL.cyan} />
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 900,
                  letterSpacing: 2,
                  color: BSL.gold,
                  textShadow: `0 4px 30px ${BSL.gold}88`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 70,
                  flexShrink: 0,
                }}
              >
                &amp;
              </div>
              <PlayerColumn player={p2} accent={BSL.gold} />
            </div>

            {/* FOOTER */}
            <div
              className="absolute left-0 right-0 bottom-0 px-6 py-3 flex items-center justify-between"
              style={{
                borderTop: `1px solid ${BSL.border}`,
                background: `${BSL.bgDeep}cc`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 2,
                  color: BSL.muted,
                  textTransform: "uppercase",
                }}
              >
                Official Pair Card
              </div>
              {club.inviteCode && (
                <div
                  style={{ fontSize: 10, color: BSL.faint, letterSpacing: 1.5 }}
                >
                  Club code:{" "}
                  <span style={{ color: BSL.gold, fontWeight: 700 }}>
                    {club.inviteCode}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar — outside the snapshot capture node */}
        <div
          className="px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3"
          style={{ background: BSL.card, borderTop: `1px solid ${BSL.border}` }}
        >
          <div style={{ fontSize: 12, color: BSL.muted }}>
            Download as image to share or print.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => download("png")}
              disabled={!!busy}
              data-testid="button-snapshot-png"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm disabled:opacity-50 transition-all hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(135deg, ${BSL.cyan}, ${BSL.cyanDim})`,
                color: BSL.bgDeep,
                boxShadow: `0 6px 18px ${BSL.cyan}55`,
              }}
            >
              {busy === "png" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              PNG
            </button>
            <button
              type="button"
              onClick={() => download("jpg")}
              disabled={!!busy}
              data-testid="button-snapshot-jpg"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm disabled:opacity-50 transition-all hover:-translate-y-0.5"
              style={{
                background: `linear-gradient(135deg, ${BSL.gold}, ${BSL.goldDim})`,
                color: BSL.bgDeep,
                boxShadow: `0 6px 18px ${BSL.gold}55`,
              }}
            >
              {busy === "jpg" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileImage className="h-4 w-4" />
              )}
              JPG
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              data-testid="button-snapshot-close"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm"
              style={{ color: BSL.muted, border: `1px solid ${BSL.border}` }}
            >
              <X className="h-4 w-4" /> Close
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlayerColumn({
  player,
  accent,
}: {
  player: SnapshotPlayer | undefined;
  accent: string;
}) {
  const empty = !player;
  return (
    <div
      className="flex-1 min-w-0 p-4"
      style={{
        background: BSL.card,
        borderRadius: 16,
        border: `1.5px solid ${empty ? BSL.border : `${accent}55`}`,
        boxShadow: empty ? "none" : `0 0 20px ${accent}22 inset`,
        minHeight: 150,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          overflow: "hidden",
          background: BSL.cardSoft,
          border: `2px solid ${empty ? BSL.border : accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        {player?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatarUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span
            style={{
              color: empty ? BSL.faint : accent,
              fontWeight: 900,
              fontSize: 22,
            }}
          >
            {empty ? "?" : initials(player!.name)}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: empty ? BSL.faint : BSL.text,
          textAlign: "center",
          lineHeight: 1.15,
          wordBreak: "break-word",
        }}
      >
        {empty ? "Slot open" : player!.name}
      </div>
      {player?.grade && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.5,
            color: accent,
            textTransform: "uppercase",
            padding: "2px 8px",
            borderRadius: 999,
            border: `1px solid ${accent}55`,
          }}
        >
          Grade {player.grade}
        </div>
      )}
    </div>
  );
}

// Re-export the icon used in trigger buttons for caller convenience
export { Download as SnapshotIcon };
