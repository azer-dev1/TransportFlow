-- Make the owner account permanently admin.
--
-- Until now `admin` was a one-off UPDATE run by hand, and it did not survive
-- account deletion: delete-account drops the auth.users row, profiles cascades,
-- and signing up again re-runs handle_new_user() which hardcodes 'rider'. The
-- grant was silently lost twice (2026-07-04, 2026-08-02) and nobody noticed
-- until admin-gated features stopped working.
--
-- An allow-list of emails that are seeded as admin at signup fixes that: the
-- role is now derived from data, not from remembering to re-run SQL.
--
-- SECURITY: whoever controls a listed inbox becomes admin on signup. That is
-- acceptable only because mailer_autoconfirm is false, so the address must be
-- confirmed. If autoconfirm is ever turned back on, this table becomes an
-- account-takeover path — revisit it then.

create table public.bootstrap_admins (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

-- Invisible and unwritable from the client API; managed via the SQL editor /
-- service_role only. Two layers, because hosted projects auto-grant new tables
-- to the API roles (local, with auto_expose off, does not — so the REVOKE is a
-- no-op locally and load-bearing on hosted):
--   1. revoke the grants, so a request gets 42501 rather than an empty result
--   2. RLS on with zero policies, denying every row to any non-bypassing role
revoke all on public.bootstrap_admins from anon, authenticated;
alter table public.bootstrap_admins enable row level security;

insert into public.bootstrap_admins (email, note)
values ('azerdebbabi0@gmail.com', 'project owner — see PR/session 2026-08-02');

-- Same function as migration 1, with the role no longer hardcoded. Runs
-- SECURITY DEFINER so it can read bootstrap_admins despite the lack of grants.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select case when exists (
    select 1 from public.bootstrap_admins b
    where lower(b.email) = lower(new.email)
  ) then 'admin' else 'rider' end
  into v_role;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(new.email, '@', 1),
      'New Rider'
    ),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Repair any listed account that already exists as a rider (i.e. signed up
-- before this migration, or was reset by a delete-account test).
update public.profiles p
set role = 'admin'
from auth.users u
join public.bootstrap_admins b on lower(b.email) = lower(u.email)
where p.id = u.id and p.role <> 'admin';
