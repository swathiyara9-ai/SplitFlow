import { Expense, ExpenseParticipant, Settlement, GroupMember, PeerDebt, BalanceSummary } from '@/types';

/**
 * Calculates the net balances of each group member and resolves peer-to-peer debts
 */
export function calculateGroupBalances(
  members: GroupMember[],
  expenses: Expense[],
  participants: ExpenseParticipant[],
  settlements: Settlement[]
): {
  memberBalances: Record<string, number>;
  peerDebts: PeerDebt[];
  totalOwedToUser: number;
  totalUserOwes: number;
  netUserBalance: number;
} {
  const memberBalances: Record<string, number> = {};

  // Initialize balances
  members.forEach((m) => {
    memberBalances[m.user_id] = 0;
  });

  // Add payments (positive for payer)
  expenses.forEach((e) => {
    if (memberBalances[e.paid_by] !== undefined) {
      memberBalances[e.paid_by] += Number(e.amount);
    }
  });

  // Subtract shares (negative for participants)
  participants.forEach((p) => {
    if (memberBalances[p.user_id] !== undefined) {
      memberBalances[p.user_id] -= Number(p.share_amount);
    }
  });

  // Adjust for settlements
  settlements.forEach((s) => {
    if (memberBalances[s.payer] !== undefined) {
      memberBalances[s.payer] += Number(s.amount); // payer paid, so they are closer to positive / owed less
    }
    if (memberBalances[s.receiver] !== undefined) {
      memberBalances[s.receiver] -= Number(s.amount); // receiver got paid, so they are closer to negative / owe more
    }
  });

  // Calculate peer-to-peer debts using the greedy settlement algorithm
  const debtors: { userId: string; name: string; amount: number }[] = [];
  const creditors: { userId: string; name: string; amount: number }[] = [];

  Object.entries(memberBalances).forEach(([userId, balance]) => {
    const member = members.find((m) => m.user_id === userId);
    const name = member?.profiles?.display_name || 'Unknown User';
    
    // Use a tolerance for floating point rounding errors
    if (balance < -0.01) {
      debtors.push({ userId, name, amount: Math.abs(balance) });
    } else if (balance > 0.01) {
      creditors.push({ userId, name, amount: balance });
    }
  });

  // Sort: largest debtors and creditors first
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const peerDebts: PeerDebt[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0.01) {
      peerDebts.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Number(settleAmount.toFixed(2)),
        from_name: debtor.name,
        to_name: creditor.name,
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.01) {
      dIdx++;
    }
    if (creditor.amount < 0.01) {
      cIdx++;
    }
  }

  return {
    memberBalances,
    peerDebts,
    totalOwedToUser: 0, // Calculated contextually by caller or by filtering
    totalUserOwes: 0,
    netUserBalance: 0,
  };
}

/**
 * Calculates global balances across multiple groups for a single user
 */
export function calculateGlobalBalances(
  userId: string,
  groupsData: {
    group: any;
    members: GroupMember[];
    expenses: Expense[];
    participants: ExpenseParticipant[];
    settlements: Settlement[];
  }[]
): BalanceSummary & { groupSummaries: Record<string, number> } {
  let owedToMe = 0;
  let iOwe = 0;
  const groupSummaries: Record<string, number> = {};

  groupsData.forEach(({ group, members, expenses, participants, settlements }) => {
    const { peerDebts } = calculateGroupBalances(members, expenses, participants, settlements);
    
    let groupNet = 0;
    peerDebts.forEach((debt) => {
      if (debt.from === userId) {
        iOwe += debt.amount;
        groupNet -= debt.amount;
      }
      if (debt.to === userId) {
        owedToMe += debt.amount;
        groupNet += debt.amount;
      }
    });
    groupSummaries[group.id] = groupNet;
  });

  return {
    owedToMe: Number(owedToMe.toFixed(2)),
    iOwe: Number(iOwe.toFixed(2)),
    netBalance: Number((owedToMe - iOwe).toFixed(2)),
    groupSummaries,
  };
}
