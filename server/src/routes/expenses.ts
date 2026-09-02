import { SplitType } from '@prisma/client';
import { Router } from 'express';
import { isGroupMember } from '../lib/groups.js';
import prisma from '../lib/prisma.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  calculateEqualSplits,
  calculateExactSplits,
  calculateItemizedSplits,
  calculatePercentageSplits,
  SplitValidationError,
  type CalculatedSplit,
  type ItemizedItemInput,
} from '../services/splitCalculator.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

const SPLIT_TYPES = new Set<string>(['EQUAL', 'PERCENTAGE', 'EXACT', 'ITEMIZED']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
    return null;
  }
  return value.map((item) => item.trim());
}

type SplitInput = {
  userId?: unknown;
  percentage?: unknown;
  amount?: unknown;
};

type ItemInput = {
  itemName?: unknown;
  itemAmount?: unknown;
  participantIds?: unknown;
};

function parseSplits(value: unknown): SplitInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value as SplitInput[];
}

function parseItems(value: unknown): ItemInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value as ItemInput[];
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

const expenseInclude = {
  payer: {
    select: userSelect,
  },
  splits: {
    include: {
      user: {
        select: userSelect,
      },
    },
    orderBy: { amountOwed: 'desc' as const },
  },
  items: {
    include: {
      shares: {
        include: {
          user: {
            select: userSelect,
          },
        },
      },
    },
  },
};

function decimalToFixed(value: { toString(): string }): string {
  return Number(value.toString()).toFixed(2);
}

function mapExpense(expense: {
  id: string;
  groupId: string;
  paidBy: string;
  description: string;
  totalAmount: { toString(): string };
  category: string;
  splitType: SplitType;
  createdAt: Date;
  payer: { id: string; name: string; email: string; avatarUrl: string | null };
  splits: Array<{
    id: string;
    userId: string;
    amountOwed: { toString(): string };
    percentage: { toString(): string } | null;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
  }>;
  items: Array<{
    id: string;
    itemName: string;
    itemAmount: { toString(): string };
    shares: Array<{
      id: string;
      userId: string;
      shareAmount: { toString(): string };
      user: { id: string; name: string; email: string; avatarUrl: string | null };
    }>;
  }>;
}) {
  return {
    id: expense.id,
    groupId: expense.groupId,
    paidBy: expense.paidBy,
    description: expense.description,
    totalAmount: decimalToFixed(expense.totalAmount),
    category: expense.category,
    splitType: expense.splitType,
    createdAt: expense.createdAt,
    payer: expense.payer,
    splits: expense.splits.map((split) => ({
      id: split.id,
      userId: split.userId,
      amountOwed: decimalToFixed(split.amountOwed),
      percentage: split.percentage ? decimalToFixed(split.percentage) : null,
      user: split.user,
    })),
    items: expense.items.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      itemAmount: decimalToFixed(item.itemAmount),
      shares: item.shares.map((share) => ({
        id: share.id,
        userId: share.userId,
        shareAmount: decimalToFixed(share.shareAmount),
        user: share.user,
      })),
    })),
  };
}

async function requireGroupMembership(
  groupId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return { ok: false, status: 404, error: 'Group not found' };
  }

  const member = await isGroupMember(groupId, userId);
  if (!member) {
    return { ok: false, status: 403, error: 'You are not a member of this group' };
  }

  return { ok: true };
}

function resolveCalculatedSplits(
  splitType: 'EQUAL' | 'PERCENTAGE' | 'EXACT',
  totalAmount: number,
  participantIds: string[] | null,
  rawSplits: SplitInput[] | null,
): CalculatedSplit[] {
  if (splitType === 'EQUAL') {
    const userIds =
      participantIds ??
      rawSplits
        ?.map((split) => (typeof split.userId === 'string' ? split.userId.trim() : ''))
        .filter((userId) => userId.length > 0) ??
      [];
    return calculateEqualSplits(totalAmount, userIds);
  }

  if (!rawSplits || rawSplits.length === 0) {
    throw new SplitValidationError('Splits are required for this split type');
  }

  if (splitType === 'PERCENTAGE') {
    const participants = rawSplits.map((split) => {
      if (!isNonEmptyString(split.userId)) {
        throw new SplitValidationError('Each split must include a userId');
      }
      const percentage = parseAmount(split.percentage);
      if (percentage === null) {
        throw new SplitValidationError('Each split must include a percentage');
      }
      return { userId: split.userId.trim(), percentage };
    });
    return calculatePercentageSplits(totalAmount, participants);
  }

  const participants = rawSplits.map((split) => {
    if (!isNonEmptyString(split.userId)) {
      throw new SplitValidationError('Each split must include a userId');
    }
    const amount = parseAmount(split.amount);
    if (amount === null) {
      throw new SplitValidationError('Each split must include an amount');
    }
    return { userId: split.userId.trim(), amount };
  });
  return calculateExactSplits(totalAmount, participants);
}

function parseItemizedItems(rawItems: ItemInput[]): ItemizedItemInput[] {
  return rawItems.map((item, index) => {
    if (!isNonEmptyString(item.itemName)) {
      throw new SplitValidationError(`Item ${index + 1} must have a name`);
    }
    const itemAmount = parseAmount(item.itemAmount);
    if (itemAmount === null) {
      throw new SplitValidationError(`Item ${index + 1} must include an amount`);
    }
    const participantIds = parseStringArray(item.participantIds);
    if (participantIds === null) {
      throw new SplitValidationError(`Item ${index + 1} must include participantIds`);
    }
    return {
      itemName: item.itemName.trim(),
      itemAmount,
      participantIds,
    };
  });
}

