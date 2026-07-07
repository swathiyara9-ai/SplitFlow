-- ============================================================
-- Fix RLS Infinite Recursion Bug on group_members
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create a security definer function to check group membership.
-- Security definer runs with creator's privileges, bypassing RLS inside the query.
create or replace function public.check_user_in_group(group_id uuid, user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.group_members
    where group_members.group_id = $1 and group_members.user_id = $2
  );
end;
$$ language plpgsql security definer;

-- 2. Drop the old conflicting select policies
drop policy if exists "Allow profile read access to self and shared group members" on public.profiles;
drop policy if exists "Allow group member read access to fellow members" on public.group_members;
drop policy if exists "Allow adding group members to existing members" on public.group_members;
drop policy if exists "Allow removing group members to existing members" on public.group_members;

-- 3. Re-create policies using the security definer function to prevent infinite recursion
create policy "Allow profile read access to self and shared group members"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id or 
    exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid()
      and public.check_user_in_group(gm.group_id, public.profiles.id)
    )
  );

create policy "Allow group member read access to fellow members"
  on public.group_members for select
  to authenticated
  using (
    public.check_user_in_group(group_id, auth.uid()) or
    exists (
      select 1 from public.groups 
      where id = public.group_members.group_id and created_by = auth.uid()
    )
  );

create policy "Allow adding group members to existing members"
  on public.group_members for insert
  to authenticated
  with check (
    public.check_user_in_group(group_id, auth.uid()) or
    exists (
      select 1 from public.groups 
      where id = public.group_members.group_id and created_by = auth.uid()
    )
  );

create policy "Allow removing group members to existing members"
  on public.group_members for delete
  to authenticated
  using (
    public.check_user_in_group(group_id, auth.uid())
  );
