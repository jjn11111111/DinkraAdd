-- Fix "Database error saving new user" and harden signup for production.
--
-- Profiles.account_type is ONLY guest until Stripe/webhook promotes to member.
-- registration_intent lives in auth user_metadata (app-controlled routing).
--
-- Run once in Supabase Dashboard → SQL Editor (Production + Preview).

-- 1. Ensure constraint allows legacy rows; new signups always get guest in profiles
alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('guest', 'member', 'member_pending'));

-- 2. Signup trigger: guest profile + birth fields from metadata (never member_pending in DB)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    'guest',
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

-- 3. Normalize any legacy member_pending rows to guest (intent stays in auth metadata)
update public.profiles
set account_type = 'guest', updated_at = now()
where account_type = 'member_pending';
