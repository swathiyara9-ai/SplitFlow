-- ============================================================
-- Clean Recursion-Free RLS Policies
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure security definer helper function is defined
create or replace function public.check_user_in_group(group_id uuid, user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.group_members
    where group_members.group_id = $1 and group_members.user_id = $2
  );
end;
$$ language plpgsql security definer;

-- 2. Drop all policies that could cause mutual recursion
drop policy if exists "Allow profile read access to self and shared group members" on public.profiles;
drop policy if exists "Allow group read access to members" on public.groups;
drop policy if exists "Allow group insert to authenticated users" on public.groups;
drop policy if exists "Allow group update to members" on public.groups;
drop policy if exists "Allow group delete to members" on public.groups;
drop policy if exists "Allow group member read access to fellow members" on public.group_members;
drop policy if exists "Allow adding group members to existing members" on public.group_members;
drop policy if exists "Allow removing group members to existing members" on public.group_members;

-- 3. Create fresh, recursion-free RLS policies using check_user_in_group()

-- Profiles
create policy "Allow profile read access to self and shared group members"
  on public.profiles for select to authenticated
  using (
    auth.uid() = id or 
    exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid()
      and public.check_user_in_group(gm.group_id, public.profiles.id)
    )
  );

-- Groups
create policy "Allow group read access to members"
  on public.groups for select to authenticated
  using (
    public.check_user_in_group(id, auth.uid())
  );

create policy "Allow group insert to authenticated users"
  on public.groups for insert to authenticated
  with check (
    auth.uid() = created_by
  );

create policy "Allow group update to members"
  on public.groups for update to authenticated
  using (
    public.check_user_in_group(id, auth.uid())
  );

create policy "Allow group delete to members"
  on public.groups for delete to authenticated
  using (
    public.check_user_in_group(id, auth.uid())
  );

-- Group Members
create policy "Allow group member read access to fellow members"
  on public.group_members for select to authenticated
  using (
    public.check_user_in_group(group_id, auth.uid())
  );

create policy "Allow adding group members to existing members"
  on public.group_members for insert to authenticated
  with check (
    public.check_user_in_group(group_id, auth.uid())
  );

create policy "Allow removing group members to existing members"
  on public.group_members for delete to authenticated
  using (
    public.check_user_in_group(group_id, auth.uid())
  );
