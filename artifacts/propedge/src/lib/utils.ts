import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculatePayout(wager: number, odds: number): number {
  if (!wager || !odds) return 0;
  let profit = 0;
  if (odds > 0) {
    profit = wager * (odds / 100);
  } else if (odds < 0) {
    profit = wager * (100 / Math.abs(odds));
  }
  return wager + profit;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatOdds(odds: number): string {
  if (!odds) return '';
  return odds > 0 ? `+${odds}` : `${odds}`;
}
