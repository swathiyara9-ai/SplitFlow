import { SupabaseClient } from '@supabase/supabase-js';
import { Settlement } from '@/types';

export interface CreateSettlementInput {
  group_id: string;
  payer: string;
  receiver: string;
  amount: number;
  notes?: string;
}

export async function createSettlement(
  supabase: SupabaseClient,
  input: CreateSettlementInput
): Promise<{ data: Settlement | null; error: string | null }> {
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { data: null, error: 'Not authenticated' };

  // 1. Insert settlement
  const { data, error } = await supabase
    .from('settlements')
    .insert({
      group_id: input.group_id,
      payer: input.payer,
      receiver: input.receiver,
      amount: input.amount,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  // 2. Fetch display names for log
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', [input.payer, input.receiver]);

  const payerName = profiles?.find((p) => p.id === input.payer)?.display_name || 'A member';
  const receiverName = profiles?.find((p) => p.id === input.receiver)?.display_name || 'another member';

  // 3. Log Activity
  await supabase
    .from('activity_logs')
    .insert({
      group_id: input.group_id,
      performed_by: currentUser.id,
      action: 'settlement_completed',
      description: `${payerName} settled with ${receiverName} for ${Number(input.amount).toFixed(2)}`,
    });

  return { data: data as Settlement, error: null };
}

export async function getGroupSettlements(
  supabase: SupabaseClient,
  groupId: string
): Promise<Settlement[]> {
  // Fetch settlements, and fetch profiles for both payer and receiver
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('group_id', groupId)
    .order('settled_at', { ascending: false });

  if (error) {
    console.error('Error fetching settlements:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Get unique user IDs of all payers and receivers
  const userIds = Array.from(new Set(data.flatMap((s) => [s.payer, s.receiver])));

  // Fetch profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  if (profilesError) {
    console.error('Error fetching settlement profiles:', profilesError);
    return data as Settlement[];
  }

  const profilesMap = new Map(profiles.map((p) => [p.id, p]));

  return data.map((s) => ({
    ...s,
    payer_profile: profilesMap.get(s.payer),
    receiver_profile: profilesMap.get(s.receiver),
  })) as Settlement[];
}