router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const groupId = req.params.groupId!;

  try {
    const access = await requireGroupMembership(groupId, userId);
    if (!access.ok) {
      res.status(access.status).json({ error: access.error });
      return;
    }

    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: expenseInclude,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ expenses: expenses.map(mapExpense) });
  } catch (error) {
    console.error('List expenses failed:', error);
    res.status(500).json({ error: 'Failed to list expenses' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  const requesterId = req.user!.id;
  const groupId = req.params.groupId!;
  const {
    description,
    totalAmount,
    category,
    paidBy,
    splitType,
    participantIds,
    splits,
    items,
  } = req.body as {
    description?: unknown;
    totalAmount?: unknown;
    category?: unknown;
    paidBy?: unknown;
    splitType?: unknown;
    participantIds?: unknown;
    splits?: unknown;
    items?: unknown;
  };

  if (!isNonEmptyString(description)) {
    res.status(400).json({ error: 'Description is required' });
    return;
  }

  const parsedTotal = parseAmount(totalAmount);
  if (parsedTotal === null || parsedTotal <= 0) {
    res.status(400).json({ error: 'Total amount must be greater than 0' });
    return;
  }

  if (!isNonEmptyString(splitType) || !SPLIT_TYPES.has(splitType)) {
    res.status(400).json({ error: 'splitType must be EQUAL, PERCENTAGE, EXACT, or ITEMIZED' });
    return;
  }

  const payerId = isNonEmptyString(paidBy) ? paidBy.trim() : requesterId;
  const parsedParticipantIds = participantIds === undefined ? null : parseStringArray(participantIds);
  if (participantIds !== undefined && parsedParticipantIds === null) {
    res.status(400).json({ error: 'participantIds must be an array of user IDs' });
    return;
  }

  const parsedSplits = splits === undefined ? null : parseSplits(splits);
  if (splits !== undefined && parsedSplits === null) {
    res.status(400).json({ error: 'splits must be an array' });
    return;
  }

  const parsedItems = items === undefined ? null : parseItems(items);
  if (items !== undefined && parsedItems === null) {
    res.status(400).json({ error: 'items must be an array' });
    return;
  }

  try {
    const access = await requireGroupMembership(groupId, requesterId);
    if (!access.ok) {
      res.status(access.status).json({ error: access.error });
      return;
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((member) => member.userId));

    if (!memberIds.has(payerId)) {
      res.status(400).json({ error: 'Payer must be a member of this group' });
      return;
    }

    if (splitType === 'ITEMIZED') {
      if (!parsedItems) {
        res.status(400).json({ error: 'items are required for ITEMIZED expenses' });
        return;
      }

      const itemizedInput = parseItemizedItems(parsedItems);
      for (const item of itemizedInput) {
        for (const userId of item.participantIds) {
          if (!memberIds.has(userId)) {
            res.status(400).json({ error: 'All participants must be members of this group' });
            return;
          }
        }
      }

      // Build ExpenseItem + ExpenseItemShare rows, then aggregate into ExpenseSplit.
      const calculation = calculateItemizedSplits(parsedTotal, itemizedInput);

      const expense = await prisma.expense.create({
        data: {
          groupId,
          paidBy: payerId,
          description: description.trim(),
          totalAmount: parsedTotal.toFixed(2),
          category: isNonEmptyString(category) ? category.trim() : 'General',
          splitType: 'ITEMIZED',
          // Aggregated per-user totals — what balance/debt logic reads.
          splits: {
            create: calculation.splits.map((split) => ({
              userId: split.userId,
              amountOwed: split.amountOwed,
              percentage: split.percentage,
            })),
          },
          // Line-item detail — each item's equal split among its participants.
          items: {
            create: calculation.items.map((item) => ({
              itemName: item.itemName,
              itemAmount: item.itemAmount,
              shares: {
                create: item.shares.map((share) => ({
                  userId: share.userId,
                  shareAmount: share.shareAmount,
                })),
              },
            })),
          },
        },
        include: expenseInclude,
      });

      res.status(201).json({ expense: mapExpense(expense) });
      return;
    }

    const equalParticipantIds =
      parsedParticipantIds ?? (splitType === 'EQUAL' ? [...memberIds] : null);

    const calculated = resolveCalculatedSplits(
      splitType as 'EQUAL' | 'PERCENTAGE' | 'EXACT',
      parsedTotal,
      splitType === 'EQUAL' ? equalParticipantIds : parsedParticipantIds,
      parsedSplits,
    );

    for (const split of calculated) {
      if (!memberIds.has(split.userId)) {
        res.status(400).json({ error: 'All participants must be members of this group' });
        return;
      }
    }

    const expense = await prisma.expense.create({
      data: {
        groupId,
        paidBy: payerId,
        description: description.trim(),
        totalAmount: parsedTotal.toFixed(2),
        category: isNonEmptyString(category) ? category.trim() : 'General',
        splitType: splitType as SplitType,
        splits: {
          create: calculated.map((split) => ({
            userId: split.userId,
            amountOwed: split.amountOwed,
            percentage: split.percentage,
          })),
        },
      },
      include: expenseInclude,
    });

    res.status(201).json({ expense: mapExpense(expense) });
  } catch (error) {
    if (error instanceof SplitValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Create expense failed:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

export default router;
