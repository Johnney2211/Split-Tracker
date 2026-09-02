import { apiFetch, parseApiError } from './client';

export type GroupMemberUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type GroupMember = {
  joinedAt: string;
  user: GroupMemberUser;
};

export type GroupSummary = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  creator: GroupMemberUser;
  memberCount: number;
};

export type GroupDetail = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  creator: GroupMemberUser;
  members: GroupMember[];
};

export async function listGroups(token: string): Promise<GroupSummary[]> {
  const response = await apiFetch('/groups', { token });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { groups: GroupSummary[] };
  return data.groups;
}

export async function getGroup(token: string, groupId: string): Promise<GroupDetail> {
  const response = await apiFetch(`/groups/${groupId}`, { token });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { group: GroupDetail };
  return data.group;
}

export async function createGroup(token: string, name: string): Promise<GroupDetail> {
  const response = await apiFetch('/groups', {
    method: 'POST',
    token,
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { group: GroupDetail };
  return data.group;
}

export async function inviteToGroup(
  token: string,
  groupId: string,
  email: string,
): Promise<GroupMember> {
  const response = await apiFetch(`/groups/${groupId}/invite`, {
    method: 'POST',
    token,
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { member: GroupMember };
  return data.member;
}

export async function removeGroupMember(
  token: string,
  groupId: string,
  userId: string,
): Promise<void> {
  const response = await apiFetch(`/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    token,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}
