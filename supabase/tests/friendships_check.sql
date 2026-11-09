-- Checks friendships' row-level security and functions against the real
-- database without changing it: everything runs in one transaction that is
-- rolled back at the end.
--
-- Run it whole in the Supabase dashboard's SQL editor (it runs as postgres).
-- Success is the final "all friendship checks passed" notice; any failed check
-- raises an exception naming it.

begin;

-- Three throwaway users with profiles.
insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-00000000000a', 'check-a@example.invalid'),
  ('00000000-0000-4000-a000-00000000000b', 'check-b@example.invalid'),
  ('00000000-0000-4000-a000-00000000000c', 'check-c@example.invalid');
insert into public.profiles (id, username) values
  ('00000000-0000-4000-a000-00000000000a', 'zz_check_a'),
  ('00000000-0000-4000-a000-00000000000b', 'zz_check_b'),
  ('00000000-0000-4000-a000-00000000000c', 'zz_check_c');

-- Act as a signed-in user, as the API would.
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

do $$
declare
  a constant uuid := '00000000-0000-4000-a000-00000000000a';
  b constant uuid := '00000000-0000-4000-a000-00000000000b';
  c constant uuid := '00000000-0000-4000-a000-00000000000c';
  n int;
  s text;
begin
  -- A can't write the table directly.
  perform pg_temp.act_as(a);
  begin
    insert into public.friendships (requester_id, addressee_id, status) values (a, b, 'accepted');
    raise exception 'FAIL: direct insert was allowed';
  exception when insufficient_privilege then null;
  end;

  -- A can't friend themself.
  begin
    perform public.send_friend_request(a);
    raise exception 'FAIL: self-request was allowed';
  exception when invalid_parameter_value then null;
  end;

  -- A asks B: pending, visible to A and B but not C.
  s := public.send_friend_request(b);
  if s <> 'pending' then raise exception 'FAIL: first request returned %', s; end if;
  if public.send_friend_request(b) <> 'pending' then raise exception 'FAIL: repeat request'; end if;
  select count(*) into n from public.friendships;
  if n <> 1 then raise exception 'FAIL: A sees % rows, expected 1', n; end if;
  if public.is_friend_of_me(b) then raise exception 'FAIL: pending counted as friends'; end if;

  perform pg_temp.act_as(c);
  select count(*) into n from public.friendships;
  if n <> 0 then raise exception 'FAIL: C sees % rows of A and B', n; end if;
  -- C can't accept on B's behalf.
  begin
    perform public.respond_to_friend_request(a, true);
    raise exception 'FAIL: C accepted a request sent to B';
  exception when no_data_found then null;
  end;

  -- A can't accept their own request.
  perform pg_temp.act_as(a);
  begin
    perform public.respond_to_friend_request(a, true);
    raise exception 'FAIL: requester accepted own request';
  exception when no_data_found then null;
  end;

  -- B accepts: both see a friendship.
  perform pg_temp.act_as(b);
  perform public.respond_to_friend_request(a, true);
  if not public.is_friend_of_me(a) then raise exception 'FAIL: B not friends with A'; end if;
  perform pg_temp.act_as(a);
  if not public.is_friend_of_me(b) then raise exception 'FAIL: A not friends with B'; end if;
  if public.is_friend_of_me(c) then raise exception 'FAIL: A friends with C'; end if;

  -- Mutual requests: C asks A, then A "asks" C, which accepts.
  perform pg_temp.act_as(c);
  perform public.send_friend_request(a);
  perform pg_temp.act_as(a);
  s := public.send_friend_request(c);
  if s <> 'accepted' then raise exception 'FAIL: mutual request returned %', s; end if;

  -- Declining deletes the row, so the sender can ask again.
  perform public.remove_friend(c);
  perform pg_temp.act_as(c);
  perform public.send_friend_request(a);
  perform pg_temp.act_as(a);
  perform public.respond_to_friend_request(c, false);
  select count(*) into n from public.friendships where c in (requester_id, addressee_id);
  if n <> 0 then raise exception 'FAIL: declined request still there'; end if;

  -- Unfriending works from either side.
  perform pg_temp.act_as(b);
  perform public.remove_friend(a);
  if public.is_friend_of_me(a) then raise exception 'FAIL: still friends after unfriend'; end if;

  raise notice 'all friendship checks passed';
end;
$$;

rollback;
