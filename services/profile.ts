import { SupabaseClient } from '@supabase/supabase-js';
import { Profile } from '@/types';

export async function getCurrentProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  return data as Profile;
}

export async function updateProfile(
  supabase: SupabaseClient,
  profileId: string,
  updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

export async function searchProfileByUniqueId(
  supabase: SupabaseClient,
  uniqueUserId: string
): Promise<Profile | null> {
  // Call the security definer function find_profile_by_unique_id
  const { data, error } = await supabase.rpc('find_profile_by_unique_id', {
    uid_search: uniqueUserId.trim().toUpperCase(),
  });

  if (error) {
    console.error('Error searching profile:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as Profile;
}
