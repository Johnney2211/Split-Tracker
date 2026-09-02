export class SplitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SplitValidationError';
  }
}

export type CalculatedSplit = {
  userId: string;
  amountOwed: string;
  percentage: string | null;
};

export type PercentageParticipant = {
  userId: string;
  percentage: number;
};

export type ExactParticipant = {
  userId: string;
  amount: number;
};

const CENT_FACTOR = 100;
const SUM_TOLERANCE = 0.01;

export function toCents(amount: number): number {
  return Math.round(amount * CENT_FACTOR);
}

export function fromCents(cents: number): string {
  return (cents / CENT_FACTOR).toFixed(2);
}

export function formatSum(value: number): string {
  const rounded = Math.round(value * CENT_FACTOR) / CENT_FACTOR;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function assertValidUserIds(userIds: string[]): void {
  if (userIds.length === 0) {
    throw new SplitValidationError('At least one participant is required');
  }

  const unique = new Set(userIds);
  if (unique.size !== userIds.length) {
    throw new SplitValidationError('Each participant can only appear once');
  }
}

function assertPositiveTotal(totalAmount: number): void {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new SplitValidationError('Total amount must be greater than 0');
  }
}

function largestRemainderAllocation(totalCents: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum === 0) {
    throw new SplitValidationError('Split weights must be greater than 0');
  }

  const rawShares = weights.map((weight) => (totalCents * weight) / weightSum);
  const floors = rawShares.map((share) => Math.floor(share));
  const remainder = totalCents - floors.reduce((sum, value) => sum + value, 0);

  const order = rawShares
    .map((share, index) => ({ index, fraction: share - floors[index]! }))
    .sort((a, b) => b.fraction - a.fraction);

  const allocated = [...floors];
  for (let i = 0; i < remainder; i += 1) {
    const next = order[i];
    if (!next) break;
    allocated[next.index] = (allocated[next.index] ?? 0) + 1;
  }

  return allocated;
}

export function calculateEqualSplits(totalAmount: number, userIds: string[]): CalculatedSplit[] {
  assertPositiveTotal(totalAmount);
  assertValidUserIds(userIds);

  const totalCents = toCents(totalAmount);
  const weights = userIds.map(() => 1);
  const allocated = largestRemainderAllocation(totalCents, weights);

  return userIds.map((userId, index) => ({
    userId,
    amountOwed: fromCents(allocated[index] ?? 0),
    percentage: null,
  }));
}

export function calculatePercentageSplits(
  totalAmount: number,
  participants: PercentageParticipant[],
): CalculatedSplit[] {
  assertPositiveTotal(totalAmount);
  assertValidUserIds(participants.map((participant) => participant.userId));

  for (const participant of participants) {
    if (!Number.isFinite(participant.percentage) || participant.percentage < 0) {
      throw new SplitValidationError('Percentages must be zero or greater');
    }
  }

  const percentageSum = participants.reduce((sum, participant) => sum + participant.percentage, 0);
  if (Math.abs(percentageSum - 100) > SUM_TOLERANCE) {
    throw new SplitValidationError(`Percentages must sum to 100, got ${formatSum(percentageSum)}`);
  }

  const totalCents = toCents(totalAmount);
  const allocated = largestRemainderAllocation(
    totalCents,
    participants.map((participant) => participant.percentage),
  );

  return participants.map((participant, index) => ({
    userId: participant.userId,
    amountOwed: fromCents(allocated[index] ?? 0),
    percentage: participant.percentage.toFixed(2),
  }));
}

export function calculateExactSplits(
  totalAmount: number,
  participants: ExactParticipant[],
): CalculatedSplit[] {
  assertPositiveTotal(totalAmount);
  assertValidUserIds(participants.map((participant) => participant.userId));

  for (const participant of participants) {
    if (!Number.isFinite(participant.amount) || participant.amount < 0) {
      throw new SplitValidationError('Amounts must be zero or greater');
    }
  }

  const amountSum = participants.reduce((sum, participant) => sum + participant.amount, 0);
  if (Math.abs(amountSum - totalAmount) > SUM_TOLERANCE) {
    throw new SplitValidationError(
      `Amounts must sum to ${totalAmount.toFixed(2)}, got ${amountSum.toFixed(2)}`,
    );
  }

  return participants.map((participant) => ({
    userId: participant.userId,
    amountOwed: fromCents(toCents(participant.amount)),
    percentage: null,
  }));
}

