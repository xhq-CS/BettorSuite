export type SharedBetSource = "tracker" | "mock";

export interface SharedBetLeg {
  description: string;
  odds: number;
  sport: string;
  betType: string;
}

export interface SharedBetSnapshot {
  source: SharedBetSource;
  originalBetId: number;
  description: string;
  betType: string;
  sportsbook: string | null;
  wager: number;
  odds: number;
  parlayLegs: SharedBetLeg[];
  profitBoostPercent: number;
  potentialPayout: number;
  actualPayout: number | null;
  status: string;
  sport: string | null;
  placedAt: string;
  sharedAt: string;
}
