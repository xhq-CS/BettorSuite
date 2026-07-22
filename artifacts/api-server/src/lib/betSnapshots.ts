import type {
  betsTable,
  simulatorBetsTable,
  SharedBetSnapshot,
} from "@workspace/db";

export function trackerBetSnapshot(
  bet: typeof betsTable.$inferSelect,
  sharedAt = new Date(),
): SharedBetSnapshot {
  return {
    source: "tracker",
    originalBetId: bet.id,
    description: bet.description,
    betType: bet.betType,
    sportsbook: bet.sportsbook ?? null,
    wager: Number(bet.wager),
    odds: Number(bet.odds),
    parlayLegs: bet.parlayLegs ?? [],
    profitBoostPercent: Number(bet.profitBoostPercent ?? 0),
    potentialPayout: Number(bet.potentialPayout),
    actualPayout:
      bet.actualPayout == null ? null : Number(bet.actualPayout),
    status: bet.status,
    sport: bet.sport ?? null,
    placedAt: bet.createdAt.toISOString(),
    sharedAt: sharedAt.toISOString(),
  };
}

export function mockBetSnapshot(
  bet: typeof simulatorBetsTable.$inferSelect,
  sharedAt = new Date(),
): SharedBetSnapshot {
  return {
    source: "mock",
    originalBetId: bet.id,
    description: bet.description,
    betType: bet.betType,
    sportsbook: null,
    wager: Number(bet.wager),
    odds: Number(bet.odds),
    parlayLegs: bet.parlayLegs ?? [],
    profitBoostPercent: Number(bet.profitBoostPercent ?? 0),
    potentialPayout: Number(bet.potentialPayout),
    actualPayout:
      bet.actualPayout == null ? null : Number(bet.actualPayout),
    status: bet.status,
    sport: bet.sport ?? null,
    placedAt: bet.createdAt.toISOString(),
    sharedAt: sharedAt.toISOString(),
  };
}
