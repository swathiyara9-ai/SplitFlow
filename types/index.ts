export interface Profile {
  id: string;
  email: string;
  display_name: string;
  unique_user_id: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  profiles?: Profile;
}

export type SplitMethod = 'equal' | 'exact' | 'percentage';

export interface Expense {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  amount: number;
  paid_by: string;
  split_method: SplitMethod;
  category: string;
  notes?: string;
  receipt_url?: string;
  expense_date: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseParticipant {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  payment_status: 'unpaid' | 'settled';
  created_at: string;
  profiles?: Profile;
}

export interface Settlement {
  id: string;
  group_id: string;
  payer: string;
  receiver: string;
  amount: number;
  notes?: string;
  settled_at: string;
  payer_profile?: Profile;
  receiver_profile?: Profile;
}

export interface ActivityLog {
  id: string;
  group_id: string;
  performed_by?: string;
  action: string;
  description: string;
  created_at: string;
  profiles?: Profile;
}

export interface BalanceSummary {
  owedToMe: number;
  iOwe: number;
  netBalance: number;
}

export interface PeerDebt {
  from: string;
  to: string;
  amount: number;
  from_name: string;
  to_name: string;
}

export interface GroupWithBalances extends Group {
  membersCount: number;
  netBalance: number;
  userStatus: 'owed' | 'owes' | 'settled';
}
