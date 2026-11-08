-- Run this in the Supabase SQL Editor before deploying the app.
create table if not exists public.cebu_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.sync_cebu_current_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.cebu_profiles (id, email) values (new.id, lower(new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists cebu_current_profile_on_auth_user on auth.users;
create trigger cebu_current_profile_on_auth_user after insert or update of email on auth.users
for each row execute function public.sync_cebu_current_profile();

create table if not exists public.cebu_login_guards (
  email text primary key,
  failed_count integer not null default 0 check (failed_count between 0 and 2),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.cebu_security_events (
  id uuid primary key default gen_random_uuid(),
  attempted_email text not null,
  event_type text not null check (event_type in ('failed', 'locked', 'blocked')),
  ip_address text,
  city text,
  region text,
  country text,
  user_agent text not null default 'Unknown browser',
  created_at timestamptz not null default now()
);

create index if not exists cebu_security_events_created_at_idx on public.cebu_security_events (created_at desc);
create index if not exists cebu_security_events_email_idx on public.cebu_security_events (attempted_email, created_at desc);

alter table public.cebu_profiles enable row level security;
alter table public.cebu_login_guards enable row level security;
alter table public.cebu_security_events enable row level security;
revoke all on public.cebu_profiles, public.cebu_login_guards, public.cebu_security_events from anon, authenticated;
grant all on public.cebu_profiles, public.cebu_login_guards, public.cebu_security_events to service_role;

create or replace function public.cebu_check_login_gate(
  p_email text, p_ip text, p_user_agent text, p_city text, p_region text, p_country text
)
returns table (allowed boolean, seconds_remaining integer)
language plpgsql security definer set search_path = '' as $$
declare v_until timestamptz;
begin
  select g.locked_until into v_until from public.cebu_login_guards g where g.email = lower(p_email);
  if v_until is not null and v_until > now() then
    insert into public.cebu_security_events (attempted_email,event_type,ip_address,city,region,country,user_agent)
    values (lower(p_email),'blocked',p_ip,p_city,p_region,p_country,left(coalesce(p_user_agent,'Unknown browser'),700));
    return query select false, greatest(1, ceil(extract(epoch from (v_until-now())))::integer);
    return;
  end if;
  return query select true, 0;
end;
$$;

create or replace function public.cebu_record_login_failure(
  p_email text, p_ip text, p_user_agent text, p_city text, p_region text, p_country text
)
returns table (locked boolean, attempts_remaining integer)
language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_until timestamptz;
begin
  insert into public.cebu_login_guards (email,failed_count,locked_until)
  values (lower(p_email),0,null) on conflict (email) do nothing;
  select g.failed_count,g.locked_until into v_count,v_until
    from public.cebu_login_guards g where g.email=lower(p_email) for update;
  if v_until is not null and v_until > now() then
    insert into public.cebu_security_events (attempted_email,event_type,ip_address,city,region,country,user_agent)
    values (lower(p_email),'blocked',p_ip,p_city,p_region,p_country,left(coalesce(p_user_agent,'Unknown browser'),700));
    return query select true, 0;
    return;
  end if;
  if v_until is not null then v_count := 0; end if;
  v_count := v_count + 1;
  if v_count >= 3 then
    update public.cebu_login_guards set failed_count=0, locked_until=now()+interval '5 minutes', updated_at=now()
    where email=lower(p_email);
    insert into public.cebu_security_events (attempted_email,event_type,ip_address,city,region,country,user_agent)
    values (lower(p_email),'locked',p_ip,p_city,p_region,p_country,left(coalesce(p_user_agent,'Unknown browser'),700));
    return query select true, 0;
  else
    update public.cebu_login_guards set failed_count=v_count, locked_until=null, updated_at=now()
    where email=lower(p_email);
    insert into public.cebu_security_events (attempted_email,event_type,ip_address,city,region,country,user_agent)
    values (lower(p_email),'failed',p_ip,p_city,p_region,p_country,left(coalesce(p_user_agent,'Unknown browser'),700));
    return query select false, 3-v_count;
  end if;
  delete from public.cebu_security_events where created_at < now()-interval '90 days';
end;
$$;

create or replace function public.cebu_clear_login_guard(p_email text)
returns void language sql security definer set search_path = '' as $$
  update public.cebu_login_guards set failed_count=0, locked_until=null, updated_at=now()
  where email=lower(p_email);
$$;

revoke all on function public.cebu_check_login_gate(text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.cebu_record_login_failure(text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.cebu_clear_login_guard(text) from public, anon, authenticated;
grant execute on function public.cebu_check_login_gate(text,text,text,text,text,text) to service_role;
grant execute on function public.cebu_record_login_failure(text,text,text,text,text,text) to service_role;
grant execute on function public.cebu_clear_login_guard(text) to service_role;
