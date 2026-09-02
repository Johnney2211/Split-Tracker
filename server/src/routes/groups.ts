import { Router } from 'express';
import { getGroupIfMember, isGroupMember } from '../lib/groups.js';
import prisma from '../lib/prisma.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { calculateGroupBalances } from '../services/balanceEngine.js';
import { calculateSimplifiedDebts } from '../services/debtEngine.js';

const router = Router();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mapGroupSummary(group: {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  creator: { id: string; name: string; email: string; avatarUrl: string | null };
  _count: { members: number };
}) {
  return {
    id: group.id,
    name: group.name,
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    creator: group.creator,
    memberCount: group._count.members,
  };
}

function mapGroupDetail(group: {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  creator: { id: string; name: string; email: string; avatarUrl: string | null };
  members: Array<{
    joinedAt: Date;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
  }>;
}) {
  return {
    id: group.id,
    name: group.name,
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    creator: group.creator,
    members: group.members.map((member) => ({
      joinedAt: member.joinedAt,
      user: member.user,
    })),
  };
}

router.use(requireAuth);

router.post('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { name } = req.body as { name?: unknown };

  if (!isNonEmptyString(name)) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }

  try {
    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        createdBy: userId,
        members: {
          create: { userId },
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    res.status(201).json({ group: mapGroupDetail(group) });
  } catch (error) {
    console.error('Create group failed:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            creator: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const groups = memberships.map((membership) => mapGroupSummary(membership.group));
    res.json({ groups });
  } catch (error) {
    console.error('List groups failed:', error);
    res.status(500).json({ error: 'Failed to list groups' });
  }
});

