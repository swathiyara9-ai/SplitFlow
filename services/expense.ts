import { SupabaseClient } from '@supabase/supabase-js';
import { Expense, ExpenseParticipant, SplitMethod } from '@/types';

export interface CreateExpenseInput {
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
}

export async function createExpense(
  supabase: SupabaseClient,
  expenseInput: CreateExpenseInput,
  shares: { user_id: string; share_amount: number }[]
): Promise<{ data: Expense | null; error: string | null }> {
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { data: null, error: 'Not authenticated' };

  // 1. Insert the expense
  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      group_id: expenseInput.group_id,
      title: expenseInput.title,
      description: expenseInput.description,
      amount: expenseInput.amount,
      paid_by: expenseInput.paid_by,
      split_method: expenseInput.split_method,
      category: expenseInput.category,
      notes: expenseInput.notes,
      receipt_url: expenseInput.receipt_url,
      expense_date: expenseInput.expense_date,
    })
    .select()
    .single();

  if (expenseError) {
    return { data: null, error: expenseError.message };
  }

  // 2. Insert participants with their shares
  const participantsToInsert = shares.map((share) => ({
    expense_id: expense.id,
    user_id: share.user_id,
    share_amount: share.share_amount,
    payment_status: 'unpaid',
  }));

  const { error: participantsError } = await supabase
    .from('expense_participants')
    .insert(participantsToInsert);

  if (participantsError) {
    // Cleanup the inserted expense if participants insertion fails
    await supabase.from('expenses').delete().eq('id', expense.id);
    return { data: null, error: participantsError.message };
  }

  // 3. Log Activity
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', expenseInput.paid_by)
    .single();

  await supabase
    .from('activity_logs')
    .insert({
      group_id: expenseInput.group_id,
      performed_by: currentUser.id,
      action: 'expense_created',
      description: `Expense "${expenseInput.title}" ($${expenseInput.amount.toFixed(2)}) was added by ${profile?.display_name || 'a member'}`,
    });

  return { data: expense as Expense, error: null };
}

export async function getGroupExpenses(
  supabase: SupabaseClient,
  groupId: string
): Promise<(Expense & { participants: ExpenseParticipant[] })[]> {
  // Fetch expenses
  const { data: expenses, error: expensesError } = await supabase
    .from('expenses')
    .select('*')
    .eq('group_id', groupId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (expensesError) {
    console.error('Error fetching expenses:', expensesError);
    return [];
  }

  if (!expenses || expenses.length === 0) return [];

  // Fetch all participants for these expenses
  const expenseIds = expenses.map((e) => e.id);
  const { data: participants, error: participantsError } = await supabase
    .from('expense_participants')
    .select('*, profiles (*)')
    .in('expense_id', expenseIds);

  if (participantsError) {
    console.error('Error fetching expense participants:', participantsError);
    return expenses.map((e) => ({ ...e, participants: [] }));
  }

  // Group participants by expense_id
  const participantsMap: Record<string, ExpenseParticipant[]> = {};
  participants.forEach((p: any) => {
    if (!participantsMap[p.expense_id]) {
      participantsMap[p.expense_id] = [];
    }
    participantsMap[p.expense_id].push(p as ExpenseParticipant);
  });

  return expenses.map((e) => ({
    ...e,
    participants: participantsMap[e.id] || [],
  }));
}

export async function deleteExpense(
  supabase: SupabaseClient,
  expenseId: string,
  groupId: string
): Promise<{ success: boolean; error: string | null }> {
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { success: false, error: 'Not authenticated' };

  // Fetch details for activity logging
  const { data: expense } = await supabase
    .from('expenses')
    .select('title, amount')
    .eq('id', expenseId)
    .single();

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Log Activity
  if (expense) {
    await supabase
      .from('activity_logs')
      .insert({
        group_id: groupId,
        performed_by: currentUser.id,
        action: 'expense_deleted',
        description: `Expense "${expense.title}" ($${Number(expense.amount).toFixed(2)}) was deleted`,
      });
  }

  return { success: true, error: null };
}

export async function uploadReceipt(
  supabase: SupabaseClient,
  groupId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `${groupId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(filePath, file);

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  // Get public/signed URL
  const { data } = supabase.storage
    .from('receipts')
    .getPublicUrl(filePath);

  return { url: data.publicUrl, error: null };
}

export async function deleteReceipt(
  supabase: SupabaseClient,
  url: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Extract path from public URL
    // Public URL format: .../storage/v1/object/public/receipts/group_id/file_name.ext
    const urlParts = url.split('/receipts/');
    if (urlParts.length < 2) {
      return { success: false, error: 'Invalid URL format' };
    }
    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from('receipts')
      .remove([filePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
