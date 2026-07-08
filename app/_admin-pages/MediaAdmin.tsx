import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Image as ImageIcon,
  Upload,
  Trophy,
  Star,
  Trash2,
  Pin,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function MediaAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [taggedClubId, setTaggedClubId] = useState("");
  const [taggedPlayerId, setTaggedPlayerId] = useState("");
  const [isMvp, setIsMvp] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  const { data: media } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/media"],
  });
  const { data: clubs } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/clubs"],
  });

  const upload = useMutation({
    mutationFn: async () => {
      const f = fileRef.current?.files?.[0];
      if (!f) throw new Error("Select a file");
      const fd = new FormData();
      fd.append("file", f);
      if (caption) fd.append("caption", caption);
      if (taggedClubId) fd.append("taggedClubId", taggedClubId);
      if (taggedPlayerId) fd.append("taggedPlayerId", taggedPlayerId);
      fd.append("isMvp", String(isMvp));
      fd.append("isFeatured", String(isFeatured));
      const r = await fetch("/api/bsl/admin/media", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message || "Upload failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/media"] });
      toast({ title: "Uploaded" });
      setCaption("");
      setTaggedClubId("");
      setTaggedPlayerId("");
      setIsMvp(false);
      setIsFeatured(false);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const update = useMutation({
    mutationFn: async (v: { id: number; data: any }) =>
      (
        await apiRequest("PATCH", `/api/bsl/admin/media/${v.id}`, v.data)
      ).json(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/media"] }),
  });
  const del = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/bsl/admin/media/${id}`, {})).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/media"] });
      toast({ title: "Deleted" });
    },
  });

  return (
    <AdminLayout active="media">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
          Media <span style={{ color: BSL.cyan }}>Hub</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: BSL.muted }}>
          Upload match photos · tag clubs/players · push featured + MVP to the
          main app
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-1">
          <GlowPanel
            title="Upload"
            tone="cyan"
            icon={<Upload className="h-4 w-4" />}
          >
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="w-full text-xs"
                data-testid="input-media-file"
              />
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption…"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                  color: "white",
                }}
                data-testid="input-caption"
              />
              <select
                value={taggedClubId}
                onChange={(e) => setTaggedClubId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                  color: "white",
                }}
                data-testid="select-tag-club"
              >
                <option value="">Tag club (optional)…</option>
                {(clubs || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                value={taggedPlayerId}
                onChange={(e) => setTaggedPlayerId(e.target.value)}
                placeholder="Tag player ID (optional)"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                  color: "white",
                }}
                data-testid="input-tag-player"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsMvp((v) => !v)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                  style={{
                    background: isMvp ? `${BSL.gold}33` : BSL.cardSoft,
                    color: isMvp ? BSL.gold : BSL.muted,
                    border: `1px solid ${isMvp ? BSL.gold : BSL.border}`,
                  }}
                  data-testid="toggle-mvp"
                >
                  <Trophy className="h-3 w-3" /> MVP
                </button>
                <button
                  onClick={() => setIsFeatured((v) => !v)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                  style={{
                    background: isFeatured ? `${BSL.cyan}33` : BSL.cardSoft,
                    color: isFeatured ? BSL.cyan : BSL.muted,
                    border: `1px solid ${isFeatured ? BSL.cyan : BSL.border}`,
                  }}
                  data-testid="toggle-featured"
                >
                  <Pin className="h-3 w-3" /> Featured
                </button>
              </div>
              <ActionButton
                variant="cyan"
                onClick={() => upload.mutate()}
                disabled={upload.isPending}
                icon={<Upload className="h-3 w-3" />}
              >
                {upload.isPending ? "Uploading…" : "Upload media"}
              </ActionButton>
            </div>
          </GlowPanel>
        </div>

        <div className="lg:col-span-2">
          <GlowPanel
            title="Library"
            subtitle={`${media?.length || 0} items`}
            tone="gold"
            icon={<ImageIcon className="h-4 w-4" />}
          >
            {!media?.length ? (
              <div
                className="py-10 text-center text-sm"
                style={{ color: BSL.muted }}
              >
                No media uploaded yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {media.map((m: any, i: number) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="group rounded-xl overflow-hidden relative"
                    style={{ border: `1px solid ${BSL.border}` }}
                    data-testid={`media-${m.id}`}
                  >
                    <img
                      src={m.url}
                      alt={m.caption || ""}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="absolute top-2 left-2 flex gap-1">
                      {m.isMvp && (
                        <span
                          className="text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded"
                          style={{ background: BSL.gold, color: BSL.bgDeep }}
                        >
                          MVP
                        </span>
                      )}
                      {m.isFeatured && (
                        <span
                          className="text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded"
                          style={{ background: BSL.cyan, color: BSL.bgDeep }}
                        >
                          FEAT
                        </span>
                      )}
                    </div>
                    <div
                      className="absolute inset-x-0 bottom-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        background:
                          "linear-gradient(to top, hsla(222,60%,2%,0.95), transparent)",
                      }}
                    >
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            update.mutate({
                              id: m.id,
                              data: { isMvp: !m.isMvp },
                            })
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1 rounded"
                          style={{ background: BSL.gold, color: BSL.bgDeep }}
                          data-testid={`button-mvp-${m.id}`}
                        >
                          <Trophy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() =>
                            update.mutate({
                              id: m.id,
                              data: { isFeatured: !m.isFeatured },
                            })
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1 rounded"
                          style={{ background: BSL.cyan, color: BSL.bgDeep }}
                          data-testid={`button-feat-${m.id}`}
                        >
                          <Star className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() =>
                            confirm("Delete this media?") && del.mutate(m.id)
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1 rounded"
                          style={{ background: BSL.danger, color: "white" }}
                          data-testid={`button-del-${m.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </GlowPanel>
        </div>
      </div>
    </AdminLayout>
  );
}
