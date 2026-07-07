-- ============================================================
-- Fix Group Creation RLS Policy Error
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Drop the old select policy for groups
drop policy if exists "Allow group read access to members" on public.groups;

-- Re-create the select policy to allow the creator to read the group.
-- This is critical because the Next.js client does an `.insert().select()` which
-- triggers the SELECT RLS check BEFORE the AFTER INSERT trigger can add the member
-- to the group_members table.
create policy "Allow group read access to members"
  on public.groups for select to authenticated
  using (
    auth.uid() = created_by or
    public.check_user_in_group(id, auth.uid())
  );
