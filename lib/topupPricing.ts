// Shared pricing engine for BSL wallet top-ups.
//
// Both the client (Wallet modal) and server (POST /api/bsl/wallet/topup) MUST
// use this function so the displayed total exactly matches what gets charged.
// The server recomputes from the click history rather than trusting the
// client's `total`, so the engine is the single source of truth.

export type TopupPackage = {
  id: string;
  label: string;
  amountPence: number;
  sortOrder?: number;
};

export type TopupLine = {
  rank: number; // 1-based click index
  packageId: string;
  label: string;
  basePence: number;
  discountPct: number; // 0-100
  finalPence: number;
};

export type TopupSummary = {
  lines: TopupLine[];
  packageSubtotalPence: number; // sum of basePence (before discount)
  discountPence: number; // total saved on packages
  packageTotalPence: number; // packageSubtotal − discount
  customPence: number; // additional manual amount (no discount)
  totalPence: number; // packageTotal + customPence
};

/** Discount % to apply to the Nth click (1-indexed). Beyond the table → 0. */
export function discountForRank(rank: number, discountPcts: number[]): number {
  if (rank < 1) return 0;
  const raw = discountPcts[rank - 1];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, raw));
}

/**
 * Apply a percentage discount to a pence amount. Rounds to the nearest penny.
 * `(100 - pct) / 100` then round — keeps 50% off £25 = £12.50 (1250p).
 */
export function applyDiscount(basePence: number, discountPct: number): number {
  const pct = Math.min(100, Math.max(0, discountPct));
  return Math.max(0, Math.round((basePence * (100 - pct)) / 100));
}

/**
 * Compute a top-up summary from an ordered list of package-id clicks. Each
 * entry in `clickHistory` is one selection (so [Adult, Adult, Junior] = three
 * line items with ranks 1,2,3). Returns line-by-line breakdown plus totals.
 */
export function computeTopup(
  clickHistory: string[],
  packages: TopupPackage[],
  discountPcts: number[],
  customAmountPence: number = 0,
): TopupSummary {
  const pkgById = new Map(packages.map((p) => [p.id, p]));
  const lines: TopupLine[] = [];
  let packageSubtotalPence = 0;
  let discountPence = 0;

  let rank = 0;
  for (const id of clickHistory) {
    const pkg = pkgById.get(id);
    if (!pkg) continue; // silently skip unknown packages (admin may have removed)
    rank += 1;
    const base = Math.max(0, Math.round(pkg.amountPence));
    const pct = discountForRank(rank, discountPcts);
    const final = applyDiscount(base, pct);
    packageSubtotalPence += base;
    discountPence += base - final;
    lines.push({
      rank,
      packageId: pkg.id,
      label: pkg.label,
      basePence: base,
      discountPct: pct,
      finalPence: final,
    });
  }

  const packageTotalPence = packageSubtotalPence - discountPence;
  const customPence = Math.max(
    0,
    Math.round(Number.isFinite(customAmountPence) ? customAmountPence : 0),
  );
  return {
    lines,
    packageSubtotalPence,
    discountPence,
    packageTotalPence,
    customPence,
    totalPence: packageTotalPence + customPence,
  };
}

/** Group line items by packageId for display: { id, label, qty, totalPence }. */
export function summariseByPackage(lines: TopupLine[]) {
  const map = new Map<
    string,
    {
      id: string;
      label: string;
      qty: number;
      basePence: number;
      finalPence: number;
    }
  >();
  for (const line of lines) {
    const cur = map.get(line.packageId);
    if (cur) {
      cur.qty += 1;
      cur.basePence += line.basePence;
      cur.finalPence += line.finalPence;
    } else {
      map.set(line.packageId, {
        id: line.packageId,
        label: line.label,
        qty: 1,
        basePence: line.basePence,
        finalPence: line.finalPence,
      });
    }
  }
  return Array.from(map.values());
}
