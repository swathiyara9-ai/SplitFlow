-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create tables
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null unique,
  display_name text not null,
  unique_user_id text not null unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  title text not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  paid_by uuid references public.profiles(id) on delete restrict not null,
  split_method text not null check (split_method in ('equal', 'exact', 'percentage')),
  category text not null,
  notes text,
  receipt_url text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  share_amount numeric(12,2) not null check (share_amount >= 0),
  payment_status text not null check (payment_status in ('unpaid', 'settled')) default 'unpaid',
  created_at timestamptz not null default now(),
  unique (expense_id, user_id)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  payer uuid references public.profiles(id) on delete restrict not null,
  receiver uuid references public.profiles(id) on delete restrict not null,
  amount numeric(12,2) not null check (amount > 0),
  notes text,
  settled_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  performed_by uuid references public.profiles(id) on delete set null,
  action text not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- 2. Create helper functions and triggers
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

create trigger set_groups_updated_at
  before update on public.groups
  for each row execute procedure public.update_updated_at_column();

create trigger set_expenses_updated_at
  before update on public.expenses
  for each row execute procedure public.update_updated_at_column();

-- Function to generate a unique user ID of format SPL-XXXXXX
create or replace function public.generate_unique_user_id()
returns text as $$
declare
  new_id text;
  exists_id boolean;
begin
  loop
    new_id := 'SPL-' || 
      (select string_agg(substring('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' from (random() * 35 + 1)::integer for 1), '')
       from generate_series(1, 6));
    
    select exists(select 1 from public.profiles where unique_user_id = new_id) into exists_id;
    if not exists_id then
      return new_id;
    end if;
  end loop;
end;
$$ language plpgsql;

-- Trigger to automatically create a profile after signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, unique_user_id, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    public.generate_unique_user_id(),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger to automatically add group creator to group_members and log activity
create or replace function public.handle_new_group()
returns trigger as $$
begin
  -- Add creator to members
  insert into public.group_members (group_id, user_id)
  values (new.id, new.created_by);
  
  -- Log activity
  insert into public.activity_logs (group_id, performed_by, action, description)
  values (new.id, new.created_by, 'group_created', 'Group was created');
  
  return new;
end;
$$ language plpgsql security definer;

create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();

-- Helper function to search for profiles by unique user id (bypasses direct profiles RLS SELECT restrict)
create or replace function public.find_profile_by_unique_id(uid_search text)
returns table (
  id uuid,
  email text,
  display_name text,
  unique_user_id text,
  avatar_url text
) as $$
begin
  return query
  select p.id, p.email, p.display_name, p.unique_user_id, p.avatar_url
  from public.profiles p
  where p.unique_user_id = upper(uid_search);
end;
$$ language plpgsql security definer;

-- Helper function to check group membership (bypasses RLS internally to prevent recursion)
create or replace function public.check_user_in_group(group_id uuid, user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.group_members
    where group_members.group_id = $1 and group_members.user_id = $2
  );
end;
$$ language plpgsql security definer;

-- 3. Row Level Security (RLS) Configuration
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.settlements enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles Policies
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

create policy "Allow profile update to owner"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Groups Policies
create policy "Allow group read access to members"
  on public.groups for select
  to authenticated
  using (
    auth.uid() = created_by or
    public.check_user_in_group(id, auth.uid())
  );

create policy "Allow group insert to authenticated users"
  on public.groups for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Allow group update to members"
  on public.groups for update
  to authenticated
  using (
    public.check_user_in_group(id, auth.uid())
  );

create policy "Allow group delete to members"
  on public.groups for delete
  to authenticated
  using (
    public.check_user_in_group(id, auth.uid())
  );

-- Group Members Policies
create policy "Allow group member read access to fellow members"
  on public.group_members for select
  to authenticated
  using (
    public.check_user_in_group(group_id, auth.uid())
  );

create policy "Allow adding group members to existing members"
  on public.group_members for insert
  to authenticated
  with check (
    public.check_user_in_group(group_id, auth.uid())
  );

create policy "Allow removing group members to existing members"
  on public.group_members for delete
  to authenticated
  using (
    public.check_user_in_group(group_id, auth.uid())
  );

-- Expenses Policies
create policy "Allow expense read access to members"
  on public.expenses for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members 
      where group_id = public.expenses.group_id and user_id = auth.uid()
    )
  );

create policy "Allow expense insert to members"
  on public.expenses for insert
  to authenticated
  with check (
    exists (
      select 1 from public.group_members 
      where group_id = public.expenses.group_id and user_id = auth.uid()
    )
  );

create policy "Allow expense update to members"
  on public.expenses for update
  to authenticated
  using (
    exists (
      select 1 from public.group_members 
      where group_id = public.expenses.group_id and user_id = auth.uid()
    )
  );

create policy "Allow expense delete to members"
  on public.expenses for delete
  to authenticated
  using (
    exists (
      select 1 from public.group_members 
      where group_id = public.expenses.group_id and user_id = auth.uid()
    )
  );

-- Expense Participants Policies
create policy "Allow participant read access to members"
  on public.expense_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      join public.expenses e on gm.group_id = e.group_id
      where e.id = public.expense_participants.expense_id and gm.user_id = auth.uid()
    )
  );

create policy "Allow participant insert to members"
  on public.expense_participants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.group_members gm
      join public.expenses e on gm.group_id = e.group_id
      where e.id = public.expense_participants.expense_id and gm.user_id = auth.uid()
    )
  );

create policy "Allow participant update to members"
  on public.expense_participants for update
  to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      join public.expenses e on gm.group_id = e.group_id
      where e.id = public.expense_participants.expense_id and gm.user_id = auth.uid()
    )
  );

create policy "Allow participant delete to members"
  on public.expense_participants for delete
  to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      join public.expenses e on gm.group_id = e.group_id
      where e.id = public.expense_participants.expense_id and gm.user_id = auth.uid()
    )
  );

-- Settlements Policies
create policy "Allow settlements read access to members"
  on public.settlements for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members 
      where group_id = public.settlements.group_id and user_id = auth.uid()
    )
  );

create policy "Allow settlements insert to members"
  on public.settlements for insert
  to authenticated
  with check (
    exists (
      select 1 from public.group_members 
      where group_id = public.settlements.group_id and user_id = auth.uid()
    )
  );

-- Activity Logs Policies
create policy "Allow activity read access to members"
  on public.activity_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.group_members 
      where group_id = public.activity_logs.group_id and user_id = auth.uid()
    )
  );

create policy "Allow activity insert to members"
  on public.activity_logs for insert
  to authenticated
  with check (
    exists (
      select 1 from public.group_members 
      where group_id = public.activity_logs.group_id and user_id = auth.uid()
    )
  );

-- 4. Create storage bucket & policies
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "Group members can upload receipts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts' and
  exists (
    select 1 from public.group_members
    where group_id = split_part(name, '/', 1)::uuid
    and user_id = auth.uid()
  )
);

create policy "Group members can view receipts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts' and
  exists (
    select 1 from public.group_members
    where group_id = split_part(name, '/', 1)::uuid
    and user_id = auth.uid()
  )
);

create policy "Group members can delete receipts"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts' and
  exists (
    select 1 from public.group_members
    where group_id = split_part(name, '/', 1)::uuid
    and user_id = auth.uid()
  )
);
