import { useState, useRef, useEffect } from "react";
import { Link, useRoute } from "@/lib/routing";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  LinkIcon,
  Image as ImageIcon,
  ExternalLink,
  Save,
  Camera,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BslSubNav } from "@/components/BslSubNav";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// A unified squad card. `kind: "player"` = auto-listed from the club's real
// registered roster (a curated overlay may add a photo/link). `kind: "manual"`
// = a free-text guest card not tied to a user account.
interface SquadCard {
  key: string;
  kind: "player" | "manual";
  playerId: number | null;
  squadMemberId: number | null;
  division: string | null;
  name: string;
  photoUrl: string | null;
  linkUrl: string | null;
}
interface SquadData {
  club: {
    id: number;
    name: string;
    logoUrl: string | null;
    division: string;
    additionalDivisions: string[];
    sleepingAt: string | null;
  };
  divisions: string[];
  members: SquadCard[];
  canManage: boolean;
}

const inputStyle: React.CSSProperties = {
  background: BSL.cardSoft,
  border: `1px solid ${BSL.border}`,
  color: "white",
};
const UNGROUPED = "__ungrouped__";

// Shared image picker — paste a URL or upload a file (uploads via the club's
// squad-image endpoint, which returns a stored /files/ url).
function ImagePicker({
  clubId,
  value,
  onChange,
  label,
}: {
  clubId: number;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  async function handleFile(f: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`/api/bsl/clubs/${clubId}/squad-image`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!r.ok)
        throw new Error(
          (await r.json().catch(() => ({}))).message || "Upload failed",
        );
      const data = await r.json();
      onChange(data.url);
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }
  return (
    <div>
      <label
        className="text-[10px] uppercase tracking-widest font-bold block mb-1"
        style={{ color: BSL.muted }}
      >
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div
          className="h-16 w-16 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
          style={{
            background: "hsla(0,0%,100%,0.04)",
            border: `1px solid ${BSL.border}`,
          }}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5" style={{ color: BSL.faint }} />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… (paste image URL)"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={inputStyle}
            data-testid="input-image-url"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
              style={{
                background: `${BSL.cyan}1f`,
                color: BSL.cyan,
                border: `1px solid ${BSL.cyan}55`,
              }}
              data-testid="button-upload-image"
            >
              <Upload className="h-3 w-3" />{" "}
              {uploading ? "Uploading…" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-xs font-bold"
                style={{ color: BSL.muted }}
                data-testid="button-clear-image"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// A horizontal scroller of player cards with left/right arrows. The arrows
// appear only when the row overflows and disable at each end.
function DivisionRow({
  items,
  canManage,
  accent,
  onEdit,
  onDelete,
}: {
  items: SquadCard[];
  canManage: boolean;
  accent: string;
  onEdit: (m: SquadCard) => void;
  onDelete: (m: SquadCard) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length]);

  const scrollBy = (dir: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.max(el.clientWidth * 0.8, 220),
      behavior: "smooth",
    });
  };

  const arrowStyle: React.CSSProperties = {
    background: "hsla(222,60%,6%,0.92)",
    color: accent,
    border: `1px solid ${accent}66`,
    boxShadow: `0 8px 24px -8px hsla(222,80%,2%,0.9)`,
  };
  return (
    <div className="relative">
      {canLeft && (
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll left"
          className="hidden sm:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 h-10 w-10 rounded-full"
          style={arrowStyle}
          data-testid="button-scroll-left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="bsl-hscroll flex gap-5 sm:gap-6 overflow-x-auto pb-2 snap-x"
        style={{ scrollPaddingLeft: 8 }}
      >
        {items.map((m) => (
          <div
            key={m.key}
            className="snap-start shrink-0 w-[44vw] sm:w-44 md:w-48 max-w-[220px]"
          >
            <PlayerCard
              card={m}
              canManage={canManage}
              accent={accent}
              onEdit={() => onEdit(m)}
              onDelete={() => onDelete(m)}
            />
          </div>
        ))}
      </div>
      {canRight && (
        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll right"
          className="hidden sm:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 h-10 w-10 rounded-full"
          style={arrowStyle}
          data-testid="button-scroll-right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function MemberEditor({
  clubId,
  divisions,
  card,
  defaultDivision,
  onClose,
}: {
  clubId: number;
  divisions: string[];
  card: SquadCard | null;
  defaultDivision: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isPlayer = card?.kind === "player";
  const [name, setName] = useState(card?.name || "");
  const [division, setDivision] = useState<string>(
    card?.division ?? defaultDivision ?? (divisions[0] || ""),
  );
  const [photoUrl, setPhotoUrl] = useState(card?.photoUrl || "");
  const [linkUrl, setLinkUrl] = useState(card?.linkUrl || "");

  const save = useMutation({
    mutationFn: async () => {
      const body: any = {
        name: name.trim(),
        division: division || null,
        photoUrl: photoUrl || null,
        linkUrl: linkUrl || null,
      };
      // Player card → upsert a photo/link overlay keyed to the real player.
      if (isPlayer && card?.playerId) {
        body.bslPlayerId = card.playerId;
        return (
          await apiRequest(
            "POST",
            `/api/bsl/clubs/${clubId}/squad-members`,
            body,
          )
        ).json();
      }
      // Existing manual card → patch it; new manual card → create it.
      if (card?.squadMemberId)
        return (
          await apiRequest(
            "PATCH",
            `/api/bsl/squad-members/${card.squadMemberId}`,
            body,
          )
        ).json();
      return (
        await apiRequest("POST", `/api/bsl/clubs/${clubId}/squad-members`, body)
      ).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/squads", clubId] });
      toast({ title: card ? "Player updated" : "Player added" });
      onClose();
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "hsla(222,60%,2%,0.85)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: BSL.card, border: `1px solid ${BSL.gold}55` }}
        onClick={(e) => e.stopPropagation()}
        data-testid="dialog-member-editor"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black uppercase tracking-tight">
            {card ? "Edit Player" : "Add Player"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded"
            style={{ background: BSL.cardSoft }}
            data-testid="button-close-editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label
              className="text-[10px] uppercase tracking-widest font-bold block mb-1"
              style={{ color: BSL.muted }}
            >
              Player name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Carter"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={inputStyle}
              data-testid="input-member-name"
            />
            {isPlayer && (
              <p className="text-[10px] mt-1" style={{ color: BSL.faint }}>
                This player is from your registered roster. Editing the name
                here only changes how it shows on the squad page.
              </p>
            )}
          </div>
          <div>
            <label
              className="text-[10px] uppercase tracking-widest font-bold block mb-1"
              style={{ color: BSL.muted }}
            >
              Division
            </label>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={inputStyle}
              data-testid="select-member-division"
            >
              {divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="">Unassigned</option>
            </select>
          </div>
          <ImagePicker
            clubId={clubId}
            value={photoUrl}
            onChange={setPhotoUrl}
            label="Player photo"
          />
          <div>
            <label
              className="text-[10px] uppercase tracking-widest font-bold block mb-1 inline-flex items-center gap-1"
              style={{ color: BSL.muted }}
            >
              <LinkIcon className="h-3 w-3" /> Photo link (optional)
            </label>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://… (clicking the photo opens this)"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={inputStyle}
              data-testid="input-member-link"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: BSL.cardSoft, color: BSL.muted }}
              data-testid="button-cancel-editor"
            >
              Cancel
            </button>
            <ActionButton
              variant="gold"
              loading={save.isPending}
              disabled={!name.trim()}
              onClick={() => save.mutate()}
              icon={<Save className="h-3 w-3" />}
            >
              Save
            </ActionButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PlayerCard({
  card,
  canManage,
  accent,
  onEdit,
  onDelete,
}: {
  card: SquadCard;
  canManage: boolean;
  accent: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const photo = card.photoUrl ? (
    <img
      src={card.photoUrl}
      alt={card.name}
      className="h-full w-full object-cover"
      data-testid={`img-player-${card.key}`}
    />
  ) : (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{ background: "hsla(0,0%,100%,0.04)" }}
    >
      <span className="text-2xl font-black" style={{ color: accent }}>
        {card.name.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative w-full"
    >
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          aspectRatio: "3 / 4",
          background: "hsla(222,40%,14%,0.8)",
          border: `1px solid ${accent}44`,
          boxShadow: `0 16px 40px -20px hsla(222,80%,2%,0.9)`,
        }}
      >
        {card.linkUrl ? (
          <a
            href={card.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
            data-testid={`link-player-${card.key}`}
          >
            {photo}
            <span
              className="absolute top-2 right-2 p-1 rounded-md"
              style={{ background: "hsla(222,60%,4%,0.7)", color: accent }}
            >
              <ExternalLink className="h-3 w-3" />
            </span>
          </a>
        ) : (
          photo
        )}
        <div
          className="absolute inset-x-0 bottom-0 p-2.5 pt-6"
          style={{
            background:
              "linear-gradient(180deg, transparent, hsla(222,70%,3%,0.92))",
          }}
        >
          <div
            className="text-sm font-black text-white leading-tight truncate"
            data-testid={`text-player-name-${card.key}`}
          >
            {card.name}
          </div>
        </div>
        {canManage && (
          <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-md"
              style={{ background: "hsla(222,60%,4%,0.8)", color: BSL.cyan }}
              data-testid={`button-edit-player-${card.key}`}
            >
              <Pencil className="h-3 w-3" />
            </button>
            {card.kind === "manual" && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-md"
                style={{
                  background: "hsla(222,60%,4%,0.8)",
                  color: BSL.danger,
                }}
                data-testid={`button-delete-player-${card.key}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function SquadDetail() {
  const [, params] = useRoute<{ id: string }>("/bsl/squads/:id");
  const clubId = Number(params?.id);
  const { toast } = useToast();
  const { data, isLoading } = useQuery<SquadData>({
    queryKey: ["/api/bsl/squads", clubId],
    enabled: Number.isFinite(clubId),
  });

  const [editing, setEditing] = useState<{
    card: SquadCard | null;
    division: string | null;
  } | null>(null);
  const [editLogo, setEditLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  const del = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/bsl/squad-members/${id}`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/squads", clubId] });
      toast({ title: "Player removed" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });
  const saveLogo = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("PATCH", `/api/bsl/clubs/${clubId}/manage`, {
          logoUrl: logoUrl || null,
        })
      ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/squads", clubId] });
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/squads"] });
      setEditLogo(false);
      toast({ title: "Club logo updated" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  const club = data?.club;
  const canManage = !!data?.canManage;
  const divisions = data?.divisions || [];
  // Group members by division; collect any ungrouped ones into their own row.
  const members = data?.members || [];
  const byDivision: { key: string; label: string; items: SquadCard[] }[] = [];
  for (const d of divisions)
    byDivision.push({
      key: d,
      label: d,
      items: members.filter((m) => m.division === d),
    });
  const ungrouped = members.filter(
    (m) => !m.division || !divisions.includes(m.division),
  );
  if (ungrouped.length || (canManage && divisions.length === 0))
    byDivision.push({
      key: UNGROUPED,
      label: divisions.length ? "Squad" : "Squad",
      items: ungrouped,
    });

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <BslSubNav />
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <Link href="/squads">
          <button
            className="inline-flex items-center gap-1.5 text-sm font-bold mb-6"
            style={{ color: BSL.muted }}
            data-testid="button-back-squads"
          >
            <ArrowLeft className="h-4 w-4" /> All Squads
          </button>
        </Link>

        {isLoading ? (
          <div className="animate-pulse space-y-6">
            <div
              className="h-28 rounded-2xl"
              style={{ background: "hsla(222,40%,18%,0.6)" }}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl"
                  style={{
                    aspectRatio: "3/4",
                    background: "hsla(222,40%,18%,0.6)",
                  }}
                />
              ))}
            </div>
          </div>
        ) : !club ? (
          <div className="text-center py-20" data-testid="text-club-not-found">
            <div className="font-bold text-white">Club not found</div>
          </div>
        ) : (
          <>
            {/* Club header */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-3xl p-6 sm:p-8 mb-10 flex flex-col sm:flex-row items-center gap-5"
              style={{
                background:
                  "linear-gradient(140deg, hsla(222,40%,18%,0.9), hsla(222,50%,8%,0.95))",
                border: `1px solid ${BSL.gold}44`,
              }}
            >
              <div
                className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden flex items-center justify-center shrink-0"
                style={{
                  background: "hsla(0,0%,100%,0.04)",
                  border: `1px solid ${BSL.border}`,
                }}
              >
                {club.logoUrl ? (
                  <img
                    src={club.logoUrl}
                    alt={club.name}
                    className="h-full w-full object-contain p-2"
                    data-testid="img-club-logo"
                  />
                ) : (
                  <span
                    className="text-3xl font-black"
                    style={{ color: BSL.gold }}
                  >
                    {club.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                {canManage && (
                  <button
                    onClick={() => {
                      setLogoUrl(club.logoUrl || "");
                      setEditLogo(true);
                    }}
                    className="absolute inset-x-0 bottom-0 py-1 text-[10px] font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1"
                    style={{
                      background: "hsla(222,60%,4%,0.85)",
                      color: BSL.cyan,
                    }}
                    data-testid="button-edit-club-logo"
                  >
                    <Camera className="h-3 w-3" /> Logo
                  </button>
                )}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h1
                  className="text-3xl sm:text-5xl font-black uppercase tracking-tight"
                  data-testid="heading-club-name"
                >
                  {club.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                  {[club.division, ...(club.additionalDivisions || [])]
                    .filter(Boolean)
                    .map((d) => (
                      <span
                        key={d}
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                        style={{ background: `${BSL.gold}1f`, color: BSL.gold }}
                      >
                        {d}
                      </span>
                    ))}
                </div>
              </div>
            </motion.div>

            {/* Division rows */}
            <div className="space-y-12">
              {byDivision.map((group, gi) => {
                const accent = gi % 2 === 0 ? BSL.gold : BSL.cyan;
                return (
                  <section
                    key={group.key}
                    data-testid={`section-division-${group.key}`}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-7 w-1.5 rounded-full"
                          style={{ background: accent }}
                        />
                        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                          {group.label}{" "}
                          <span style={{ color: accent }}>Team</span>
                        </h2>
                      </div>
                      {canManage && (
                        <button
                          onClick={() =>
                            setEditing({
                              card: null,
                              division:
                                group.key === UNGROUPED ? "" : group.label,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{
                            background: `${accent}1f`,
                            color: accent,
                            border: `1px solid ${accent}55`,
                          }}
                          data-testid={`button-add-player-${group.key}`}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Player
                        </button>
                      )}
                    </div>
                    {group.items.length === 0 ? (
                      <div
                        className="rounded-2xl py-12 text-center"
                        style={{
                          background: "hsla(222,40%,12%,0.4)",
                          border: `1px dashed ${BSL.border}`,
                        }}
                        data-testid={`empty-division-${group.key}`}
                      >
                        <span className="text-sm" style={{ color: BSL.muted }}>
                          No players added yet
                          {canManage ? " — use Add Player." : "."}
                        </span>
                      </div>
                    ) : (
                      <DivisionRow
                        items={group.items}
                        canManage={canManage}
                        accent={accent}
                        onEdit={(m) =>
                          setEditing({ card: m, division: m.division })
                        }
                        onDelete={(m) => {
                          if (m.squadMemberId && confirm(`Remove ${m.name}?`))
                            del.mutate(m.squadMemberId);
                        }}
                      />
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {editing && club && (
          <MemberEditor
            clubId={clubId}
            divisions={divisions}
            card={editing.card}
            defaultDivision={editing.division}
            onClose={() => setEditing(null)}
          />
        )}
        {editLogo && club && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: "hsla(222,60%,2%,0.85)",
              backdropFilter: "blur(8px)",
            }}
            onClick={() => setEditLogo(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md rounded-2xl p-6"
              style={{
                background: BSL.card,
                border: `1px solid ${BSL.gold}55`,
              }}
              onClick={(e) => e.stopPropagation()}
              data-testid="dialog-club-logo"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black uppercase tracking-tight">
                  Club Logo
                </h3>
                <button
                  onClick={() => setEditLogo(false)}
                  className="p-1.5 rounded"
                  style={{ background: BSL.cardSoft }}
                  data-testid="button-close-logo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ImagePicker
                clubId={clubId}
                value={logoUrl}
                onChange={setLogoUrl}
                label="Logo image (upload or URL)"
              />
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setEditLogo(false)}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: BSL.cardSoft, color: BSL.muted }}
                  data-testid="button-cancel-logo"
                >
                  Cancel
                </button>
                <ActionButton
                  variant="gold"
                  loading={saveLogo.isPending}
                  onClick={() => saveLogo.mutate()}
                  icon={<Save className="h-3 w-3" />}
                >
                  Save
                </ActionButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
