-- Friendships: one row per pair of users, from a request until it's removed.
--
-- A row starts 'pending' (requester asked addressee) and becomes 'accepted'
-- when the addressee accepts. Declining, cancelling and unfriending all delete
-- the row, so either side can ask again later.
--
-- Users can read rows they're part of, but can't write the table directly:
-- every change goes through the functions below, so nobody can, say, insert
-- an already-accepted friendship or accept a request on someone else's behalf.
--
-- Both ends reference profiles rather than auth.users, so only users with a
-- username can be friends, and the API can embed each side's profile.

create table public.friendships (
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  -- When the addressee accepted; null while pending.
  responded_at  timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

comment on table public.friendships is 'Friend requests (pending) and friendships (accepted) between two users.';

-- At most one row per pair, whichever direction it was sent in.
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
-- The primary key covers lookups by requester; this covers the addressee side.
create index friendships_addressee_idx on public.friendships (addressee_id, requester_id);

alter table public.friendships enable row level security;

revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

create policy "Users can read their own friendships and requests"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Sends a friend request to `target`, or accepts theirs if they already sent
-- one. Returns the pair's status afterwards: 'pending' or 'accepted'.
create function public.send_friend_request(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if target is null or target = uid then
    raise exception 'You can''t friend yourself' using errcode = '22023';
  end if;

  -- They already asked us: accept.
  update public.friendships
     set status = 'accepted', responded_at = now()
   where requester_id = target and addressee_id = uid and status = 'pending';
  if found then
    return 'accepted';
  end if;

  -- The foreign keys reject a target (or caller) without a profile.
  insert into public.friendships (requester_id, addressee_id)
  values (uid, target)
  on conflict do nothing;

  -- New, or already existed (our earlier request, or an existing friendship).
  select f.status into result
    from public.friendships f
   where least(f.requester_id, f.addressee_id) = least(uid, target)
     and greatest(f.requester_id, f.addressee_id) = greatest(uid, target);
  return result;
end;
$$;

-- Accepts or declines a pending request that `requester` sent the caller.
create function public.respond_to_friend_request(requester uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if accept then
    update public.friendships
       set status = 'accepted', responded_at = now()
     where requester_id = requester and addressee_id = uid and status = 'pending';
  else
    delete from public.friendships
     where requester_id = requester and addressee_id = uid and status = 'pending';
  end if;

  if not found then
    raise exception 'That friend request no longer exists' using errcode = 'P0002';
  end if;
end;
$$;

-- Removes whatever is between the caller and `other`: cancels a request the
-- caller sent, declines one they received, or ends a friendship. A no-op if
-- there's nothing to remove.
create function public.remove_friend(other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  delete from public.friendships
   where (requester_id = uid and addressee_id = other)
      or (requester_id = other and addressee_id = uid);
end;
$$;

-- Whether the caller and `other` are friends. For row-level security
-- policies (diary entries, likes), so it runs as owner and skips this
-- table's own policy.
create function public.is_friend_of_me(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.friendships f
     where f.status = 'accepted'
       and ((f.requester_id = (select auth.uid()) and f.addressee_id = other)
         or (f.requester_id = other and f.addressee_id = (select auth.uid())))
  );
$$;

revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_to_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.is_friend_of_me(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.is_friend_of_me(uuid) to authenticated;