router.get('/:id/balances', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const groupId = req.params.id!;

  try {
    const member = await isGroupMember(groupId, userId);
    if (!member) {
      const groupExists = await prisma.group.findUnique({ where: { id: groupId } });
      if (!groupExists) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const balances = await calculateGroupBalances(groupId);

    res.json({
      balances: balances.map((balance) => ({
        user: balance.user,
        netBalance: balance.netBalance.toFixed(2),
        totalPaid: balance.totalPaid.toFixed(2),
        totalOwed: balance.totalOwed.toFixed(2),
        totalSettledOut: balance.totalSettledOut.toFixed(2),
        totalSettledIn: balance.totalSettledIn.toFixed(2),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'GROUP_NOT_FOUND') {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    console.error('Get balances failed:', error);
    res.status(500).json({ error: 'Failed to calculate balances' });
  }
});

router.get('/:id/simplified-debts', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const groupId = req.params.id!;

  try {
    const member = await isGroupMember(groupId, userId);
    if (!member) {
      const groupExists = await prisma.group.findUnique({ where: { id: groupId } });
      if (!groupExists) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const debts = await calculateSimplifiedDebts(groupId);

    res.json({
      debts: debts.map((debt) => ({
        fromUserId: debt.fromUserId,
        toUserId: debt.toUserId,
        amount: debt.amount.toFixed(2),
        fromUser: debt.fromUser,
        toUser: debt.toUser,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'GROUP_NOT_FOUND') {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    console.error('Get simplified debts failed:', error);
    res.status(500).json({ error: 'Failed to calculate simplified debts' });
  }
});

router.get('/:id/activity', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const groupId = req.params.id!;

  try {
    const member = await isGroupMember(groupId, userId);
    if (!member) {
      const groupExists = await prisma.group.findUnique({ where: { id: groupId } });
      if (!groupExists) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const [expenses, settlements] = await Promise.all([
      prisma.expense.findMany({
        where: { groupId },
        select: {
          id: true,
          description: true,
          totalAmount: true,
          createdAt: true,
          payer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.settlement.findMany({
        where: { groupId },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          from: { select: { id: true, name: true } },
          to: { select: { id: true, name: true } },
          recorder: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    type ActivityEvent = {
      id: string;
      type: 'expense' | 'settlement';
      createdAt: Date;
      message: string;
    };

    const expenseEvents: ActivityEvent[] = expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      type: 'expense',
      createdAt: expense.createdAt,
      message: `${expense.payer.name} added ${expense.description} ($${Number(expense.totalAmount.toString()).toFixed(2)})`,
    }));

    const settlementEvents: ActivityEvent[] = settlements.map((settlement) => ({
      id: `settlement-${settlement.id}`,
      type: 'settlement',
      createdAt: settlement.createdAt,
      message: `${settlement.recorder.name} marked as settled with ${settlement.to.name} ($${Number(settlement.amount.toString()).toFixed(2)})`,
    }));

    const activity = [...expenseEvents, ...settlementEvents]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((event) => ({
        id: event.id,
        type: event.type,
        createdAt: event.createdAt,
        message: event.message,
      }));

    res.json({ activity });
  } catch (error) {
    console.error('Get activity failed:', error);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

router.post('/:id/settlements', async (req: AuthenticatedRequest, res) => {
  const requesterId = req.user!.id;
  const groupId = req.params.id!;
  const { fromUserId, toUserId, amount, note } = req.body as {
    fromUserId?: unknown;
    toUserId?: unknown;
    amount?: unknown;
    note?: unknown;
  };

  if (!isNonEmptyString(fromUserId) || !isNonEmptyString(toUserId)) {
    res.status(400).json({ error: 'fromUserId and toUserId are required' });
    return;
  }

  if (fromUserId.trim() === toUserId.trim()) {
    res.status(400).json({ error: 'fromUserId and toUserId must be different people' });
    return;
  }

  const parsedAmount =
    typeof amount === 'number'
      ? amount
      : typeof amount === 'string' && amount.trim() !== ''
        ? Number(amount)
        : NaN;

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: 'amount must be greater than 0' });
    return;
  }

  try {
    const member = await isGroupMember(groupId, requesterId);
    if (!member) {
      const groupExists = await prisma.group.findUnique({ where: { id: groupId } });
      if (!groupExists) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const [fromIsMember, toIsMember] = await Promise.all([
      isGroupMember(groupId, fromUserId.trim()),
      isGroupMember(groupId, toUserId.trim()),
    ]);

    if (!fromIsMember || !toIsMember) {
      res.status(400).json({ error: 'Both users must be members of this group' });
      return;
    }

    if (requesterId !== fromUserId.trim()) {
      res.status(403).json({ error: 'You can only mark your own settlements as settled' });
      return;
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId,
        fromUser: fromUserId.trim(),
        toUser: toUserId.trim(),
        recordedBy: requesterId,
        amount: parsedAmount.toFixed(2),
        note: isNonEmptyString(note) ? note.trim() : null,
      },
      include: {
        from: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        to: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        recorder: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json({
      settlement: {
        id: settlement.id,
        groupId: settlement.groupId,
        fromUserId: settlement.fromUser,
        toUserId: settlement.toUser,
        recordedById: settlement.recordedBy,
        amount: Number(settlement.amount.toString()).toFixed(2),
        note: settlement.note,
        createdAt: settlement.createdAt,
        fromUser: settlement.from,
        toUser: settlement.to,
        recordedBy: settlement.recorder,
      },
    });
  } catch (error) {
    console.error('Create settlement failed:', error);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const groupId = req.params.id!;

  try {
    const { group, isMember } = await getGroupIfMember(groupId, userId);

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (!isMember) {
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    res.json({ group: mapGroupDetail(group) });
  } catch (error) {
    console.error('Get group failed:', error);
    res.status(500).json({ error: 'Failed to get group' });
  }
});

router.post('/:id/invite', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const groupId = req.params.id!;
  const { email } = req.body as { email?: unknown };

  if (!isNonEmptyString(email)) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const member = await isGroupMember(groupId, userId);
    if (!member) {
      const groupExists = await prisma.group.findUnique({ where: { id: groupId } });
      if (!groupExists) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      res.status(403).json({ error: 'You are not a member of this group' });
      return;
    }

    const invitee = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    if (!invitee) {
      res.status(404).json({ error: 'No user found with that email' });
      return;
    }

    const alreadyMember = await isGroupMember(groupId, invitee.id);
    if (alreadyMember) {
      res.status(409).json({ error: 'User is already a member of this group' });
      return;
    }

    const membership = await prisma.groupMember.create({
      data: {
        groupId,
        userId: invitee.id,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json({
      member: {
        joinedAt: membership.joinedAt,
        user: membership.user,
      },
    });
  } catch (error) {
    console.error('Invite member failed:', error);
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

router.delete('/:id/members/:userId', async (req: AuthenticatedRequest, res) => {
  const requesterId = req.user!.id;
  const groupId = req.params.id!;
  const targetUserId = req.params.userId!;

  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (group.createdBy !== requesterId) {
      res.status(403).json({ error: 'Only the group creator can remove members' });
      return;
    }

    if (targetUserId === group.createdBy) {
      res.status(400).json({ error: 'Cannot remove the group creator' });
      return;
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: targetUserId },
      },
    });

    if (!membership) {
      res.status(404).json({ error: 'Member not found in this group' });
      return;
    }

    await prisma.groupMember.delete({
      where: {
        groupId_userId: { groupId, userId: targetUserId },
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Remove member failed:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
