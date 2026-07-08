// BSL TypeScript types – mirrors the shape returned by /api/bsl/* endpoints.
// Defined independently of Drizzle so the bsl-hub app has no schema dependency.

export type BslPaymentStatus =
  "PENDING_PAYMENT" | "PENDING_VERIFICATION" | "ACTIVE" | "REJECTED";
export type BslFixtureStatus = "SCHEDULED" | "WARMUP" | "LIVE" | "FINISHED";
export type BslRubberType = "MS1" | "MS2" | "WS" | "MD" | "WD" | "XD";
export type BslWalletTxType = "TOPUP" | "DEDUCTION";
export type BslWalletTxStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface BslLeague {
  id: number;
  name: string;
  tagline: string | null;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  clubFee: number;
  playerFee: number;
  nextLeagueDay: string | null;
  venueName: string | null;
  divisions: string[];
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  matchFormat: string;
  courtCount: number;
  notificationsEnabled: boolean;
  brandingPrimary: string | null;
  brandingAccent: string | null;
  categoryFees: Record<string, number>;
  divisionJoinFeePence: number;
  topupPackages: Array<{
    id: string;
    label: string;
    amountPence: number;
    sortOrder?: number;
  }>;
  topupDiscountPcts: number[];
  playerGrades: Array<{ code: string; label: string; sortOrder: number }>;
  divisionGrades: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface BslClub {
  id: number;
  clubId: number | null;
  name: string;
  managerUserId: number;
  logoUrl: string | null;
  division: string;
  additionalDivisions: string[];
  teamCount: number;
  categories: string[] | null;
  categoryPairs: Record<string, number> | null;
  paymentReference: string;
  paymentProofUrl: string | null;
  paymentAmountPence: number | null;
  paymentDate: string | null;
  payerAccountName: string | null;
  inviteCode: string | null;
  status: BslPaymentStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedById: number | null;
  isFlagged: boolean;
  isSuspended: boolean;
  adminNotes: string | null;
  withdrawnAt: string | null;
  sleepingAt: string | null;
  adminUserIds: number[];
  createdAt: string;
}

export interface BslPlayer {
  id: number;
  userId: number;
  bslTeamId: number | null;
  bslClubId: number | null;
  paymentReference: string;
  paymentProofUrl: string | null;
  paymentAmountPence: number | null;
  paymentDate: string | null;
  payerAccountName: string | null;
  status: BslPaymentStatus;
  walletBalance: number;
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedById: number | null;
  matchesPlayed: number;
  matchesWon: number;
  pointsScored: number;
  warnings: number;
  isSuspended: boolean;
  matchBanCount: number;
  disciplineNotes: string | null;
  displayName: string | null;
  bio: string | null;
  categories: string[];
  grade: string | null;
  division: string | null;
  confirmedByOwnerAt: string | null;
  createdAt: string;
}

export interface BslTeam {
  id: number;
  bslClubId: number;
  bslFixtureId: number | null;
  name: string;
  division: string;
  category: string | null;
  pairNumber: number | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  rubbersFor: number;
  rubbersAgainst: number;
  points: number;
  captainPlayerId: number | null;
  createdAt: string;
}

export interface BslTeamMember {
  id: number;
  bslTeamId: number;
  bslPlayerId: number;
  createdAt: string;
}

export interface BslSquadMember {
  id: number;
  bslClubId: number;
  bslPlayerId: number | null;
  division: string | null;
  name: string;
  photoUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface BslLeagueDay {
  id: number;
  bslLeagueId: number;
  date: string;
  status: string;
  state: string;
  division: string | null;
  category: string | null;
  rubbersPerFixture: number | null;
  venue: string | null;
  notes: string | null;
  maxMatches: number | null;
  createdAt: string;
}

export interface BslFixture {
  id: number;
  bslLeagueDayId: number | null;
  category: string | null;
  version: number;
  rulesSnapshot: unknown;
  walkoverWinner: string | null;
  liveStartedAt: string | null;
  livePausedAt: string | null;
  homeClubId: number | null;
  awayClubId: number | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  court: number | null;
  startTime: string | null;
  status: BslFixtureStatus;
  homeRubbers: number;
  awayRubbers: number;
  createdAt: string;
}

export interface BslRubber {
  id: number;
  bslFixtureId: number;
  rubberNumber: number;
  rubberType: BslRubberType;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homePlayer1Id: number | null;
  homePlayer2Id: number | null;
  awayPlayer1Id: number | null;
  awayPlayer2Id: number | null;
  homeScore: number;
  awayScore: number;
  setScores: unknown;
  walkoverWinner: string | null;
  status: BslFixtureStatus;
  createdAt: string;
}

export interface BslWalletTransaction {
  id: number;
  bslPlayerId: number;
  type: BslWalletTxType;
  amount: number;
  status: BslWalletTxStatus;
  proofUrl: string | null;
  paymentDate: string | null;
  payerAccountName: string | null;
  reference: string;
  description: string | null;
  reviewedById: number | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface BslPrize {
  id: number;
  bslLeagueId: number;
  season: string | null;
  division: string | null;
  category: string | null;
  rank: number;
  tier: string;
  title: string;
  subtitle: string | null;
  prizeText: string;
  prizeAmountPence: number | null;
  icon: string | null;
  accentColor: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BslChallenge {
  id: number;
  bslLeagueId: number;
  challengerClubId: number;
  opponentClubId: number;
  leagueDayId: number;
  status: string;
  numMatches: number;
  message: string | null;
  createdById: number;
  createdAt: string;
  respondedById: number | null;
  respondedAt: string | null;
}

export interface BslCategorySettings {
  id: number;
  bslLeagueId: number;
  category: string;
  rubbersPerFixture: number;
  rubberLineup: string[];
  setsPerMatch: number;
  pointsPerSet: number;
  scoringRule: string;
  deuceCap: number;
  format: string;
  courtPool: number[];
  walkoverPolicy: string;
  walkoverScore: number;
  tiebreakOrder: string[];
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  notes: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface BslMedia {
  id: number;
  url: string;
  caption: string | null;
  taggedClubId: number | null;
  taggedPlayerId: number | null;
  isMvp: boolean;
  isFeatured: boolean;
  uploadedById: number | null;
  createdAt: string;
}

// User type (from main app's users table)
export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}
