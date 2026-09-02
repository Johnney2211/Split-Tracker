import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createExpense, type SplitType } from '../api/expenses';
import type { GroupMember } from '../api/groups';
import { alertError, btnPrimary, inputClass, labelClass } from '../ui/styles';
import { SectionCard } from './SectionCard';
import { useToast } from './Toast';

type AddExpenseFormProps = {
  groupId: string;
  members: GroupMember[];
  currentUserId: string;
  token: string;
  onCreated: () => void;
};

type LineItem = {
  key: string;
  itemName: string;
  itemAmount: string;
  participantIds: string[];
};

const SUM_TOLERANCE = 0.01;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseInputNumber(value: string): number {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function equalShareLabels(totalAmount: number, count: number): string {
  if (count === 0 || totalAmount <= 0) return '';
  const share = roundMoney(totalAmount / count);
  return `Split equally — about $${share.toFixed(2)} each`;
}

function createLineItem(memberIds: string[]): LineItem {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemName: '',
    itemAmount: '',
    participantIds: [...memberIds],
  };
}

/**
 * Preview of itemized → ExpenseSplit aggregation (mirrors the server):
 * each item is equal-split among its participants, then shares are summed per user.
 */
function previewItemizedOwed(
  items: LineItem[],
): Array<{ userId: string; amountOwed: number }> {
  const owedCents = new Map<string, number>();

  for (const item of items) {
    const amount = parseInputNumber(item.itemAmount);
    if (amount <= 0 || item.participantIds.length === 0) continue;

    const cents = Math.round(amount * 100);
    const count = item.participantIds.length;
    const base = Math.floor(cents / count);
    const remainder = cents % count;

    item.participantIds.forEach((userId, index) => {
      const share = base + (index < remainder ? 1 : 0);
      owedCents.set(userId, (owedCents.get(userId) ?? 0) + share);
    });
  }

  return [...owedCents.entries()]
    .map(([userId, cents]) => ({ userId, amountOwed: cents / 100 }))
    .sort((a, b) => b.amountOwed - a.amountOwed);
}

