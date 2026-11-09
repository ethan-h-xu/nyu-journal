-- Profiles: one row per user who has picked a username.
--
-- A row only exists once the user has chosen a username, so "no profile row"
-- is how the app knows to show the username setup screen. That covers new
-- sign-ins and accounts created before usernames existed the same way, with
-- no backfill.
--
-- Usernames and bios are public to every signed-in user (for lookup); they
-- carry nothing from the Google account. The checks mirror src/profile/types.ts.

create table public.profiles (
  id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Stored lowercase, so uniqueness is case-insensitive without citext.
  username    text not null unique
              check (username ~ '^[a-z0-9_]{3,20}$')
              check (username <> all (array[
                'admin', 'administrator', 'root', 'support', 'help', 'moderator', 'mod',
                'staff', 'system', 'official', 'nyu', 'shtboxd', 'sh_tboxd', 'null',
                'undefined', 'anonymous', 'deleted', 'me', 'you', 'everyone'
              ])),
  bio         text not null default '' check (char_length(bio) <= 160),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Public username and bio for each user who has set one up.';

-- Prefix search for user lookup (username like 'abc%'); the unique index alone
-- can't serve LIKE under a non-C collation.
create index profiles_username_prefix_idx on public.profiles (username text_pattern_ops);

-- Keep the owner and creation time fixed on update, and stamp updated_at.
create function public.profiles_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_update
before update on public.profiles
for each row execute function public.profiles_before_update();

-- Row-level security.
alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Only these columns can be written; id comes from the default (auth.uid()).
grant insert (username, bio) on public.profiles to authenticated;
grant update (username, bio) on public.profiles to authenticated;
-- No delete grant: a profile goes away with its account (on delete cascade).

create policy "Signed-in users can read profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "Users can edit their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
