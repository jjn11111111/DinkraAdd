-- Fix "Database error saving new user" when registering as Member.
--
-- Cause: handle_new_user copied account_type = member_pending into profiles, but
-- profiles_account_type_check only allowed guest | member.
--
-- Run once in Supabase Dashboard → SQL Editor (Production + any Preview DB).

-- 1. Allow member_pending in profiles (transient state before Stripe checkout)
alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('guest', 'member', 'member_pending'));

-- 2. Signup trigger: always create a valid profile row; copy birth fields from auth metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_account_type text;
  profile_account_type text;
begin
  meta_account_type := coalesce(new.raw_user_meta_data->>'account_type', 'guest');

  profile_account_type := case
    when meta_account_type = 'member' then 'member'
    when meta_account_type = 'member_pending' then 'member_pending'
    else 'guest'
  end;

  insert into public.profiles (
    id,
    email,
    account_type,
    birth_name,
    birth_date,
    birth_time,
    birth_place,
    gender,
    year_started,
    readings_this_year,
    privacy_consent_at,
    data_retention_consent
  )
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data->>'email', ''),
    profile_account_type,
    nullif(new.raw_user_meta_data->>'birth_name', ''),
    nullif(new.raw_user_meta_data->>'birth_date', '')::date,
    nullif(new.raw_user_meta_data->>'birth_time', '')::time,
    nullif(new.raw_user_meta_data->>'birth_place', ''),
    nullif(new.raw_user_meta_data->>'gender', ''),
    extract(year from now())::integer,
    0,
    now(),
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
