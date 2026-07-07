import { SupabaseClient } from '@supabase/supabase-js';
import { Group, GroupMember } from '@/types';
import { searchProfileByUniqueId } from './profile';

export async function createGroup(
  supabase: SupabaseClient,
  name: string,
  description?: string
): Promise<{ data: Group | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('groups')
    .insert({
      name,
      description,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Group, error: null };
}

export async function getUserGroups(supabase: SupabaseClient): Promise<Group[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get groups where the user is a member
  const { data, error } = await supabase
    .from('group_members')
    .select('groups (*)')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching user groups:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return [];
  }

  return (data?.map((item: any) => item.groups).filter(Boolean) || []) as Group[];
}

export async function getGroupDetails(
  supabase: SupabaseClient,
  groupId: string
): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) {
    console.error('Error fetching group details:', error);
    return null;
  }

  return data as Group;
}

export async function getGroupMembers(
  supabase: SupabaseClient,
  groupId: string
): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, profiles (*)')
    .eq('group_id', groupId);

  if (error) {
    console.error('Error fetching group members:', error);
    return [];
  }

  return data as GroupMember[];
}

export async function addMemberByUniqueId(
  supabase: SupabaseClient,
  groupId: string,
  uniqueUserId: string
): Promise<{ success: boolean; error: string | null }> {
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { success: false, error: 'Not authenticated' };

  // 1. Search for profile
  const profile = await searchProfileByUniqueId(supabase, uniqueUserId);
  if (!profile) {
    return { success: false, error: 'User Not Found.' };
  }

  // 2. Check if already a member
  const { data: existingMember, error: memberCheckError } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (memberCheckError) {
    return { success: false, error: memberCheckError.message };
  }

  if (existingMember) {
    return { success: false, error: 'User is already a member of this group.' };
  }

  // 3. Add member
  const { error: insertError } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: profile.id,
    });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  // 4. Log Activity
  await supabase
    .from('activity_logs')
    .insert({
      group_id: groupId,
      performed_by: currentUser.id,
      action: 'member_joined',
      description: `${profile.display_name} was added to the group`,
    });

  return { success: true, error: null };
}

export async function removeGroupMember(
  supabase: SupabaseClient,
  groupId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Fetch removed user details for activity logging (optional but good practice)
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();

  await supabase
    .from('activity_logs')
    .insert({
      group_id: groupId,
      performed_by: currentUser.id,
      action: 'member_left',
      description: `${profile?.display_name || 'A member'} left the group`,
    });

  return { success: true, error: null };
}
