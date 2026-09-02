import { apiFetch, parseApiError } from './client';

export type ActivityEvent = {
  id: string;
  type: 'expense' | 'settlement';
  createdAt: string;
  message: string;
};

export async function getGroupActivity(token: string, groupId: string): Promise<ActivityEvent[]> {
  const response = await apiFetch(`/groups/${groupId}/activity`, { token });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as { activity: ActivityEvent[] };
  return data.activity;
}
