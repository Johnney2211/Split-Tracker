import prisma from '../lib/prisma.js';

export type BalanceUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type MemberBalance = {
  user: BalanceUser;
  /** Positive = others owe this user money; negative = this user owes money. */
  netBalance: number;
  totalPaid: number;
  totalOwed: number;
  totalSettledOut: number;
  totalSettledIn: number;
};

export type ExpenseBalanceInput = {
  paidBy: string;
  totalAmount: number;
  splits: Array<{ userId: string; amountOwed: number }>;
};

export type SettlementBalanceInput = {
  fromUser: string;
  toUser: string;
  amount: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Pure balance computation (unit-testable without a database).
 *
 * For each member:
 *   net = totalPaid - totalOwed + settledOut - settledIn
 *
 * where:
 *   - totalPaid  = sum of expense.totalAmount where they are the payer
 *   - totalOwed  = sum of their ExpenseSplit.amountOwed in the group
 *   - settledOut = settlements they paid to others (fromUser)
 *   - settledIn  = settlements others paid to them (toUser)
 *
 * Settlement direction: fromUser pays toUser. Paying a settlement reduces your
 * debt (balance moves toward zero from the negative side), so settledOut is
 * added. Receiving a settlement reduces what you are owed, so settledIn is
 * subtracted.
 *
 * Example: Alice paid $100 equally with Bob → Alice +50, Bob -50.
 * Bob then settles $50 to Alice → both end at 0.
 */
export function computeMemberBalances(
  members: BalanceUser[],
  expenses: ExpenseBalanceInput[],
  settlements: SettlementBalanceInput[],
): MemberBalance[] {
  const totals = new Map<
    string,
    { paid: number; owed: number; settledOut: number; settledIn: number }
  >();

  for (const member of members) {
    totals.set(member.id, { paid: 0, owed: 0, settledOut: 0, settledIn: 0 });
  }

  for (const expense of expenses) {
    const payer = totals.get(expense.paidBy);
    if (payer) {
      payer.paid = roundMoney(payer.paid + expense.totalAmount);
    }

    for (const split of expense.splits) {
      const debtor = totals.get(split.userId);
      if (debtor) {
        debtor.owed = roundMoney(debtor.owed + split.amountOwed);
      }
    }
  }

  for (const settlement of settlements) {
    const from = totals.get(settlement.fromUser);
    if (from) {
      from.settledOut = roundMoney(from.settledOut + settlement.amount);
    }

    const to = totals.get(settlement.toUser);
    if (to) {
      to.settledIn = roundMoney(to.settledIn + settlement.amount);
    }
  }

  return members.map((member) => {
    const entry = totals.get(member.id) ?? {
      paid: 0,
      owed: 0,
      settledOut: 0,
      settledIn: 0,
    };

    const netBalance = roundMoney(entry.paid - entry.owed + entry.settledOut - entry.settledIn);

    return {
      user: member,
      netBalance,
      totalPaid: entry.paid,
      totalOwed: entry.owed,
      totalSettledOut: entry.settledOut,
      totalSettledIn: entry.settledIn,
    };
  });
}

function decimalToNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

/**
 * Load group expenses + settlements and return each member's net balance.
 * Throws if the group does not exist.
 */
export async function calculateGroupBalances(groupId: string): Promise<MemberBalance[]> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      expenses: {
        include: {
          splits: true,
        },
      },
      settlements: true,
    },
  });

  if (!group) {
    throw new Error('GROUP_NOT_FOUND');
  }

  const members: BalanceUser[] = group.members.map((membership) => membership.user);

  const expenses: ExpenseBalanceInput[] = group.expenses.map((expense) => ({
    paidBy: expense.paidBy,
    totalAmount: decimalToNumber(expense.totalAmount),
    splits: expense.splits.map((split) => ({
      userId: split.userId,
      amountOwed: decimalToNumber(split.amountOwed),
    })),
  }));

  const settlements: SettlementBalanceInput[] = group.settlements.map((settlement) => ({
    fromUser: settlement.fromUser,
    toUser: settlement.toUser,
    amount: decimalToNumber(settlement.amount),
  }));

  return computeMemberBalances(members, expenses, settlements);
}
