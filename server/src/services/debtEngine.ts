import {
  calculateGroupBalances,
  type BalanceUser,
  type MemberBalance,
} from './balanceEngine.js';

const ZERO_TOLERANCE = 0.009;

export type SuggestedDebt = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  fromUser: BalanceUser;
  toUser: BalanceUser;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type WorkingBalance = {
  user: BalanceUser;
  /** Mutable remaining balance while we match debtors to creditors. */
  remaining: number;
};

/**
 * Greedy debt simplification over net balances.
 *
 * Given each person's net (positive = creditor / owed money, negative = debtor /
 * owes money), produce the fewest practical payments that bring everyone to ~0:
 *
 *   1. Split members into debtors (remaining < 0) and creditors (remaining > 0).
 *   2. Repeatedly pick the largest debtor (most negative) and largest creditor
 *      (most positive).
 *   3. Transfer amount = min(|debtor|, creditor) from debtor → creditor.
 *   4. Reduce both remainders; drop anyone who is ~zero; repeat.
 *
 * This operates only on nets — pairwise expense edges are ignored — so cycles
 * and chains collapse into fewer payments.
 */
export function simplifyDebts(balances: MemberBalance[]): SuggestedDebt[] {
  const working: WorkingBalance[] = balances.map((balance) => ({
    user: balance.user,
    remaining: roundMoney(balance.netBalance),
  }));

  const suggestions: SuggestedDebt[] = [];

  // Safety: at most n-1 meaningful transfers, but guard against infinite loops.
  const maxIterations = Math.max(working.length * working.length, 1);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const debtors = working
      .filter((entry) => entry.remaining < -ZERO_TOLERANCE)
      .sort((a, b) => a.remaining - b.remaining); // most negative first

    const creditors = working
      .filter((entry) => entry.remaining > ZERO_TOLERANCE)
      .sort((a, b) => b.remaining - a.remaining); // most positive first

    const debtor = debtors[0];
    const creditor = creditors[0];

    if (!debtor || !creditor) {
      break;
    }

    const amount = roundMoney(Math.min(Math.abs(debtor.remaining), creditor.remaining));
    if (amount <= ZERO_TOLERANCE) {
      break;
    }

    // Debtor pays creditor → debtor's remaining rises, creditor's falls.
    debtor.remaining = roundMoney(debtor.remaining + amount);
    creditor.remaining = roundMoney(creditor.remaining - amount);

    suggestions.push({
      fromUserId: debtor.user.id,
      toUserId: creditor.user.id,
      amount,
      fromUser: debtor.user,
      toUser: creditor.user,
    });
  }

  return suggestions;
}

/**
 * Load group balances, then return simplified settlement suggestions.
 * Throws GROUP_NOT_FOUND if the group does not exist.
 */
export async function calculateSimplifiedDebts(groupId: string): Promise<SuggestedDebt[]> {
  const balances = await calculateGroupBalances(groupId);
  return simplifyDebts(balances);
}