export type ItemizedItemInput = {
  itemName: string;
  itemAmount: number;
  participantIds: string[];
};

export type CalculatedItemShare = {
  userId: string;
  shareAmount: string;
};

export type CalculatedItem = {
  itemName: string;
  itemAmount: string;
  shares: CalculatedItemShare[];
};

/**
 * Result of an itemized expense calculation.
 *
 * `items`  → persisted as ExpenseItem + ExpenseItemShare (audit / receipt detail)
 * `splits` → persisted as ExpenseSplit (the only thing balance/debt logic should read)
 */
export type ItemizedCalculation = {
  items: CalculatedItem[];
  splits: CalculatedSplit[];
};

/**
 * Break an expense into line items, split each item evenly among its participants,
 * then roll those item-level shares up into one ExpenseSplit row per user.
 *
 * Aggregation (the important part):
 *   1. For each line item, reuse equal-split remainder logic so that item's cents
 *      are fully allocated across its participantIds (no leftover pennies).
 *   2. Add each participant's shareAmount into a running per-user total (in cents).
 *   3. After all items are processed, emit one CalculatedSplit per user whose
 *      amountOwed is that running total.
 *
 * Downstream balance calculations never need to understand itemization — they
 * only read the aggregated ExpenseSplit rows produced here.
 */
export function calculateItemizedSplits(
  totalAmount: number,
  items: ItemizedItemInput[],
): ItemizedCalculation {
  assertPositiveTotal(totalAmount);

  if (items.length === 0) {
    throw new SplitValidationError('At least one line item is required');
  }

  const itemAmountSum = items.reduce((sum, item) => sum + item.itemAmount, 0);
  if (Math.abs(itemAmountSum - totalAmount) > SUM_TOLERANCE) {
    throw new SplitValidationError(
      `Item amounts must sum to ${totalAmount.toFixed(2)}, got ${itemAmountSum.toFixed(2)}`,
    );
  }

  // Running total of what each user owes across every line item, tracked in cents
  // so we never accumulate floating-point drift between items.
  const owedCentsByUser = new Map<string, number>();
  const calculatedItems: CalculatedItem[] = [];

  items.forEach((item, index) => {
    if (!item.itemName.trim()) {
      throw new SplitValidationError(`Item ${index + 1} must have a name`);
    }
    if (!Number.isFinite(item.itemAmount) || item.itemAmount <= 0) {
      throw new SplitValidationError(`Item ${index + 1} amount must be greater than 0`);
    }
    assertValidUserIds(item.participantIds);

    // Step 1 — equal-split this single item across its assigned participants
    // (same remainder logic as EQUAL expenses).
    const itemSplits = calculateEqualSplits(item.itemAmount, item.participantIds);
    const shares: CalculatedItemShare[] = itemSplits.map((split) => ({
      userId: split.userId,
      shareAmount: split.amountOwed,
    }));

    // Step 2 — fold this item's shares into the per-user aggregate.
    // If Alex owes $3 on pizza and $2 on drinks, their ExpenseSplit will be $5.
    for (const share of shares) {
      const shareCents = toCents(Number(share.shareAmount));
      owedCentsByUser.set(share.userId, (owedCentsByUser.get(share.userId) ?? 0) + shareCents);
    }

    calculatedItems.push({
      itemName: item.itemName.trim(),
      itemAmount: fromCents(toCents(item.itemAmount)),
      shares,
    });
  });

  // Step 3 — emit final ExpenseSplit rows from the aggregated cents map.
  const splits: CalculatedSplit[] = [...owedCentsByUser.entries()].map(([userId, cents]) => ({
    userId,
    amountOwed: fromCents(cents),
    percentage: null,
  }));

  return { items: calculatedItems, splits };
}
