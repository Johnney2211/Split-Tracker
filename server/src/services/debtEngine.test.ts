import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeMemberBalances, type BalanceUser, type MemberBalance } from './balanceEngine.js';
import { simplifyDebts } from './debtEngine.js';

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

const carol: BalanceUser = {
  id: 'carol',
  name: 'Carol',
  email: 'carol@example.com',
  avatarUrl: null,
};

const dave: BalanceUser = {
  id: 'dave',
  name: 'Dave',
  email: 'dave@example.com',
  avatarUrl: null,
};

function balanceFromNet(user: BalanceUser, netBalance: number): MemberBalance {
  return {
    user,
    netBalance,
    totalPaid: 0,
    totalOwed: 0,
    totalSettledOut: 0,
    totalSettledIn: 0,
  };
}

/**
 * Apply suggested payments on top of starting nets and return the resulting nets.
 * Used to prove suggestions actually settle everyone.
 */
function applySuggestions(
  starting: MemberBalance[],
  suggestions: ReturnType<typeof simplifyDebts>,
): Map<string, number> {
  const nets = new Map(starting.map((row) => [row.user.id, row.netBalance]));

  for (const suggestion of suggestions) {
    const from = nets.get(suggestion.fromUserId) ?? 0;
    const to = nets.get(suggestion.toUserId) ?? 0;
    // Paying a settlement: fromUser balance increases, toUser decreases
    // (same semantics as balanceEngine).
    nets.set(suggestion.fromUserId, Math.round((from + suggestion.amount) * 100) / 100);
    nets.set(suggestion.toUserId, Math.round((to - suggestion.amount) * 100) / 100);
  }

  return nets;
}

describe('simplifyDebts', () => {
  it('handles a simple two-person case', () => {
    // Alice is owed $50, Bob owes $50 → one payment Bob → Alice $50.
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

    const suggestions = simplifyDebts(balances);
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]?.fromUserId, bob.id);
    assert.equal(suggestions[0]?.toUserId, alice.id);
    assert.equal(suggestions[0]?.amount, 50);
  });

  it('needs fewer transactions than naive pairwise settlement', () => {
    // Pairwise expense edges (naive settlement = settle each edge separately):
    //   Bob owes Alice $10   (Alice paid for Bob)
    //   Carol owes Alice $10 (Alice paid for Carol)
    //   Carol owes Bob $10   (Bob paid for Carol)
    // → 3 naive payments.
    //
    // Net balances collapse the cycle:
    //   Alice +20, Bob 0, Carol -20
    // → simplified: Carol pays Alice $20 (1 payment).

    const naivePairwiseCount = 3;

    const nets = [
      balanceFromNet(alice, 20),
      balanceFromNet(bob, 0),
      balanceFromNet(carol, -20),
    ];

    const suggestions = simplifyDebts(nets);
    assert.equal(suggestions.length, 1);
    assert.ok(
      suggestions.length < naivePairwiseCount,
      `expected simplified (${suggestions.length}) < naive (${naivePairwiseCount})`,
    );
    assert.equal(suggestions[0]?.fromUserId, carol.id);
    assert.equal(suggestions[0]?.toUserId, alice.id);
    assert.equal(suggestions[0]?.amount, 20);
  });

  it('settles 4+ users to ~zero and terminates', () => {
    // A owes 50, B owes 30, C is owed 40, D is owed 40.
    const starting = [
      balanceFromNet(alice, -50),
      balanceFromNet(bob, -30),
      balanceFromNet(carol, 40),
      balanceFromNet(dave, 40),
    ];

    const suggestions = simplifyDebts(starting);

    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.length <= starting.length - 1);

    const after = applySuggestions(starting, suggestions);
    for (const [, net] of after) {
      assert.ok(Math.abs(net) < 0.01, `expected ~0 remaining, got ${net}`);
    }

    const totalMoved = suggestions.reduce((sum, row) => sum + row.amount, 0);
    assert.equal(totalMoved, 80);
  });
});
