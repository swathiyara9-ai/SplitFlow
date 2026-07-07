-- Enable Realtime on all SplitFlow tables
-- Run this in your Supabase SQL editor AFTER running the main migration

-- Enable realtime publication for all tables
begin;
  -- Drop existing publication if it exists and recreate
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.group_members;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.expense_participants;
alter publication supabase_realtime add table public.settlements;
alter publication supabase_realtime add table public.activity_logs;
