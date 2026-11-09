-- Checks friendships' row-level security and functions, who can read diary
-- entries and friend lists, and who can like and count likes, against the real
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
  ea uuid;  -- A's entry
  eb uuid;  -- B's entry
  liked boolean;
begin
  -- One diary entry each for A and B.
  perform pg_temp.act_as(a);
  insert into public.entries (building_id, visited_on) values ('zz-check', current_date)
    returning id into ea;
  perform pg_temp.act_as(b);
  insert into public.entries (building_id, visited_on) values ('zz-check', current_date)
    returning id into eb;

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

  -- A pending request shares nothing.
  perform pg_temp.act_as(b);
  select count(*) into n from public.entries where user_id = a;
  if n <> 0 then raise exception 'FAIL: B sees A''s entries while only pending'; end if;
  begin
    insert into public.entry_likes (entry_id) values (ea);
    raise exception 'FAIL: B liked A''s entry while only pending';
  exception when insufficient_privilege then null;
  end;

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

  -- Friends can read, but not change, each other's entries.
  perform pg_temp.act_as(b);
  select count(*) into n from public.entries where user_id = a;
  if n <> 1 then raise exception 'FAIL: B sees % of A''s entries, expected 1', n; end if;
  update public.entries set notes = 'hacked' where user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B edited A''s entry'; end if;
  delete from public.entries where user_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted A''s entry'; end if;

  -- Friends can like each other's entries, and anyone can like their own.
  insert into public.entry_likes (entry_id) values (ea);
  begin
    insert into public.entry_likes (entry_id, user_id) values (ea, a);
    raise exception 'FAIL: B liked as A';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.act_as(a);
  insert into public.entry_likes (entry_id) values (ea);
  select like_count, liked_by_me into n, liked from public.entry_like_summaries(array[ea]);
  if n <> 2 or not liked then raise exception 'FAIL: A sees % likes (liked: %), expected 2 and true', n, liked; end if;
  -- The author sees who liked their entry; other likers see only their own like.
  select count(*) into n from public.entry_likes where entry_id = ea;
  if n <> 2 then raise exception 'FAIL: author A reads % like rows on their entry, expected 2', n; end if;
  perform pg_temp.act_as(b);
  select count(*) into n from public.entry_likes where entry_id = ea;
  if n <> 1 then raise exception 'FAIL: B reads % like rows on A''s entry, expected only their own', n; end if;
  perform pg_temp.act_as(a);

  -- Non-friends still see nothing.
  perform pg_temp.act_as(c);
  select count(*) into n from public.entries where user_id in (a, b);
  if n <> 0 then raise exception 'FAIL: C sees % entries of non-friends', n; end if;
  select count(*) into n from public.entry_like_summaries(array[ea, eb]);
  if n <> 0 then raise exception 'FAIL: C gets like counts for non-friends'' entries'; end if;

  -- Mutual requests: C asks A, then A "asks" C, which accepts.
  perform pg_temp.act_as(c);
  perform public.send_friend_request(a);
  perform pg_temp.act_as(a);
  s := public.send_friend_request(c);
  if s <> 'accepted' then raise exception 'FAIL: mutual request returned %', s; end if;

  -- C is friends with A but not B: sees A's entries and A's friend list, not B's entries.
  perform pg_temp.act_as(c);
  select count(*) into n from public.entries where user_id = a;
  if n <> 1 then raise exception 'FAIL: C sees % of A''s entries, expected 1', n; end if;
  select count(*) into n from public.entries where user_id = b;
  if n <> 0 then raise exception 'FAIL: C sees B''s entries'; end if;
  select count(*) into n from public.friendships where requester_id = a and addressee_id = b;
  if n <> 1 then raise exception 'FAIL: C can''t see friend A''s friendship with B'; end if;
  -- C counts B's like on A's entry, though C and B aren't friends, but can't see who.
  select like_count, liked_by_me into n, liked from public.entry_like_summaries(array[ea]);
  if n <> 2 or liked then raise exception 'FAIL: C sees % likes (liked: %), expected 2 and false', n, liked; end if;
  select count(*) into n from public.entry_likes;
  if n <> 0 then raise exception 'FAIL: C can read % like rows', n; end if;
  perform pg_temp.act_as(b);
  select count(*) into n from public.friendships where c in (requester_id, addressee_id);
  if n <> 1 then raise exception 'FAIL: B can''t see friend A''s friendship with C'; end if;
  perform pg_temp.act_as(a);

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
  select count(*) into n from public.entries where user_id = a;
  if n <> 0 then raise exception 'FAIL: B still sees A''s entries after unfriending'; end if;
  select count(*) into n from public.entry_like_summaries(array[ea]);
  if n <> 0 then raise exception 'FAIL: B still gets like counts after unfriending'; end if;
  -- B can still take back their own like.
  delete from public.entry_likes where entry_id = ea;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: B couldn''t remove their like'; end if;

  raise notice 'all friendship, visibility and like checks passed';
end;
$$;

rollback;
