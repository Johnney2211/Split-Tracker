import { apiFetch, parseApiError } from './client';
import type { GroupMemberUser } from './groups';

export type MemberBalance = {
  user: GroupMemberUser;
  netBalance: string;
  totalPaid: string;
  totalOwed: string;
  totalSettledOut: string;
  totalSettledIn: string;
};

export async function getGroupBalances(
  token: string,
  groupId: string,
): Promise<MemberBalance[]> {
  const response = await apiFetch(`/groups/${groupId}/balances`, { token });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { balances: MemberBalance[] };
  return data.balances;
}
