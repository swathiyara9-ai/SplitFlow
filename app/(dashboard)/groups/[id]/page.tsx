'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft, 
  Users, 
  Plus, 
  Trash2, 
  FileText, 
  Check, 
  DollarSign, 
  Loader2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  HelpCircle,
  FileImage,
  Upload,
  Activity,
  History,
  X
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { getGroupDetails, getGroupMembers, addMemberByUniqueId } from '@/services/group';
import { createExpense, getGroupExpenses, deleteExpense, uploadReceipt, deleteReceipt } from '@/services/expense';
import { createSettlement, getGroupSettlements } from '@/services/settlement';
import { getGroupActivities } from '@/services/activity';
import { calculateGroupBalances } from '@/utils/balances';
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/components/CurrencyProvider';
import { SplitMethod } from '@/types';

// Zod validation schemas
const expenseSchema = z.object({
  title: z.string().min(3, 'Expense title must be at least 3 characters'),
  description: z.string().optional(),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  paid_by: z.string().min(1, 'Payer is required'),
  split_method: z.enum(['equal', 'exact', 'percentage'] as const),
  notes: z.string().optional(),
  expense_date: z.string().min(1, 'Date is required'),
});

const memberSchema = z.object({
  unique_id: z.string().min(10, 'Unique User ID must be in format SPL-XXXXXX'),
});

const settlementSchema = z.object({
  payer: z.string().min(1, 'Payer is required'),
  receiver: z.string().min(1, 'Receiver is required'),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Amount must be positive'),
  notes: z.string().optional(),
});