export function AddExpenseForm({
  groupId,
  members,
  currentUserId,
  token,
  onCreated,
}: AddExpenseFormProps) {
  const { showToast } = useToast();
  const memberIds = useMemo(() => members.map((member) => member.user.id), [members]);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [selectedIds, setSelectedIds] = useState<string[]>(() => [...memberIds]);
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [items, setItems] = useState<LineItem[]>(() => [createLineItem(memberIds)]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalAmount = parseInputNumber(amount);

  useEffect(() => {
    setSelectedIds(memberIds);
    setPaidBy((current) => (memberIds.includes(current) ? current : currentUserId));
    setItems((current) =>
      current.map((item) => ({
        ...item,
        participantIds:
          item.participantIds.length === 0
            ? [...memberIds]
            : item.participantIds.filter((id) => memberIds.includes(id)),
      })),
    );
  }, [memberIds, currentUserId]);

  useEffect(() => {
    if (members.length === 0) return;

    const evenPercent = roundMoney(100 / members.length);
    const nextPercentages: Record<string, string> = {};
    members.forEach((member, index) => {
      const value =
        index === members.length - 1
          ? roundMoney(100 - evenPercent * (members.length - 1))
          : evenPercent;
      nextPercentages[member.user.id] = value.toFixed(2);
    });
    setPercentages(nextPercentages);
  }, [members]);

  useEffect(() => {
    if (members.length === 0 || totalAmount <= 0) {
      const empty: Record<string, string> = {};
      for (const member of members) {
        empty[member.user.id] = '';
      }
      setAmounts(empty);
      return;
    }

    const even = roundMoney(totalAmount / members.length);
    const nextAmounts: Record<string, string> = {};
    members.forEach((member, index) => {
      const value =
        index === members.length - 1
          ? roundMoney(totalAmount - even * (members.length - 1))
          : even;
      nextAmounts[member.user.id] = value.toFixed(2);
    });
    setAmounts(nextAmounts);
  }, [members, totalAmount]);

  const percentageTotal = useMemo(
    () => members.reduce((sum, member) => sum + parseInputNumber(percentages[member.user.id] ?? ''), 0),
    [members, percentages],
  );
  const exactTotal = useMemo(
    () => members.reduce((sum, member) => sum + parseInputNumber(amounts[member.user.id] ?? ''), 0),
    [members, amounts],
  );
  const itemsTotal = useMemo(
    () => items.reduce((sum, item) => sum + parseInputNumber(item.itemAmount), 0),
    [items],
  );
  const itemizedPreview = useMemo(() => previewItemizedOwed(items), [items]);

  // Keep expense total in sync with line items for ITEMIZED so validation stays green.
  useEffect(() => {
    if (splitType !== 'ITEMIZED') return;
    setAmount(itemsTotal > 0 ? itemsTotal.toFixed(2) : '');
  }, [splitType, itemsTotal]);

  const percentagesValid = Math.abs(percentageTotal - 100) <= SUM_TOLERANCE;
  const exactValid = totalAmount > 0 && Math.abs(exactTotal - totalAmount) <= SUM_TOLERANCE;
  const itemsValid =
    items.length > 0 &&
    items.every(
      (item) =>
        item.itemName.trim().length > 0 &&
        parseInputNumber(item.itemAmount) > 0 &&
        item.participantIds.length > 0,
    ) &&
    Math.abs(itemsTotal - totalAmount) <= SUM_TOLERANCE &&
    totalAmount > 0;

  function toggleParticipant(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function toggleItemParticipant(key: string, userId: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        const participantIds = item.participantIds.includes(userId)
          ? item.participantIds.filter((id) => id !== userId)
          : [...item.participantIds, userId];
        return { ...item, participantIds };
      }),
    );
  }

  function resetForm() {
    setDescription('');
    setAmount('');
    setCategory('General');
    setSplitType('EQUAL');
    setSelectedIds([...memberIds]);
    setItems([createLineItem(memberIds)]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (splitType === 'EQUAL' && selectedIds.length === 0) {
      const message = 'Select at least one participant';
      setError(message);
      showToast(message, 'error');
      return;
    }

    if (splitType === 'PERCENTAGE' && !percentagesValid) {
      const message = `Percentages must sum to 100, got ${roundMoney(percentageTotal)}`;
      setError(message);
      showToast(message, 'error');
      return;
    }

    if (splitType === 'EXACT' && !exactValid) {
      const message = `Amounts must sum to ${totalAmount.toFixed(2)}, got ${roundMoney(exactTotal).toFixed(2)}`;
      setError(message);
      showToast(message, 'error');
      return;
    }

    if (splitType === 'ITEMIZED') {
      if (items.length === 0) {
        const message = 'Add at least one line item';
        setError(message);
        showToast(message, 'error');
        return;
      }
      if (!itemsValid) {
        const message =
          Math.abs(itemsTotal - totalAmount) > SUM_TOLERANCE
            ? `Item amounts must sum to ${totalAmount.toFixed(2)}, got ${itemsTotal.toFixed(2)}`
            : 'Each item needs a name, amount, and at least one participant';
        setError(message);
        showToast(message, 'error');
        return;
      }
    }

    setSubmitting(true);

    try {
      await createExpense(token, groupId, {
        description,
        totalAmount,
        category,
        paidBy,
        splitType,
        ...(splitType === 'EQUAL' ? { participantIds: selectedIds } : {}),
        ...(splitType === 'PERCENTAGE'
          ? {
              splits: members.map((member) => ({
                userId: member.user.id,
                percentage: parseInputNumber(percentages[member.user.id] ?? ''),
              })),
            }
          : {}),
        ...(splitType === 'EXACT'
          ? {
              splits: members.map((member) => ({
                userId: member.user.id,
                amount: parseInputNumber(amounts[member.user.id] ?? ''),
              })),
            }
          : {}),
        ...(splitType === 'ITEMIZED'
          ? {
              items: items.map((item) => ({
                itemName: item.itemName.trim(),
                itemAmount: parseInputNumber(item.itemAmount),
                participantIds: item.participantIds,
              })),
            }
          : {}),
      });

      resetForm();
      showToast('Expense added', 'success');
      onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add expense';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const memberName = (userId: string) => {
    const member = members.find((entry) => entry.user.id === userId);
    if (!member) return userId;
    return member.user.id === currentUserId ? `${member.user.name} (you)` : member.user.name;
  };

  return (
    <SectionCard title="Add expense">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className={labelClass}>
          Description
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="Groceries, rent, electricity…"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-700">
            Amount
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              readOnly={splitType === 'ITEMIZED'}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 read-only:bg-slate-50"
              placeholder="0.00"
            />
            {splitType === 'ITEMIZED' ? (
              <span className="mt-1 block text-xs text-slate-500">
                Auto-calculated from line items
              </span>
            ) : null}
          </label>
          <label className="block text-sm text-slate-700">
            Category
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>

        <label className="block text-sm text-slate-700">
          Paid by
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {members.map((member) => (
              <option key={member.user.id} value={member.user.id}>
                {member.user.name}
                {member.user.id === currentUserId ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-sm text-slate-700">Split type</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ['EQUAL', 'Equal'],
                ['PERCENTAGE', 'Percentage'],
                ['EXACT', 'Exact'],
                ['ITEMIZED', 'Itemized'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                  splitType === value
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                    : 'border-slate-300 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="splitType"
                  value={value}
                  checked={splitType === value}
                  onChange={() => setSplitType(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {splitType === 'EQUAL' ? (
          <fieldset>
            <legend className="text-sm text-slate-700">Split equally between</legend>
            <p className="mt-1 text-xs text-slate-500">
              {equalShareLabels(totalAmount, selectedIds.length)}
            </p>
            <ul className="mt-2 space-y-2">
              {members.map((member) => (
                <li key={member.user.id}>
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(member.user.id)}
                      onChange={() => toggleParticipant(member.user.id)}
                    />
                    {member.user.name}
                    {member.user.id === currentUserId ? ' (you)' : ''}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        {splitType === 'PERCENTAGE' ? (
          <fieldset>
            <legend className="text-sm text-slate-700">Percentage per person</legend>
            <ul className="mt-2 space-y-2">
              {members.map((member) => (
                <li key={member.user.id} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-sm text-slate-800">
                    {member.user.name}
                    {member.user.id === currentUserId ? ' (you)' : ''}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={percentages[member.user.id] ?? ''}
                    onChange={(e) =>
                      setPercentages((current) => ({
                        ...current,
                        [member.user.id]: e.target.value,
                      }))
                    }
                    className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                  <span className="text-sm text-slate-500">%</span>
                </li>
              ))}
            </ul>
            <p
              className={`mt-2 text-sm ${percentagesValid ? 'text-slate-600' : 'text-red-600'}`}
              role={percentagesValid ? undefined : 'alert'}
            >
              Total: {roundMoney(percentageTotal)} / 100
            </p>
          </fieldset>
        ) : null}

        {splitType === 'EXACT' ? (
          <fieldset>
            <legend className="text-sm text-slate-700">Exact amount per person</legend>
            <ul className="mt-2 space-y-2">
              {members.map((member) => (
                <li key={member.user.id} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-sm text-slate-800">
                    {member.user.name}
                    {member.user.id === currentUserId ? ' (you)' : ''}
                  </span>
                  <span className="text-sm text-slate-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amounts[member.user.id] ?? ''}
                    onChange={(e) =>
                      setAmounts((current) => ({
                        ...current,
                        [member.user.id]: e.target.value,
                      }))
                    }
                    className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </li>
              ))}
            </ul>
            <p
              className={`mt-2 text-sm ${exactValid ? 'text-slate-600' : 'text-red-600'}`}
              role={exactValid ? undefined : 'alert'}
            >
              Total: ${roundMoney(exactTotal).toFixed(2)} / $
              {totalAmount > 0 ? totalAmount.toFixed(2) : '0.00'}
            </p>
          </fieldset>
        ) : null}

        {splitType === 'ITEMIZED' ? (
          <fieldset className="space-y-4">
            <legend className="text-sm text-slate-700">Line items</legend>
            <p className="text-xs text-slate-500">
              Each item is split equally among the people you check. Final balances are the sum of
              each person’s shares.
            </p>

            {items.map((item, index) => (
              <div
                key={item.key}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">Item {index + 1}</p>
                  {items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                      className="text-xs text-slate-600 hover:text-red-600"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-slate-700">
                    Name
                    <input
                      type="text"
                      required
                      value={item.itemName}
                      onChange={(e) => updateItem(item.key, { itemName: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Pizza, drinks…"
                    />
                  </label>
                  <label className="block text-sm text-slate-700">
                    Amount
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={item.itemAmount}
                      onChange={(e) => updateItem(item.key, { itemAmount: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="0.00"
                    />
                  </label>
                </div>

                <div>
                  <p className="text-sm text-slate-700">Shared by</p>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                    {members.map((member) => (
                      <li key={member.user.id}>
                        <label className="flex items-center gap-2 text-sm text-slate-800">
                          <input
                            type="checkbox"
                            checked={item.participantIds.includes(member.user.id)}
                            onChange={() => toggleItemParticipant(item.key, member.user.id)}
                          />
                          {member.user.name}
                          {member.user.id === currentUserId ? ' (you)' : ''}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setItems((current) => [...current, createLineItem(memberIds)])}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-white"
            >
              Add line item
            </button>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium text-slate-800">Who owes what</p>
              {itemizedPreview.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Add item amounts to see the summary.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {itemizedPreview.map((entry) => (
                    <li key={entry.userId} className="flex justify-between gap-3">
                      <span>{memberName(entry.userId)}</span>
                      <span className="font-medium">${entry.amountOwed.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p
                className={`mt-3 text-sm ${itemsValid ? 'text-slate-600' : 'text-red-600'}`}
                role={itemsValid ? undefined : 'alert'}
              >
                Items total: ${itemsTotal.toFixed(2)}
                {totalAmount > 0 ? ` / Expense ${totalAmount.toFixed(2)}` : ''}
              </p>
            </div>
          </fieldset>
        ) : null}

        {error ? (
          <p className={alertError} role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} className={btnPrimary}>
          {submitting ? 'Adding…' : 'Add expense'}
        </button>
      </form>
    </SectionCard>
  );
}
