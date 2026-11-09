-- Likes on diary entries: one row per (entry, user who liked it).
--
-- You can like any entry you can see (your own, or a friend's). Who liked an
-- entry stays private: you can only read your own like rows, and everyone gets
-- counts from entry_like_summaries(), which counts every like on entries you
-- can see. Likes outlive an unfriending; they're deleted with the entry or the
-- liker's account.

create table public.entry_likes (
  entry_id    uuid not null references public.entries (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (entry_id, user_id)
);

comment on table public.entry_likes is 'Likes on diary entries. Users read only their own; counts come from entry_like_summaries().';

-- The primary key covers lookups by entry; this covers deleting an account's likes.
create index entry_likes_user_idx on public.entry_likes (user_id);

alter table public.entry_likes enable row level security;

revoke all on public.entry_likes from anon, authenticated;
grant select, delete on public.entry_likes to authenticated;
-- user_id comes from the default (auth.uid()).
grant insert (entry_id) on public.entry_likes to authenticated;

create policy "Users can see their own likes"
  on public.entry_likes for select to authenticated
  using (user_id = (select auth.uid()));

-- The subquery runs under entries' own row-level security, so "exists" means
-- "the caller can see this entry".
create policy "Users can like entries they can see"
  on public.entry_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id)
  );

create policy "Users can remove their own likes"
  on public.entry_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Like count and whether the caller liked it, for each of `entry_ids` that
-- the caller can see and that has any likes (others have none).
--
-- Runs as owner so it can count everyone's likes, which callers can't read
-- themselves; the where clause repeats entries' read policy (your own, or a
-- friend's) so it only answers for entries the caller can see. It returns
-- counts only, never who liked.
create function public.entry_like_summaries(entry_ids uuid[])
returns table (entry_id uuid, like_count integer, liked_by_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select l.entry_id, count(*)::integer, bool_or(l.user_id = (select auth.uid()))
    from public.entry_likes l
    join public.entries e on e.id = l.entry_id
   where l.entry_id = any (entry_ids)
     and (e.user_id = (select auth.uid()) or public.is_friend_of_me(e.user_id))
   group by l.entry_id;
$$;

revoke execute on function public.entry_like_summaries(uuid[]) from public, anon;
grant execute on function public.entry_like_summaries(uuid[]) to authenticated;
