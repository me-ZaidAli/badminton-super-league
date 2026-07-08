import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  real,
  numeric,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", [
  "OWNER",
  "ADMIN",
  "ORGANISER",
  "COACH",
  "PLAYER",
]);
export const accountStatusEnum = pgEnum("account_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
]);
export const acquisitionSourceEnum = pgEnum("acquisition_source", [
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "WEBSITE",
  "WORD_OF_MOUTH",
  "LEISURE_CENTRE",
  "SAW_SESSION",
  "THROUGH_COACH",
  "REFERRAL",
  "OTHER",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").default("PLAYER").notNull(),
  secondaryRoles: text("secondary_roles")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  emailVerified: boolean("email_verified").default(false).notNull(),
  accountStatus: accountStatusEnum("account_status")
    .default("PENDING")
    .notNull(),
  claimedProfileId: integer("claimed_profile_id"),
  dateOfBirth: timestamp("date_of_birth"),
  isJunior: boolean("is_junior").default(false).notNull(),
  parentUserId: integer("parent_user_id"),
  phone: text("phone"),
  gender: text("gender"),
  parentGuardianName: text("parent_guardian_name"),
  parentGuardianEmail: text("parent_guardian_email"),
  emergencyContact: text("emergency_contact"),
  medicalNotes: text("medical_notes"),
  continent: text("continent"),
  country: text("country"),
  region: text("region"),
  city: text("city"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  closedAt: timestamp("closed_at"),
  closedReason: text("closed_reason"),
  profilePictureUrl: text("profile_picture_url"),
  nickname: text("nickname"),
  claimToken: text("claim_token"),
  claimTokenExpiry: timestamp("claim_token_expiry"),
  showPublicName: boolean("show_public_name").default(false).notNull(),
  displayMode: text("display_mode").default("light").notNull(),
  reducedMotion: boolean("reduced_motion").default(false).notNull(),
  dashboardBackground: text("dashboard_background").default("none"),
  fontFamily: text("font_family").default("inter"),
  fontMode: text("font_mode").default("all"),
  sidebarPin: text("sidebar_pin"),
  bottomNavItems: text("bottom_nav_items"),
  acquisitionSource: acquisitionSourceEnum("acquisition_source"),
  acquisitionSourceOther: text("acquisition_source_other"),
  lastActivityAt: timestamp("last_activity_at"),
  deletionScheduledAt: timestamp("deletion_scheduled_at"),
  deletionScheduledBy: integer("deletion_scheduled_by"),
  deletionReason: text("deletion_reason"),
  badmintonEnglandNumber: text("badminton_england_number"),
  blackCardAccess: boolean("black_card_access").default(false).notNull(),
  selectedAvatar: text("selected_avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bslPaymentStatusEnum = pgEnum("bsl_payment_status", [
  "PENDING_PAYMENT",
  "PENDING_VERIFICATION",
  "ACTIVE",
  "REJECTED",
]);
export const bslFixtureStatusEnum = pgEnum("bsl_fixture_status", [
  "SCHEDULED",
  "WARMUP",
  "LIVE",
  "FINISHED",
]);
export const bslRubberTypeEnum = pgEnum("bsl_rubber_type", [
  "MS1",
  "MS2",
  "WS",
  "MD",
  "WD",
  "XD",
]);
export const bslWalletTxTypeEnum = pgEnum("bsl_wallet_tx_type", [
  "TOPUP",
  "DEDUCTION",
]);
export const bslWalletTxStatusEnum = pgEnum("bsl_wallet_tx_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

// Singleton league configuration row (id always = 1)
export const bslLeagues = pgTable("bsl_leagues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Birmingham Super League"),
  tagline: text("tagline").default("Compete. Connect. Elevate."),
  // Bank details for transfers (admin-editable)
  bankAccountName: text("bank_account_name")
    .notNull()
    .default("Birmingham Super League Ltd"),
  bankSortCode: text("bank_sort_code").notNull().default("00-00-00"),
  bankAccountNumber: text("bank_account_number").notNull().default("00000000"),
  clubFee: integer("club_fee").notNull().default(50000), // in pence (£500)
  playerFee: integer("player_fee").notNull().default(2500), // in pence (£25)
  nextLeagueDay: timestamp("next_league_day"), // countdown target
  venueName: text("venue_name").default("One Central Venue, Birmingham"),
  divisions: text("divisions")
    .array()
    .notNull()
    .default(["Premier", "Championship", "Division 1"]),
  pointsWin: integer("points_win").notNull().default(3),
  pointsDraw: integer("points_draw").notNull().default(1),
  pointsLoss: integer("points_loss").notNull().default(0),
  matchFormat: text("match_format").notNull().default("6-RUBBER"),
  courtCount: integer("court_count").notNull().default(6),
  notificationsEnabled: boolean("notifications_enabled")
    .notNull()
    .default(true),
  brandingPrimary: text("branding_primary").default("hsl(42 95% 55%)"),
  brandingAccent: text("branding_accent").default("hsl(195 100% 60%)"),
  // Per-category player registration fees in pence (admin-editable in Settings).
  // Falls back to playerFee when a category is missing.
  categoryFees: jsonb("category_fees")
    .$type<Record<string, number>>()
    .notNull()
    .default({ MD: 2500, WD: 2500, XD: 3000 }),
  // Flat fee (pence) charged to a club for joining each ADDITIONAL division
  // beyond their primary one. Deducted from the requesting admin's player
  // wallet at the moment they confirm the join. £25 default.
  divisionJoinFeePence: integer("division_join_fee_pence")
    .notNull()
    .default(2500),
  // Top-up package buttons shown in the player Wallet modal. Each entry:
  // { id, label, amountPence, sortOrder? }. Admin-editable. Empty list disables
  // package buttons (custom-amount-only fallback).
  topupPackages: jsonb("topup_packages")
    .$type<
      Array<{
        id: string;
        label: string;
        amountPence: number;
        sortOrder?: number;
      }>
    >()
    .notNull()
    .default([]),
  // Discount percentages applied to the Nth package selected (by click order).
  // Default [0, 50, 70] = 1st full, 2nd 50% off, 3rd 70% off, 4th+ full again.
  // Length defines the discount tier ladder; values clamped 0-100.
  topupDiscountPcts: jsonb("topup_discount_pcts")
    .$type<number[]>()
    .notNull()
    .default([0, 50, 70]),
  // Admin-defined player grade catalogue. Each entry: { code, label, sortOrder }.
  // Default seeded in psql migration as A1/A2/B1/B2/C1/C2/C3.
  playerGrades: jsonb("player_grades")
    .$type<Array<{ code: string; label: string; sortOrder: number }>>()
    .notNull()
    .default([]),
  // Per-division allowed-grade restrictions: { "Premier": ["A1","A2"], "Division 1": ["B1","B2"], … }.
  // Empty array OR missing key = no restriction (any grade may join that division).
  divisionGrades: jsonb("division_grades")
    .$type<Record<string, string[]>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bslClubs = pgTable("bsl_clubs", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id"), // optional link to existing club (no FK in BSL hub)
  name: text("name").notNull(),
  managerUserId: integer("manager_user_id")
    .notNull()
    .references(() => users.id),
  logoUrl: text("logo_url"),
  division: text("division").notNull(),
  // Optional secondary/additional divisions a club has teams in. Primary
  // `division` stays the canonical one; this list lets a club appear in
  // multiple division standings + fixture pools without changing teamCount.
  additionalDivisions: text("additional_divisions")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  teamCount: integer("team_count").notNull().default(1),
  categories: text("categories")
    .array()
    .default(sql`ARRAY['MD']::text[]`),
  categoryPairs: jsonb("category_pairs")
    .$type<Record<string, number>>()
    .default({}),
  paymentReference: text("payment_reference").notNull().unique(), // e.g., "BSL-CLUB-XYZ123"
  paymentProofUrl: text("payment_proof_url"), // LEGACY — superseded by payment-details flow (Oct 2026). Kept for old rows.
  // Self-declared bank-transfer details (manager fills these in; admin cross-checks against bank statement on approval).
  paymentAmountPence: integer("payment_amount_pence"),
  paymentDate: date("payment_date"),
  payerAccountName: text("payer_account_name"),
  inviteCode: text("invite_code").unique(), // generated on approval
  status: bslPaymentStatusEnum("status").notNull().default("PENDING_PAYMENT"),
  rejectionReason: text("rejection_reason"),
  approvedAt: timestamp("approved_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  isFlagged: boolean("is_flagged").notNull().default(false),
  isSuspended: boolean("is_suspended").notNull().default(false),
  adminNotes: text("admin_notes"),
  // Owner-initiated withdrawal from the league. Non-null = club has stepped out.
  withdrawnAt: timestamp("withdrawn_at"),
  // Super-admin "Put to sleep". Non-null = club is archived but data preserved.
  // Public listings keep the club visible with a "Sleeping" badge.
  sleepingAt: timestamp("sleeping_at"),
  // Additional club admins (beyond managerUserId). Members of this list have
  // the SAME permissions as managerUserId on every BSL endpoint that uses
  // loadClubForManager(). Super admin or current managerUserId can edit.
  adminUserIds: integer("admin_user_ids")
    .array()
    .notNull()
    .default(sql`ARRAY[]::integer[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bslTeams = pgTable("bsl_teams", {
  id: serial("id").primaryKey(),
  bslClubId: integer("bsl_club_id")
    .notNull()
    .references(() => bslClubs.id, { onDelete: "cascade" }),
  // Match-scoped pairs (Task: fixture-specific pairs). NULL = a club-level pair
  // (the legacy default, shown in the club's "Pairs by category" grids and
  // reusable across fixtures). Non-null = a pair built for ONE specific fixture
  // and only surfaced on that fixture's setup screen. Forward-ref via callback
  // because bslFixtures is declared further down this file. ON DELETE CASCADE so
  // deleting a fixture cleans up its match-scoped pairs.
  bslFixtureId: integer("bsl_fixture_id").references(
    (): any => bslFixtures.id,
    { onDelete: "cascade" },
  ),
  name: text("name").notNull(),
  division: text("division").notNull(),
  category: text("category"),
  pairNumber: integer("pair_number").default(1),
  // Standings
  played: integer("played").notNull().default(0),
  won: integer("won").notNull().default(0),
  drawn: integer("drawn").notNull().default(0),
  lost: integer("lost").notNull().default(0),
  rubbersFor: integer("rubbers_for").notNull().default(0),
  rubbersAgainst: integer("rubbers_against").notNull().default(0),
  points: integer("points").notNull().default(0),
  // Per-team captain (nullable). Captain permissions are division-specific.
  // FK to bslPlayers via SET NULL — removing the player from the club blanks
  // the captain slot rather than cascading the team away. Forward-ref via
  // callback because bslPlayers is declared below this table.
  captainPlayerId: integer("captain_player_id").references(
    (): any => bslPlayers.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bslPlayers = pgTable("bsl_players", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  bslTeamId: integer("bsl_team_id").references(() => bslTeams.id, {
    onDelete: "set null",
  }),
  bslClubId: integer("bsl_club_id").references(() => bslClubs.id, {
    onDelete: "set null",
  }),
  paymentReference: text("payment_reference").notNull().unique(),
  paymentProofUrl: text("payment_proof_url"), // LEGACY — superseded by payment-details flow (Oct 2026).
  paymentAmountPence: integer("payment_amount_pence"),
  paymentDate: date("payment_date"),
  payerAccountName: text("payer_account_name"),
  status: bslPaymentStatusEnum("status").notNull().default("PENDING_PAYMENT"),
  walletBalance: integer("wallet_balance").notNull().default(0), // in pence
  rejectionReason: text("rejection_reason"),
  approvedAt: timestamp("approved_at"),
  approvedById: integer("approved_by_id").references(() => users.id),
  // Stats
  matchesPlayed: integer("matches_played").notNull().default(0),
  matchesWon: integer("matches_won").notNull().default(0),
  pointsScored: integer("points_scored").notNull().default(0),
  // Discipline
  warnings: integer("warnings").notNull().default(0),
  isSuspended: boolean("is_suspended").notNull().default(false),
  matchBanCount: integer("match_ban_count").notNull().default(0),
  disciplineNotes: text("discipline_notes"),
  // Player profile fields (editable by the player themselves at /bsl/profile)
  displayName: text("display_name"),
  bio: text("bio"),
  // Categories the player has registered (and paid) for. Subset of MD / WD / XD.
  categories: text("categories")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  // Player grade code from bslLeagues.playerGrades (e.g. "A1"/"B2"/"C3").
  // Null = ungraded — blocked from any division that has restrictions set.
  grade: text("grade"),
  // Which division (within the club) the player is assigned to. Required when
  // the club participates in more than one division (primary ∪ additionalDivisions).
  // Defaults to the club's primary division on create.
  division: text("division"),
  // Set when the BSL club owner confirms this player onto their roster.
  confirmedByOwnerAt: timestamp("confirmed_by_owner_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Pair / team membership join table — each bslTeams row holds at most 2 players.
export const bslTeamMembers = pgTable("bsl_team_members", {
  id: serial("id").primaryKey(),
  bslTeamId: integer("bsl_team_id")
    .notNull()
    .references(() => bslTeams.id, { onDelete: "cascade" }),
  bslPlayerId: integer("bsl_player_id")
    .notNull()
    .references(() => bslPlayers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BslTeamMember = typeof bslTeamMembers.$inferSelect;

// Curated "Meet the Squads" showcase roster — admin / club-admin maintained.
// Independent of bslPlayers (which is tied to user accounts, wallets, grading).
// Each row is one player card on a club's squad page; `division` decides which
// division row the card appears under (NULL/"" = ungrouped "Squad" row).
// `photoUrl` is an uploaded /files/ URL or a pasted external URL; `linkUrl` (when
// set) makes the photo a clickable link.
export const bslSquadMembers = pgTable(
  "bsl_squad_members",
  {
    id: serial("id").primaryKey(),
    bslClubId: integer("bsl_club_id")
      .notNull()
      .references(() => bslClubs.id, { onDelete: "cascade" }),
    // When set, this row is a photo/link OVERLAY for a real registered player
    // (bsl_players). When NULL, it's a standalone manual card (e.g. a guest not
    // yet in the system). The squad page auto-lists every active club player and
    // merges any matching overlay on top, so names appear without manual entry.
    bslPlayerId: integer("bsl_player_id").references(() => bslPlayers.id, {
      onDelete: "cascade",
    }),
    division: text("division"),
    name: text("name").notNull(),
    photoUrl: text("photo_url"),
    linkUrl: text("link_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // At most one overlay row per (club, player) so the auto-roster merge stays
    // 1:1. Partial — manual cards (bslPlayerId NULL) are unconstrained.
    uniquePlayerOverlay: uniqueIndex("bsl_squad_members_club_player_uq")
      .on(t.bslClubId, t.bslPlayerId)
      .where(sql`bsl_player_id IS NOT NULL`),
  }),
);
export const insertBslSquadMemberSchema = createInsertSchema(
  bslSquadMembers,
).omit({ id: true, createdAt: true });
export type BslSquadMember = typeof bslSquadMembers.$inferSelect;
export type InsertBslSquadMember = z.infer<typeof insertBslSquadMemberSchema>;

export const bslLeagueDays = pgTable("bsl_league_days", {
  id: serial("id").primaryKey(),
  bslLeagueId: integer("bsl_league_id")
    .notNull()
    .references(() => bslLeagues.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("UPCOMING"), // UPCOMING, LIVE, COMPLETED (legacy)
  // Lifecycle state machine: DRAFT → PUBLISHED → LIVE → CLOSED.
  // DRAFT = settings + fixtures fully editable. PUBLISHED = visible to clubs but
  // still editable by admin. LIVE = fixtures locked, only score input + walkover
  // allowed. CLOSED = standings finalised, no further edits.
  state: text("state").notNull().default("DRAFT"),
  division: text("division"),
  category: text("category"),
  rubbersPerFixture: integer("rubbers_per_fixture"),
  // Free-text venue / address shown on the public match-day card and in the
  // admin Match Days hub so each day can be hosted at a different location.
  venue: text("venue"),
  notes: text("notes"),
  // Challenge Zone: max number of inter-club challenge matches that can be
  // booked against this day. Null = unlimited. Each accepted/pending challenge
  // consumes `numMatches` slots.
  maxMatches: integer("max_matches"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Inter-club challenge requests scoped to a specific Match Day.
// Visible to all logged-in users; only club managers / club admins / team
// captains / platform OWNER+ADMIN can create or respond.
export const bslChallenges = pgTable("bsl_challenges", {
  id: serial("id").primaryKey(),
  bslLeagueId: integer("bsl_league_id").notNull().default(1),
  challengerClubId: integer("challenger_club_id")
    .notNull()
    .references(() => bslClubs.id, { onDelete: "cascade" }),
  opponentClubId: integer("opponent_club_id")
    .notNull()
    .references(() => bslClubs.id, { onDelete: "cascade" }),
  leagueDayId: integer("league_day_id")
    .notNull()
    .references(() => bslLeagueDays.id, { onDelete: "cascade" }),
  // PENDING | ACCEPTED | DECLINED | CANCELLED | COMPLETED
  status: text("status").notNull().default("PENDING"),
  // How many team-vs-team matches this challenge consumes on the day.
  numMatches: integer("num_matches").notNull().default(1),
  message: text("message"),
  createdById: integer("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedById: integer("responded_by_id").references(() => users.id),
  respondedAt: timestamp("responded_at"),
});
export type BslChallenge = typeof bslChallenges.$inferSelect;

// Per-category competition rules. Snapshot onto each fixture at generation
// time so mid-season rule changes don't retroactively rewrite finished games.
export const bslCategorySettings = pgTable(
  "bsl_category_settings",
  {
    id: serial("id").primaryKey(),
    bslLeagueId: integer("bsl_league_id")
      .notNull()
      .default(1)
      .references(() => bslLeagues.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // MD / WD / XD / custom
    rubbersPerFixture: integer("rubbers_per_fixture").notNull().default(6),
    rubberLineup: text("rubber_lineup")
      .array()
      .notNull()
      .default(sql`ARRAY['MD','MD','WD','WD','XD','XD']::text[]`),
    setsPerMatch: integer("sets_per_match").notNull().default(3),
    pointsPerSet: integer("points_per_set").notNull().default(21),
    scoringRule: text("scoring_rule").notNull().default("DEUCE"), // DEUCE | GOLDEN_POINT | RALLY
    deuceCap: integer("deuce_cap").notNull().default(30),
    format: text("format").notNull().default("ROUND_ROBIN"), // ROUND_ROBIN | KNOCKOUT | GROUPS
    courtPool: integer("court_pool")
      .array()
      .notNull()
      .default(sql`ARRAY[]::integer[]`),
    walkoverPolicy: text("walkover_policy").notNull().default("STANDARD"),
    walkoverScore: integer("walkover_score").notNull().default(21),
    // Order is significant — first non-tying value wins. Each token is one of:
    // POINTS, RUBBER_DIFF, RUBBERS_FOR, HEAD_TO_HEAD, MATCHES_WON.
    tiebreakOrder: text("tiebreak_order")
      .array()
      .notNull()
      .default(
        sql`ARRAY['POINTS','RUBBER_DIFF','RUBBERS_FOR','HEAD_TO_HEAD']::text[]`,
      ),
    pointsWin: integer("points_win").notNull().default(3),
    pointsDraw: integer("points_draw").notNull().default(1),
    pointsLoss: integer("points_loss").notNull().default(0),
    notes: text("notes"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Enforce one settings row per (league, category). Backed by
    // bsl_category_settings_league_cat_uq in the live DB.
    leagueCategoryUq: uniqueIndex("bsl_category_settings_league_cat_uq").on(
      t.bslLeagueId,
      t.category,
    ),
  }),
);

// Each Regenerate action archives the previous batch of fixtures (per
// league-day + division + category) into a versioned payload row so admins
// can audit / restore previous configurations without losing match history.
export const bslFixtureVersions = pgTable("bsl_fixture_versions", {
  id: serial("id").primaryKey(),
  bslLeagueId: integer("bsl_league_id").notNull().default(1),
  bslLeagueDayId: integer("bsl_league_day_id"),
  division: text("division"),
  category: text("category"),
  version: integer("version").notNull().default(1),
  reason: text("reason"),
  payload: jsonb("payload").notNull(),
  archivedById: integer("archived_by_id").references(() => users.id),
  archivedAt: timestamp("archived_at").defaultNow().notNull(),
});

export type BslCategorySettings = typeof bslCategorySettings.$inferSelect;
export type InsertBslCategorySettings = typeof bslCategorySettings.$inferInsert;
export type BslFixtureVersion = typeof bslFixtureVersions.$inferSelect;

export const bslFixtures = pgTable("bsl_fixtures", {
  id: serial("id").primaryKey(),
  bslLeagueDayId: integer("bsl_league_day_id").references(
    () => bslLeagueDays.id,
    { onDelete: "cascade" },
  ),
  // Category this fixture belongs to (MD/WD/XD or custom). Lets admins run
  // separate competitions per category with their own settings.
  category: text("category"),
  version: integer("version").notNull().default(1),
  // Snapshot of bslCategorySettings at generation time so subsequent edits
  // to the live settings don't retroactively change in-progress matches.
  rulesSnapshot: jsonb("rules_snapshot"),
  walkoverWinner: text("walkover_winner"), // NONE | HOME | AWAY
  liveStartedAt: timestamp("live_started_at"),
  livePausedAt: timestamp("live_paused_at"),
  // Club-vs-club fixture (preferred): admin allocates 2 clubs, then assigns
  // pairs into the 6 rubber slots inside the fixture. Legacy team-vs-team
  // fixtures (one pair vs one pair) remain supported via homeTeamId/awayTeamId
  // for back-compat with old round-robin generation.
  homeClubId: integer("home_club_id").references(() => bslClubs.id),
  awayClubId: integer("away_club_id").references(() => bslClubs.id),
  homeTeamId: integer("home_team_id").references(() => bslTeams.id),
  awayTeamId: integer("away_team_id").references(() => bslTeams.id),
  court: integer("court"), // null = unassigned, set by drag-drop
  startTime: timestamp("start_time"),
  status: bslFixtureStatusEnum("status").notNull().default("SCHEDULED"),
  homeRubbers: integer("home_rubbers").notNull().default(0),
  awayRubbers: integer("away_rubbers").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bslRubbers = pgTable("bsl_rubbers", {
  id: serial("id").primaryKey(),
  bslFixtureId: integer("bsl_fixture_id")
    .notNull()
    .references(() => bslFixtures.id, { onDelete: "cascade" }),
  rubberNumber: integer("rubber_number").notNull(), // 1..6
  rubberType: bslRubberTypeEnum("rubber_type").notNull(),
  // For club-vs-club fixtures: which pair from each club is playing this
  // rubber. Players are mirrored into homePlayer1/2 / awayPlayer1/2 below
  // so the existing match scoring + perspective resolver keeps working.
  homeTeamId: integer("home_team_id").references(() => bslTeams.id),
  awayTeamId: integer("away_team_id").references(() => bslTeams.id),
  homePlayer1Id: integer("home_player1_id").references(() => bslPlayers.id),
  homePlayer2Id: integer("home_player2_id").references(() => bslPlayers.id),
  awayPlayer1Id: integer("away_player1_id").references(() => bslPlayers.id),
  awayPlayer2Id: integer("away_player2_id").references(() => bslPlayers.id),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  // Per-set scores: array of { h: number, a: number } captured live.
  setScores: jsonb("set_scores"),
  walkoverWinner: text("walkover_winner"), // NONE | HOME | AWAY
  status: bslFixtureStatusEnum("status").notNull().default("SCHEDULED"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bslWalletTransactions = pgTable("bsl_wallet_transactions", {
  id: serial("id").primaryKey(),
  bslPlayerId: integer("bsl_player_id")
    .notNull()
    .references(() => bslPlayers.id, { onDelete: "cascade" }),
  type: bslWalletTxTypeEnum("type").notNull(),
  amount: integer("amount").notNull(), // in pence; positive
  status: bslWalletTxStatusEnum("status").notNull().default("PENDING"),
  proofUrl: text("proof_url"), // LEGACY — superseded by payment-details flow (Oct 2026).
  paymentDate: date("payment_date"),
  payerAccountName: text("payer_account_name"),
  reference: text("reference").notNull(),
  description: text("description"),
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bslPrizes = pgTable("bsl_prizes", {
  id: serial("id").primaryKey(),
  bslLeagueId: integer("bsl_league_id")
    .notNull()
    .default(1)
    .references(() => bslLeagues.id, { onDelete: "cascade" }),
  season: text("season"),
  division: text("division"),
  category: text("category"),
  rank: integer("rank").notNull().default(1),
  tier: text("tier").notNull().default("GOLD"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  prizeText: text("prize_text").notNull(),
  prizeAmountPence: integer("prize_amount_pence"),
  icon: text("icon"),
  accentColor: text("accent_color"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertBslPrizeSchema = createInsertSchema(bslPrizes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BslPrize = typeof bslPrizes.$inferSelect;
export type InsertBslPrize = z.infer<typeof insertBslPrizeSchema>;

export const insertBslLeagueSchema = createInsertSchema(bslLeagues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BslLeague = typeof bslLeagues.$inferSelect;
export type InsertBslLeague = z.infer<typeof insertBslLeagueSchema>;

export const insertBslClubSchema = createInsertSchema(bslClubs).omit({
  id: true,
  createdAt: true,
  paymentReference: true,
  status: true,
  inviteCode: true,
  approvedAt: true,
  approvedById: true,
  paymentProofUrl: true,
  rejectionReason: true,
});
export type BslClub = typeof bslClubs.$inferSelect;
export type InsertBslClub = z.infer<typeof insertBslClubSchema>;

export const insertBslTeamSchema = createInsertSchema(bslTeams).omit({
  id: true,
  createdAt: true,
  played: true,
  won: true,
  drawn: true,
  lost: true,
  rubbersFor: true,
  rubbersAgainst: true,
  points: true,
});
export type BslTeam = typeof bslTeams.$inferSelect;
export type InsertBslTeam = z.infer<typeof insertBslTeamSchema>;

export const insertBslPlayerSchema = createInsertSchema(bslPlayers).omit({
  id: true,
  createdAt: true,
  paymentReference: true,
  status: true,
  walletBalance: true,
  approvedAt: true,
  approvedById: true,
  paymentProofUrl: true,
  rejectionReason: true,
  matchesPlayed: true,
  matchesWon: true,
  pointsScored: true,
});
export type BslPlayer = typeof bslPlayers.$inferSelect;
export type InsertBslPlayer = z.infer<typeof insertBslPlayerSchema>;

export const insertBslFixtureSchema = createInsertSchema(bslFixtures).omit({
  id: true,
  createdAt: true,
  status: true,
  homeRubbers: true,
  awayRubbers: true,
});
export type BslFixture = typeof bslFixtures.$inferSelect;
export type InsertBslFixture = z.infer<typeof insertBslFixtureSchema>;

export type BslRubber = typeof bslRubbers.$inferSelect;
export type BslLeagueDay = typeof bslLeagueDays.$inferSelect;
export type BslWalletTransaction = typeof bslWalletTransactions.$inferSelect;

export const bslAuditLog = pgTable("bsl_audit_log", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id").references(() => users.id),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BslAuditEntry = typeof bslAuditLog.$inferSelect;

export const bslMedia = pgTable("bsl_media", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  caption: text("caption"),
  taggedClubId: integer("tagged_club_id").references(() => bslClubs.id, {
    onDelete: "set null",
  }),
  taggedPlayerId: integer("tagged_player_id").references(() => bslPlayers.id, {
    onDelete: "set null",
  }),
  isMvp: boolean("is_mvp").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  uploadedById: integer("uploaded_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BslMedia = typeof bslMedia.$inferSelect;

// === PUSH NOTIFICATIONS (OneSignal) ===
export const userPushSubscriptions = pgTable("user_push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  oneSignalPlayerId: text("onesignal_player_id").notNull(),
  platform: text("platform"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});
export type UserPushSubscription = typeof userPushSubscriptions.$inferSelect;

export const userNotificationPrefs = pgTable("user_notification_prefs", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  paymentReceived: boolean("payment_received").default(true).notNull(),
  waitlistPromoted: boolean("waitlist_promoted").default(true).notNull(),
  newSessionMatchingLevel: boolean("new_session_matching_level")
    .default(true)
    .notNull(),
  postSessionUnpaidReminder: boolean("post_session_unpaid_reminder")
    .default(true)
    .notNull(),
  adminAnnouncement: boolean("admin_announcement").default(true).notNull(),
  // Category × channel matrix. Shape: { "<Category>": { push?: bool, inapp?: bool, email?: bool } }
  // Missing entries default to true (opted-in). Categories match RULE_REGISTRY categories.
  categoryPrefs: jsonb("category_prefs").notNull().default({}),
  // Per-rule mute list. Any rule key present here is suppressed for this user
  // across both push + in-app channels (driven by the in-app "Don't ask again"
  // dismiss button on rule-keyed notifications).
  mutedRuleKeys: text("muted_rule_keys")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type UserNotificationPrefs = typeof userNotificationPrefs.$inferSelect;

// One-off scheduled notifications. Either rule-driven (ruleKey + vars) or
// ad-hoc (title + message). A cron sweeps pending rows whose scheduleAt is past.
export const notificationSchedules = pgTable("notification_schedules", {
  id: serial("id").primaryKey(),
  ruleKey: text("rule_key"),
  title: text("title"),
  message: text("message"),
  url: text("url"),
  segment: jsonb("segment").notNull(),
  vars: jsonb("vars").notNull().default({}),
  scheduleAt: timestamp("schedule_at").notNull(),
  status: text("status").notNull().default("pending"), // pending|sent|cancelled|failed
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
});
export type NotificationSchedule = typeof notificationSchedules.$inferSelect;

// Lightweight per-channel send analytics. One row per sendRulePush channel
// dispatch (after channel-pref filtering). Drives the admin stats panel.
export const notificationSendMetrics = pgTable("notification_send_metrics", {
  id: serial("id").primaryKey(),
  ruleKey: text("rule_key"),
  channel: text("channel").notNull(), // push|inapp|email
  recipientsCount: integer("recipients_count").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});
export type NotificationSendMetric =
  typeof notificationSendMetrics.$inferSelect;

export const pushSendLog = pgTable("push_send_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  category: text("category").notNull(),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});
export type PushSendLog = typeof pushSendLog.$inferSelect;

export const notificationRules = pgTable("notification_rules", {
  id: serial("id").primaryKey(),
  ruleKey: text("rule_key").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  category: text("category").notNull().default("General"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  settings: jsonb("settings").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export type NotificationRule = typeof notificationRules.$inferSelect;
