import { SupabaseClient } from '@supabase/supabase-js';
import { ActivityLog } from '@/types';

export async function getGroupActivities(
  supabase: SupabaseClient,
  groupId: string
): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    // performed_by joins with profiles table. Next.js/Supabase will auto-detect relationship
    .select('*, profiles:performed_by (*)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching activity logs:', error);
    return [];
  }

  return data as ActivityLog[];
}
