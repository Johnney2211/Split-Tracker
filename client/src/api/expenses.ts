import { apiFetch, parseApiError } from './client';
import type { GroupMemberUser } from './groups';

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'EXACT' | 'ITEMIZED';

export type ExpenseSplit = {
  id: string;
  userId: string;
  amountOwed: string;
  percentage: string | null;
  user: GroupMemberUser;
};

export type ExpenseItemShare = {
  id: string;
  userId: string;
  shareAmount: string;
  user: GroupMemberUser;
};

export type ExpenseItem = {
  id: string;
  itemName: string;
  itemAmount: string;
  shares: ExpenseItemShare[];
};

export type Expense = {
  id: string;
  groupId: string;
  paidBy: string;
  description: string;
  totalAmount: string;
  category: string;
  splitType: SplitType;
  createdAt: string;
  payer: GroupMemberUser;
  splits: ExpenseSplit[];
  items?: ExpenseItem[];
};

export type CreateExpenseInput = {
  description: string;
  totalAmount: number;
  category: string;
  paidBy: string;
  splitType: SplitType;
  participantIds?: string[];
  splits?: Array<{
    userId: string;
    percentage?: number;
    amount?: number;
  }>;
  items?: Array<{
    itemName: string;
    itemAmount: number;
    participantIds: string[];
  }>;
};

export async function listExpenses(token: string, groupId: string): Promise<Expense[]> {
  const response = await apiFetch(`/groups/${groupId}/expenses`, { token });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { expenses: Expense[] };
  return data.expenses;
}

export async function createExpense(
  token: string,
  groupId: string,
  input: CreateExpenseInput,
): Promise<Expense> {
  const response = await apiFetch(`/groups/${groupId}/expenses`, {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { expense: Expense };
  return data.expense;
}
