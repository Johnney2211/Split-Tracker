import { apiFetch, parseApiError } from './client';
import type { GroupMemberUser } from './groups';

export type SuggestedDebt = {
  fromUserId: string;
  toUserId: string;
  amount: string;
  fromUser: GroupMemberUser;
  toUser: GroupMemberUser;
};

export type Settlement = {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  recordedById: string;
  amount: string;
  note: string | null;
  createdAt: string;
  fromUser: GroupMemberUser;
  toUser: GroupMemberUser;
  recordedBy: GroupMemberUser;
};

export async function getSimplifiedDebts(
  token: string,
  groupId: string,
): Promise<SuggestedDebt[]> {
  const response = await apiFetch(`/groups/${groupId}/simplified-debts`, { token });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { debts: SuggestedDebt[] };
  return data.debts;
}

export async function createSettlement(
  token: string,
  groupId: string,
  input: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    note?: string;
  },
): Promise<Settlement> {
  const response = await apiFetch(`/groups/${groupId}/settlements`, {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { settlement: Settlement };
  return data.settlement;
}