export default function GroupDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const id = params.id as string;
  const { format, currency } = useCurrency();

  // Tabs state
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'settlements' | 'members' | 'activity'>('expenses');

  // Modals state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  // Form states for splits
  const [splitPayer, setSplitPayer] = useState<string>('');
  const [splitParticipants, setSplitParticipants] = useState<Record<string, { checked: boolean; value: string }>>({});

  // Receipt File upload states
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // 1. Queries
  const { data: group, isLoading: isGroupLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => getGroupDetails(supabase, id),
  });

  const { data: members = [], isLoading: isMembersLoading } = useQuery({
    queryKey: ['group-members', id],
    queryFn: () => getGroupMembers(supabase, id),
  });

  const { data: expenses = [], isLoading: isExpensesLoading } = useQuery({
    queryKey: ['group-expenses', id],
    queryFn: () => getGroupExpenses(supabase, id),
  });

  const { data: settlements = [], isLoading: isSettlementsLoading } = useQuery({
    queryKey: ['group-settlements', id],
    queryFn: () => getGroupSettlements(supabase, id),
  });

  const { data: activities = [], isLoading: isActivitiesLoading } = useQuery({
    queryKey: ['group-activities', id],
    queryFn: () => getGroupActivities(supabase, id),
  });

  // Current session profile
  const { data: currentProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => supabase.auth.getUser().then(({ data }) => 
      supabase.from('profiles').select('*').eq('id', data.user?.id).single().then((res) => res.data)
    ),
  });

  const userId = currentProfile?.id || '';

  // 2. Realtime sync triggers
  useRealtimeSubscription('expenses', [['group-expenses', id], ['group-activities', id]]);
  useRealtimeSubscription('expense_participants', [['group-expenses', id]]);
  useRealtimeSubscription('settlements', [['group-settlements', id], ['group-activities', id]]);
  useRealtimeSubscription('group_members', [['group-members', id], ['group-activities', id]]);
  useRealtimeSubscription('activity_logs', [['group-activities', id], ['dashboard']]);

  // 3. Balance Calculations
  const allParticipants = expenses.flatMap((e) => e.participants);
  const { memberBalances, peerDebts } = calculateGroupBalances(
    members,
    expenses,
    allParticipants,
    settlements
  );

  // 4. Mutations
  const addMemberMutation = useMutation({
    mutationFn: async (data: { unique_id: string }) => {
      const res = await addMemberByUniqueId(supabase, id, data.unique_id);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', id] });
      toast.success('Member added successfully!');
      memberForm.reset();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add member.');
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      // Find the expense to see if it has a receipt
      const exp = expenses.find((e) => e.id === expenseId);
      if (exp?.receipt_url) {
        await deleteReceipt(supabase, exp.receipt_url);
      }
      const res = await deleteExpense(supabase, expenseId, id);
      if (res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-expenses', id] });
      toast.success('Expense deleted successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete expense.');
    },
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (payload: { expense: any; shares: { user_id: string; share_amount: number }[] }) => {
      const res = await createExpense(supabase, payload.expense, payload.shares);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-expenses', id] });
      toast.success('Expense logged successfully!');
      setShowAddExpense(false);
      expenseForm.reset();
      setReceiptFile(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add expense.');
    },
  });

  const addSettlementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await createSettlement(supabase, {
        group_id: id,
        payer: data.payer,
        receiver: data.receiver,
        amount: parseFloat(data.amount),
        notes: data.notes,
      });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-settlements', id] });
      toast.success('Settlement payment recorded!');
      setShowAddSettlement(false);
      settlementForm.reset();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record settlement.');
    },
  });

  // Forms hook setup
  const expenseForm = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expense_date: new Date().toISOString().split('T')[0],
      split_method: 'equal',
      category: 'general',
    },
  });

  const memberForm = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
  });

  const settlementForm = useForm<z.infer<typeof settlementSchema>>({
    resolver: zodResolver(settlementSchema),
  });

  // Watch fields to dynamically update share calculations
  const watchAmount = expenseForm.watch('amount');
  const watchSplitMethod = expenseForm.watch('split_method');

  // Handle initialization of splits list when modal opens
  React.useEffect(() => {
    if (showAddExpense && members.length > 0) {
      const initial: Record<string, { checked: boolean; value: string }> = {};
      members.forEach((m) => {
        initial[m.user_id] = { checked: true, value: '' };
      });
      setSplitParticipants(initial);
      if (currentProfile) {
        expenseForm.setValue('paid_by', currentProfile.id);
      }
    }
  }, [showAddExpense, members, currentProfile, expenseForm]);

  const handleParticipantCheck = (userId: string, checked: boolean) => {
    setSplitParticipants((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], checked },
    }));
  };

  const handleParticipantValueChange = (userId: string, value: string) => {
    setSplitParticipants((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], value },
    }));
  };

  // Compute calculated shares dynamically for rendering
  const calculateShares = (): { user_id: string; name: string; share_amount: number; error?: string }[] => {
    const amt = parseFloat(watchAmount || '0');
    if (isNaN(amt) || amt <= 0) return [];

    const activeMembers = Object.entries(splitParticipants).filter(([_, status]) => status.checked);
    if (activeMembers.length === 0) return [];

    if (watchSplitMethod === 'equal') {
      const equalShare = amt / activeMembers.length;
      return activeMembers.map(([userId]) => {
        const member = members.find((m) => m.user_id === userId);
        return {
          user_id: userId,
          name: member?.profiles?.display_name || 'Member',
          share_amount: Number(equalShare.toFixed(2)),
        };
      });
    }

    if (watchSplitMethod === 'exact') {
      let sum = 0;
      const shares = activeMembers.map(([userId, status]) => {
        const member = members.find((m) => m.user_id === userId);
        const val = parseFloat(status.value || '0');
        sum += val;
        return {
          user_id: userId,
          name: member?.profiles?.display_name || 'Member',
          share_amount: val,
        };
      });

      const difference = amt - sum;
      if (Math.abs(difference) > 0.01) {
        return shares.map((s) => ({
          ...s,
          error: `Sum must equal ${amt}. Current sum is ${sum.toFixed(2)} (diff: ${difference.toFixed(2)})`,
        }));
      }
      return shares;
    }

    if (watchSplitMethod === 'percentage') {
      let sumPct = 0;
      const shares = activeMembers.map(([userId, status]) => {
        const member = members.find((m) => m.user_id === userId);
        const pct = parseFloat(status.value || '0');
        sumPct += pct;
        return {
          user_id: userId,
          name: member?.profiles?.display_name || 'Member',
          share_amount: Number(((pct / 100) * amt).toFixed(2)),
        };
      });

      const differencePct = 100 - sumPct;
      if (Math.abs(differencePct) > 0.01) {
        return shares.map((s) => ({
          ...s,
          error: `Percentage sum must equal 100%. Current sum is ${sumPct}%`,
        }));
      }
      return shares;
    }

    return [];
  };

  const calculatedShares = calculateShares();
  const hasShareError = calculatedShares.some((s) => s.error !== undefined);

  const handleExpenseSubmit = async (data: z.infer<typeof expenseSchema>) => {
    if (hasShareError || calculatedShares.length === 0) {
      toast.error('Please correct splitting values before saving.');
      return;
    }

    setUploadingReceipt(true);
    let finalReceiptUrl = '';

    try {
      if (receiptFile) {
        const uploadResult = await uploadReceipt(supabase, id, receiptFile);
        if (uploadResult.error) {
          toast.error(`Receipt upload failed: ${uploadResult.error}`);
        } else if (uploadResult.url) {
          finalReceiptUrl = uploadResult.url;
        }
      }

      addExpenseMutation.mutate({
        expense: {
          group_id: id,
          title: data.title,
          description: data.description,
          amount: parseFloat(data.amount),
          paid_by: data.paid_by,
          split_method: data.split_method,
          category: data.category,
          notes: data.notes,
          receipt_url: finalReceiptUrl || undefined,
          expense_date: data.expense_date,
        },
        shares: calculatedShares.map((s) => ({
          user_id: s.user_id,
          share_amount: s.share_amount,
        })),
      });
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Quick action: click a debt to open settlement recorder
  const triggerQuickSettlement = (debt: any) => {
    settlementForm.setValue('payer', debt.from);
    settlementForm.setValue('receiver', debt.to);
    settlementForm.setValue('amount', debt.amount.toString());
    settlementForm.setValue('notes', `Settling balance between ${debt.from_name} and ${debt.to_name}`);
    setShowAddSettlement(true);
  };

  const isLoading = isGroupLoading || isMembersLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-premium animate-pulse"></div>
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-premium animate-pulse"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center space-y-4 py-12">
        <AlertCircle className="w-12 h-12 text-danger mx-auto" />
        <h3 className="text-lg font-bold">Ledger Channel Not Found</h3>
        <p className="text-xs text-slate-500">The group may have been deleted or you do not have permissions.</p>
        <Link href="/dashboard" className="text-primary text-xs font-bold hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Group Header */}
      <div className="space-y-2">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{group.name}</h2>
            {group.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{group.description}</p>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowAddExpense(true)}
              className="px-4 py-2.5 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md transition-colors"
            >
              Add Expense
            </button>
            <button
              onClick={() => setShowAddSettlement(true)}
              className="px-4 py-2.5 text-xs font-bold glass-panel hover:bg-slate-100/50 dark:hover:bg-slate-900/50 rounded-xl transition-colors"
            >
              Record Payment
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-black/5 dark:border-white/5 flex gap-4 overflow-x-auto">
        {(['expenses', 'balances', 'settlements', 'members', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 text-xs font-bold border-b-2 capitalize transition-all shrink-0 ${
              activeTab === tab 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {tab === 'settlements' ? 'Settlement History' : tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        
        {/* 1. EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Group Ledger Stream</h3>
            {expenses.length === 0 ? (
              <div className="glass-panel p-8 text-center rounded-premium text-slate-500 space-y-3">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-medium">No expenses logged in this channel yet.</p>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-bold rounded-lg hover:bg-primary/20"
                >
                  Log First Expense
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => {
                  const payer = members.find((m) => m.user_id === expense.paid_by);
                  
                  // Find what the user owes or lent for this expense
                  const userParticipation = expense.participants.find((p) => p.user_id === userId);
                  const isPayer = expense.paid_by === userId;

                  let standingText = '';
                  let standingColor = 'text-slate-400';

                  if (isPayer) {
                    const totalLent = expense.amount - (userParticipation?.share_amount || 0);
                    standingText = totalLent > 0 ? `You lent ${format(totalLent)}` : 'You paid';
                    standingColor = 'text-success';
                  } else if (userParticipation) {
                    standingText = `You borrow ${format(Number(userParticipation.share_amount))}`;
                    standingColor = 'text-danger';
                  } else {
                    standingText = 'Not involved';
                  }

                  return (
                    <div 
                      key={expense.id}
                      className="glass-panel p-4 rounded-premium flex items-center justify-between shadow-layered hover:border-black/10 dark:hover:border-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Icon placeholder based on category */}
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {expense.category === 'food' && '🍔'}
                          {expense.category === 'travel' && '✈️'}
                          {expense.category === 'lodging' && '🏡'}
                          {expense.category === 'entertainment' && '🎬'}
                          {expense.category === 'general' && '📦'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold truncate pr-4 text-slate-900 dark:text-slate-100">
                            {expense.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            Paid by <span className="font-semibold">{payer?.profiles?.display_name || 'Deleted User'}</span> • {new Date(expense.expense_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{format(Number(expense.amount))}</p>
                          <p className={`text-[10px] ${standingColor} font-semibold mt-0.5`}>{standingText}</p>
                        </div>
                        
                        {expense.receipt_url && (
                          <button
                            onClick={() => setSelectedReceiptUrl(expense.receipt_url || null)}
                            className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg hover:text-primary transition-colors text-slate-400"
                            title="View Receipt"
                          >
                            <FileImage className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (confirm('Delete this ledger record permanently?')) {
                              deleteExpenseMutation.mutate(expense.id);
                            }
                          }}
                          className="p-2 hover:text-danger rounded-lg transition-colors text-slate-400"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. BALANCES & DEBTS TAB */}
        {activeTab === 'balances' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Member Standings */}
            <div className="glass-panel p-5 rounded-premium shadow-layered space-y-4">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-black/5 dark:border-white/5 pb-2">
                Member Standing Index
              </h3>
              <div className="space-y-3">
                {members.map((member) => {
                  const bal = memberBalances[member.user_id] || 0;
                  return (
                    <div key={member.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                          {member.profiles?.display_name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {member.profiles?.display_name}
                        </span>
                      </div>
                      <span className={`font-bold ${
                        bal > 0.01 
                          ? 'text-success' 
                          : bal < -0.01 
                          ? 'text-danger' 
                          : 'text-slate-400'
                      }`}>
                        {bal > 0.01 
                          ? `+ ${format(bal)}` 
                          : bal < -0.01 
                          ? `- ${format(Math.abs(bal))}` 
                          : 'Settled'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Peer to Peer Debts (Greedy Minimized) */}
            <div className="glass-panel p-5 rounded-premium shadow-layered space-y-4">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-black/5 dark:border-white/5 pb-2">
                Optimal Settlement Path
              </h3>
              {peerDebts.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">All ledger balances settled. Perfect standing!</p>
              ) : (
                <div className="space-y-3">
                  {peerDebts.map((debt, index) => (
                    <div 
                      key={index} 
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                    >
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold">
                          <span className="text-danger">{debt.from_name}</span> owes <span className="text-success">{debt.to_name}</span>
                        </p>
                        <span className="text-[10px] text-slate-400 font-bold tracking-tight">Amount: {format(debt.amount)}</span>
                      </div>
                      <button
                        onClick={() => triggerQuickSettlement(debt)}
                        className="px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-[10px] font-bold transition-all"
                      >
                        Settle Debt
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. SETTLEMENT HISTORY TAB */}
        {activeTab === 'settlements' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Settlement Ledger Logs</h3>
            {settlements.length === 0 ? (
              <div className="glass-panel p-8 text-center rounded-premium text-slate-500 space-y-2">
                <History className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-medium">No settlements logged yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {settlements.map((s) => (
                  <div 
                    key={s.id} 
                    className="glass-panel p-4 rounded-premium shadow-layered flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        <span className="text-primary font-bold">{s.payer_profile?.display_name || 'Member'}</span> settled balance with{' '}
                        <span className="text-primary font-bold">{s.receiver_profile?.display_name || 'Member'}</span>
                      </p>
                      {s.notes && <p className="text-[11px] text-slate-400 italic">"{s.notes}"</p>}
                      <span className="text-[10px] text-slate-400 block">{new Date(s.settled_at).toLocaleDateString()}</span>
                    </div>
                    <span className="text-xs font-bold text-success bg-success/15 px-3 py-1.5 rounded-xl shrink-0">
                      {format(Number(s.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. MEMBERS TAB */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add Member Card */}
            <div className="glass-panel p-5 rounded-premium shadow-layered space-y-4 self-start">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-black/5 dark:border-white/5 pb-2">
                Invite Member Node
              </h3>
              <form onSubmit={memberForm.handleSubmit((data) => addMemberMutation.mutate(data))} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Share ID Code</label>
                  <input
                    type="text"
                    placeholder="e.g. SPL-A73KF9"
                    {...memberForm.register('unique_id')}
                    className="w-full text-xs font-semibold bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {memberForm.formState.errors.unique_id && (
                    <p className="text-[10px] text-danger font-semibold">{memberForm.formState.errors.unique_id.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={addMemberMutation.isPending}
                  className="w-full py-2.5 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {addMemberMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add Member
                </button>
              </form>
            </div>

            {/* Members List */}
            <div className="md:col-span-2 glass-panel p-5 rounded-premium shadow-layered space-y-4">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-black/5 dark:border-white/5 pb-2">
                Active Node Directory
              </h3>
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs py-1.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {m.profiles?.display_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{m.profiles?.display_name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{m.profiles?.unique_user_id}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">Joined {new Date(m.joined_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Group Operations Audit log</h3>
            {activities.length === 0 ? (
              <div className="glass-panel p-8 text-center rounded-premium text-slate-500 space-y-2">
                <Activity className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-medium">No activity logged.</p>
              </div>
            ) : (
              <div className="glass-panel p-6 rounded-premium shadow-layered">
                <div className="relative border-l-2 border-slate-100 dark:border-slate-900 pl-4 ml-1 space-y-5">
                  {activities.map((act) => (
                    <div key={act.id} className="relative text-xs space-y-1">
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-white dark:ring-slate-950"></span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {act.description
                          .replace(/\$/g, currency.symbol)
                          .replace(/\((\d+(?:\.\d{2})?)\)/g, `(${currency.symbol}$1)`)
                          .replace(/\bfor (\d+(?:\.\d{2})?)\b/g, `for ${currency.symbol}$1`)}
                      </p>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Log entry by {act.profiles?.display_name || 'System'} • {new Date(act.created_at).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ================= MODALS & DIALOGS ================= */}

      {/* 1. ADD EXPENSE MODAL */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg p-6 rounded-premium shadow-2xl relative bg-white dark:bg-slate-950 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Log Transaction Outflow</h3>
              <button 
                onClick={() => {
                  setShowAddExpense(false);
                  setReceiptFile(null);
                }} 
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={expenseForm.handleSubmit(handleExpenseSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Title */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transaction Context</label>
                  <input
                    type="text"
                    placeholder="e.g. Reykjavik Diesel Refuel"
                    {...expenseForm.register('title')}
                    className="w-full text-xs font-semibold bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {expenseForm.formState.errors.title && (
                    <p className="text-[10px] text-danger font-semibold">{expenseForm.formState.errors.title.message}</p>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount ({currency.symbol} {currency.code})</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{currency.symbol}</span>
                    <input
                      type="text"
                      placeholder="0.00"
                      {...expenseForm.register('amount')}
                      className="w-full text-xs font-bold bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl pl-7 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {expenseForm.formState.errors.amount && (
                    <p className="text-[10px] text-danger font-semibold">{expenseForm.formState.errors.amount.message}</p>
                  )}
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transaction Date</label>
                  <input
                    type="date"
                    {...expenseForm.register('expense_date')}
                    className="w-full text-xs font-semibold bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Paid By */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid By</label>
                  <select
                    {...expenseForm.register('paid_by')}
                    className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.profiles?.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                  <select
                    {...expenseForm.register('category')}
                    className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="general">General</option>
                    <option value="food">Food & Groceries</option>
                    <option value="travel">Transport & Fuel</option>
                    <option value="lodging">Hotel & Lodging</option>
                    <option value="entertainment">Entertainment</option>
                  </select>
                </div>

                {/* Split Method */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partition Method</label>
                  <select
                    {...expenseForm.register('split_method')}
                    className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="equal">Split Equally</option>
                    <option value="exact">Exact Split (Amounts)</option>
                    <option value="percentage">Percentage Split (%)</option>
                  </select>
                </div>
              </div>

              {/* Split Weights Input */}
              <div className="space-y-3 border-t border-black/5 dark:border-white/5 pt-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Split Weights</label>
                <div className="space-y-2">
                  {members.map((member) => {
                    const status = splitParticipants[member.user_id] || { checked: true, value: '' };
                    return (
                      <div key={member.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={status.checked}
                            onChange={(e) => handleParticipantCheck(member.user_id, e.target.checked)}
                            className="rounded border-slate-300 dark:border-slate-800 text-primary focus:ring-primary w-4 h-4"
                          />
                          <span className="font-semibold">{member.profiles?.display_name}</span>
                        </div>

                        {status.checked && watchSplitMethod !== 'equal' && (
                          <div className="relative w-24 flex items-center">
                            {watchSplitMethod === 'exact' && (
                              <span className="absolute left-2.5 text-[10px] font-bold text-slate-400">{currency.symbol}</span>
                            )}
                            <input
                              type="text"
                              value={status.value}
                              placeholder={watchSplitMethod === 'exact' ? '0.00' : '0%'}
                              onChange={(e) => handleParticipantValueChange(member.user_id, e.target.value)}
                              className="w-full text-xs font-bold text-right bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            {watchSplitMethod === 'percentage' && (
                              <span className="absolute right-2.5 text-[10px] font-bold text-slate-400">%</span>
                            )}
                          </div>
                        )}

                        {status.checked && watchSplitMethod === 'equal' && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {format((parseFloat(watchAmount || '0') || 0) / Object.values(splitParticipants).filter(p => p.checked).length)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic split details output */}
              {calculatedShares.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1.5 text-[11px] border border-black/5 dark:border-white/5">
                  <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px]">Calculated partition values:</span>
                  {calculatedShares.map((s, idx) => (
                    <div key={idx} className="flex justify-between font-semibold">
                      <span className="text-slate-500">{s.name}</span>
                      <span className={s.error ? 'text-danger' : 'text-slate-800 dark:text-slate-200'}>
                        {s.error ? s.error : format(s.share_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Receipt Image File upload input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Optional Receipt Upload (image/pdf)</label>
                <div className="border border-dashed border-white/10 rounded-xl p-3 flex items-center justify-between gap-3 bg-slate-950/10">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400 font-medium">
                      {receiptFile ? receiptFile.name : 'Select receipt file'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setReceiptFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    id="receipt-upload"
                  />
                  <label
                    htmlFor="receipt-upload"
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-primary hover:text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shrink-0"
                  >
                    Browse Files
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-black/5 dark:border-white/5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddExpense(false);
                    setReceiptFile(null);
                  }}
                  className="w-1/2 py-2.5 text-xs font-bold glass-panel hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addExpenseMutation.isPending || uploadingReceipt || hasShareError}
                  className="w-1/2 py-2.5 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {(addExpenseMutation.isPending || uploadingReceipt) ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Logging Expense...
                    </>
                  ) : (
                    'Log Outflow'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. RECORD SETTLEMENT MODAL */}
      {showAddSettlement && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-premium shadow-2xl relative bg-white dark:bg-slate-950 space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Record Settlement Payment</h3>
              <button onClick={() => setShowAddSettlement(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={settlementForm.handleSubmit((data) => addSettlementMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Payer */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From (Payer)</label>
                  <select
                    {...settlementForm.register('payer')}
                    className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.profiles?.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Receiver */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To (Receiver)</label>
                  <select
                    {...settlementForm.register('receiver')}
                    className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.profiles?.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Amount ({currency.symbol} {currency.code})</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{currency.symbol}</span>
                    <input
                      type="text"
                      placeholder="0.00"
                      {...settlementForm.register('amount')}
                      className="w-full text-xs font-bold bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl pl-8 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {settlementForm.formState.errors.amount && (
                    <p className="text-[10px] text-danger font-semibold">{settlementForm.formState.errors.amount.message}</p>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settlement Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Venmo transfer reference code"
                    {...settlementForm.register('notes')}
                    className="w-full text-xs font-semibold bg-slate-950/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-black/5 dark:border-white/5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddSettlement(false)}
                  className="w-1/2 py-2.5 text-xs font-bold glass-panel hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSettlementMutation.isPending}
                  className="w-1/2 py-2.5 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {addSettlementMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Record Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. RECEIPT PREVIEW MODAL */}
      {selectedReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-5 rounded-premium bg-white dark:bg-slate-950 flex flex-col gap-4 relative">
            <button 
              onClick={() => setSelectedReceiptUrl(null)} 
              className="absolute right-4 top-4 p-1 rounded-lg bg-black/40 text-white hover:bg-black/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-black/5 dark:border-white/5 pb-2">
              Receipt File Preview
            </h4>
            
            <div className="flex-1 overflow-hidden rounded-xl border border-black/5 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center max-h-[60vh]">
              {selectedReceiptUrl.endsWith('.pdf') ? (
                <div className="p-8 text-center space-y-4">
                  <FileText className="w-16 h-16 text-primary mx-auto animate-bounce" />
                  <p className="text-xs font-semibold">PDF Receipt Document</p>
                  <a
                    href={selectedReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold"
                  >
                    Open Document in New Tab
                  </a>
                </div>
              ) : (
                <img 
                  src={selectedReceiptUrl} 
                  alt="Receipt Preview" 
                  className="max-w-full max-h-[50vh] object-contain"
                />
              )}
            </div>
            
            <button
              onClick={() => setSelectedReceiptUrl(null)}
              className="w-full py-2.5 text-xs font-bold bg-slate-100 dark:bg-slate-900 rounded-xl"
            >
              Dismiss Preview
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
