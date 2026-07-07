import { SupabaseClient } from '@supabase/supabase-js';
import { Group, GroupMember, Expense, ExpenseParticipant, Settlement, ActivityLog } from '@/types';
import { getUserGroups } from './group';

export interface DashboardDataPayload {
  groups: Group[];
  groupsData: {
    group: Group;
    members: GroupMember[];
    expenses: Expense[];
    participants: ExpenseParticipant[];
    settlements: Settlement[];
  }[];
  activities: ActivityLog[];
}

export async function getDashboardData(supabase: SupabaseClient): Promise<DashboardDataPayload | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. Get user groups
  const groups = await getUserGroups(supabase);
  if (groups.length === 0) {
    return {
      groups: [],
      groupsData: [],
      activities: [],
    };
  }

  const groupIds = groups.map((g) => g.id);

  // 2. Fetch members, expenses, settlements, and activities in parallel
  const [
    { data: members, error: membersError },
    { data: expenses, error: expensesError },
    { data: settlements, error: settlementsError },
    { data: activities, error: activitiesError },
  ] = await Promise.all([
    supabase.from('group_members').select('*, profiles (*)').in('group_id', groupIds),
    supabase.from('expenses').select('*').in('group_id', groupIds),
    supabase.from('settlements').select('*').in('group_id', groupIds),
    supabase.from('activity_logs').select('*, profiles:performed_by (*)').in('group_id', groupIds).order('created_at', { ascending: false }).limit(10),
  ]);

  if (membersError || expensesError || settlementsError || activitiesError) {
    console.error('Error fetching dashboard subqueries:', {
      membersError,
      expensesError,
      settlementsError,
      activitiesError,
    });
  }

  // 3. Get all expense IDs to fetch participants
  const expenseIds = expenses?.map((e) => e.id) || [];
  let participants: ExpenseParticipant[] = [];

  if (expenseIds.length > 0) {
    const { data: participantsData, error: participantsError } = await supabase
      .from('expense_participants')
      .select('*, profiles (*)')
      .in('expense_id', expenseIds);

    if (participantsError) {
      console.error('Error fetching dashboard expense participants:', participantsError);
    } else {
      participants = participantsData as ExpenseParticipant[];
    }
  }

  // 4. Group data by group_id
  const groupsData = groups.map((group) => {
    const groupMembers = members?.filter((m) => m.group_id === group.id) || [];
    const groupExpenses = expenses?.filter((e) => e.group_id === group.id) || [];
    const groupExpenseIds = groupExpenses.map((e) => e.id);
    const groupParticipants = participants.filter((p) => groupExpenseIds.includes(p.expense_id));
    const groupSettlements = settlements?.filter((s) => s.group_id === group.id) || [];

    return {
      group,
      members: groupMembers as GroupMember[],
      expenses: groupExpenses as Expense[],
      participants: groupParticipants as ExpenseParticipant[],
      settlements: groupSettlements as Settlement[],
    };
  });

  return {
    groups,
    groupsData,
    activities: (activities || []) as ActivityLog[],
  };
}
