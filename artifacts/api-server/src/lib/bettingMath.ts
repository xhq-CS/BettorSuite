export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.ceil((decimal - 1) * 100);
  return -Math.floor(100 / (decimal - 1));
}

export function boostedAmericanOdds(odds: number, boostPercent = 0): number {
  const boostedDecimal =
    1 + (americanToDecimal(odds) - 1) * (1 + Math.max(0, Math.round(boostPercent)) / 100);
  return decimalToAmerican(boostedDecimal);
}

export function calculateTotalPayout(
  wager: number,
  odds: number,
  boostPercent = 0,
  payoutOverride?: number | null,
): number {
  if (payoutOverride !== null && payoutOverride !== undefined && Number.isFinite(payoutOverride)) {
    return roundMoney(payoutOverride);
  }
  const effectiveOdds = boostedAmericanOdds(odds, boostPercent);
  const profit =
    effectiveOdds > 0
      ? wager * (effectiveOdds / 100)
      : wager * (100 / Math.abs(effectiveOdds));
  return roundMoney(wager + profit);
}
