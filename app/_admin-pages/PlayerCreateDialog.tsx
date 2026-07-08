import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X, UserPlus, Zap } from "lucide-react";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ---------------------------------------------------------------------------
// CREATE PLAYER DIALOG — search a user, pick a club, optional auto-activate.
// Shared between the Players Database admin page and the per-club manager.
// Pass defaultClubId/defaultDivision to pre-select when opened from a club.
// ---------------------------------------------------------------------------
export function CreatePlayerDialog({
  clubs,
  onClose,
  onCreated,
  defaultClubId,
  defaultDivision,
}: any) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<any | null>(null);
  const [clubId, setClubId] = useState<number | "">(defaultClubId ?? "");
  const [division, setDivision] = useState<string>(defaultDivision ?? "");
  const [displayName, setDisplayName] = useState("");
  const [activate, setActivate] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Always populate the dropdown — empty search returns top 50 users so the
  // admin sees the full list immediately, then can type to filter.
  const { data: results, isLoading: searching } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/users/search", search],
    queryFn: async () => {
      const r = await fetch(
        `/api/bsl/admin/users/search?q=${encodeURIComponent(search)}`,
        { credentials: "include" },
      );
      if (!r.ok) return [];
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
    enabled: !picked,
  });

  // All (club × division) combinations, so a multi-division club appears once
  // per division it has actually joined.
  const clubDivisionOptions = (clubs || []).flatMap((c: any) => {
    const divs = Array.from(
      new Set(
        [
          c.division,
          ...(Array.isArray(c.additionalDivisions)
            ? c.additionalDivisions
            : []),
        ].filter(Boolean),
      ),
    );
    return divs.map((d: string) => ({
      id: c.id,
      name: c.name,
      division: d,
      key: `${c.id}::${d}`,
    }));
  });
  const selectedKey = clubId && division ? `${clubId}::${division}` : "";

  const create = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/bsl/admin/players", {
          userId: picked.id,
          bslClubId: Number(clubId),
          division,
          displayName: displayName || picked.fullName,
          activate,
        })
      ).json(),
    onSuccess: () => {
      toast({ title: "Player created" });
      onCreated();
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  const createUser = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/bsl/admin/users", newUser)).json(),
    onSuccess: (u: any) => {
      setPicked(u);
      setDisplayName(u.fullName || "");
      if (u.tempPassword) setTempPassword(u.tempPassword);
      setShowCreateUser(false);
      toast({
        title: "User account created",
        description: u.tempPassword
          ? `Temp password: ${u.tempPassword}`
          : "Account ready",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't create user",
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
        className="w-full max-w-xl rounded-2xl p-6"
        style={{
          background: BSL.card,
          border: `1px solid ${BSL.cyan}55`,
          boxShadow: `0 24px 64px hsla(222,80%,2%,0.6), 0 0 0 1px ${BSL.cyan}22`,
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="dialog-create-player"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black uppercase tracking-tight">
            Create player <span style={{ color: BSL.cyan }}>on behalf</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded"
            style={{ background: BSL.cardSoft }}
            data-testid="button-close-create-player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Section title="1. Pick the user account">
          {!picked ? (
            <>
              {!showCreateUser ? (
                <>
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type a name or email to filter…"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: BSL.cardSoft,
                      border: `1px solid ${BSL.border}`,
                      color: "white",
                    }}
                    data-testid="input-user-search"
                  />
                  <div
                    className="mt-2 max-h-60 overflow-y-auto rounded-lg"
                    style={{ border: `1px solid ${BSL.border}` }}
                  >
                    {searching && !results ? (
                      <div
                        className="px-3 py-3 text-xs"
                        style={{ color: BSL.faint }}
                      >
                        Loading users…
                      </div>
                    ) : (results || []).length === 0 ? (
                      <div
                        className="px-3 py-3 text-xs"
                        style={{ color: BSL.faint }}
                      >
                        {search
                          ? "No users match that search."
                          : "No users found."}
                      </div>
                    ) : (
                      (results || []).map((u: any) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setPicked(u);
                            setDisplayName(u.fullName || "");
                          }}
                          className="w-full text-left px-3 py-2 text-sm flex justify-between gap-2 hover:opacity-80"
                          style={{
                            background: BSL.cardSoft,
                            borderTop: `1px solid ${BSL.border}`,
                          }}
                          data-testid={`button-pick-user-${u.id}`}
                        >
                          <span className="font-bold truncate">
                            {u.fullName || u.email}
                          </span>
                          <span
                            className="text-xs truncate"
                            style={{ color: BSL.muted }}
                          >
                            {u.email}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateUser(true);
                      setNewUser({ fullName: search, email: "", password: "" });
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg"
                    style={{
                      background: `${BSL.gold}1f`,
                      color: BSL.gold,
                      border: `1px solid ${BSL.gold}55`,
                    }}
                    data-testid="button-show-create-user"
                  >
                    <UserPlus className="h-3 w-3" /> Can't find them? Create a
                    new user account
                  </button>
                </>
              ) : (
                <div
                  className="rounded-lg p-3 space-y-2"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.gold}55`,
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-widest font-black"
                    style={{ color: BSL.gold }}
                  >
                    New user account
                  </div>
                  <input
                    value={newUser.fullName}
                    onChange={(e) =>
                      setNewUser({ ...newUser, fullName: e.target.value })
                    }
                    placeholder="Full name *"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: BSL.card,
                      border: `1px solid ${BSL.border}`,
                      color: "white",
                    }}
                    data-testid="input-newuser-name"
                  />
                  <input
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser({ ...newUser, email: e.target.value })
                    }
                    type="email"
                    placeholder="Email *"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: BSL.card,
                      border: `1px solid ${BSL.border}`,
                      color: "white",
                    }}
                    data-testid="input-newuser-email"
                  />
                  <input
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    type="password"
                    autoComplete="new-password"
                    placeholder="Password (optional · auto-generated if blank, min 6 chars)"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: BSL.card,
                      border: `1px solid ${BSL.border}`,
                      color: "white",
                    }}
                    data-testid="input-newuser-password"
                  />
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => setShowCreateUser(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: BSL.card, color: BSL.muted }}
                      data-testid="button-cancel-newuser"
                    >
                      Cancel
                    </button>
                    <ActionButton
                      variant="gold"
                      icon={<UserPlus className="h-3 w-3" />}
                      onClick={() => createUser.mutate()}
                      disabled={
                        !newUser.fullName.trim() ||
                        !newUser.email.trim() ||
                        createUser.isPending
                      }
                      testid="button-create-newuser"
                    >
                      {createUser.isPending ? "Creating…" : "Create account"}
                    </ActionButton>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.cyan}55`,
              }}
            >
              <div>
                <div className="font-bold text-sm">
                  {picked.fullName || picked.email}
                </div>
                <div className="text-xs" style={{ color: BSL.muted }}>
                  {picked.email}
                </div>
                {tempPassword && (
                  <div className="text-[10px] mt-1" style={{ color: BSL.gold }}>
                    Temp password:{" "}
                    <span className="font-mono">{tempPassword}</span> — share
                    with player
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setPicked(null);
                  setTempPassword(null);
                }}
                className="text-xs underline"
                style={{ color: BSL.muted }}
                data-testid="button-change-user"
              >
                Change
              </button>
            </div>
          )}
        </Section>

        <Section title="2. Assign to a club + division">
          <select
            value={selectedKey}
            onChange={(e) => {
              const [cid, div] = e.target.value.split("::");
              if (!cid) {
                setClubId("");
                setDivision("");
                return;
              }
              setClubId(Number(cid));
              setDivision(div || "");
            }}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="select-create-player-club"
          >
            <option
              value=""
              style={{ background: BSL.cardSoft, color: "white" }}
            >
              — Pick a club + division —
            </option>
            {clubDivisionOptions.map((o) => (
              <option
                key={o.key}
                value={o.key}
                style={{ background: BSL.cardSoft, color: "white" }}
              >
                {o.name} · {o.division}
              </option>
            ))}
          </select>
          {clubDivisionOptions.length === 0 && (
            <div className="text-[10px] mt-1" style={{ color: BSL.muted }}>
              No clubs available — create one first.
            </div>
          )}
        </Section>

        <Section title="3. Display name (optional)">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Leave blank to use account name"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="input-create-player-name"
          />
        </Section>

        <button
          onClick={() => setActivate(!activate)}
          className="flex items-center justify-between p-3 rounded-lg text-sm font-bold w-full mb-4"
          style={{
            background: activate ? `${BSL.success}22` : BSL.cardSoft,
            border: `1px solid ${activate ? BSL.success : BSL.border}`,
            color: activate ? BSL.success : BSL.muted,
          }}
          data-testid="toggle-activate"
        >
          <span className="inline-flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" /> Auto-activate (skip payment)
          </span>
          {activate ? "ON" : "OFF"}
        </button>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: BSL.cardSoft, color: BSL.muted }}
            data-testid="button-cancel-create-player"
          >
            Cancel
          </button>
          <ActionButton
            variant="cyan"
            onClick={() => create.mutate()}
            disabled={!picked || !clubId || !division || create.isPending}
            icon={<UserPlus className="h-3 w-3" />}
            testid="button-confirm-create-player"
          >
            {create.isPending ? "Creating…" : "Create player"}
          </ActionButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="mb-4">
      <div
        className="text-[10px] uppercase tracking-widest font-black mb-2"
        style={{ color: BSL.cyan }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
