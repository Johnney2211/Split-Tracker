import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeMemberBalances, type BalanceUser } from './balanceEngine.js';

const alice: BalanceUser = {
  id: 'alice',
  name: 'Alice',
  email: 'alice@example.com',
  avatarUrl: null,
};

const bob: BalanceUser = {
  id: 'bob',
  name: 'Bob',
  email: 'bob@example.com',
  avatarUrl: null,
};

function byId(balances: ReturnType<typeof computeMemberBalances>) {
  return Object.fromEntries(balances.map((balance) => [balance.user.id, balance]));
}

describe('computeMemberBalances', () => {
  it('handles a simple two-person equal expense', () => {
    // Alice pays $100, split equally → Alice is owed $50, Bob owes $50.
    const balances = computeMemberBalances(
      [alice, bob],
      [
        {
          paidBy: alice.id,
          totalAmount: 100,
          splits: [
            { userId: alice.id, amountOwed: 50 },
            { userId: bob.id, amountOwed: 50 },
          ],
        },
      ],
      [],
    );

    const map = byId(balances);
    assert.equal(map.alice?.netBalance, 50);
    assert.equal(map.bob?.netBalance, -50);
    assert.equal(map.alice?.totalPaid, 100);
    assert.equal(map.alice?.totalOwed, 50);
    assert.equal(map.bob?.totalPaid, 0);
    assert.equal(map.bob?.totalOwed, 50);
  });

  it('applies a settlement from debtor to creditor', () => {
    // Same $100 expense, then Bob pays Alice $50 to settle.
    const balances = computeMemberBalances(
      [alice, bob],
      [
        {
          paidBy: alice.id,
          totalAmount: 100,
          splits: [
            { userId: alice.id, amountOwed: 50 },
            { userId: bob.id, amountOwed: 50 },
          ],
        },
      ],
      [{ fromUser: bob.id, toUser: alice.id, amount: 50 }],
    );

    const map = byId(balances);
    assert.equal(map.alice?.netBalance, 0);
    assert.equal(map.bob?.netBalance, 0);
    assert.equal(map.bob?.totalSettledOut, 50);
    assert.equal(map.alice?.totalSettledIn, 50);
  });

  it('nets to exactly zero when everyone is settled up', () => {
    // Two expenses that create cross-debts, then one settlement clears both.
    // Expense 1: Alice pays $40, equal → Alice +20, Bob -20
    // Expense 2: Bob pays $40, equal → Bob +20, Alice -20
    // Nets already zero with no settlement needed.
    const balancesWithoutSettlement = computeMemberBalances(
      [alice, bob],
      [
        {
          paidBy: alice.id,
          totalAmount: 40,
          splits: [
            { userId: alice.id, amountOwed: 20 },
            { userId: bob.id, amountOwed: 20 },
          ],
        },
        {
          paidBy: bob.id,
          totalAmount: 40,
          splits: [
            { userId: alice.id, amountOwed: 20 },
            { userId: bob.id, amountOwed: 20 },
          ],
        },
      ],
      [],
    );

    const open = byId(balancesWithoutSettlement);
    assert.equal(open.alice?.netBalance, 0);
    assert.equal(open.bob?.netBalance, 0);

    const sum = balancesWithoutSettlement.reduce((total, row) => total + row.netBalance, 0);
    assert.equal(sum, 0);
  });
});
