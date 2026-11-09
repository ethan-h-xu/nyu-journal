-- Friends can see each other's diary entries and friend lists.
--
-- Entries stay writable only by their owner; this only widens who can read
-- them. Pending requests stay visible only to the two people involved.

comment on table public.entries is
  'Journal entries; owners can change them, and owners and their friends can read them.';

drop policy "Users can read their own entries" on public.entries;

create policy "Users can read their own and their friends' entries"
  on public.entries for select to authenticated
  using (user_id = (select auth.uid()) or public.is_friend_of_me(user_id));

-- Adds to the existing "own friendships and requests" policy (policies are OR'd).
create policy "Users can read their friends' friendships"
  on public.friendships for select to authenticated
  using (
    status = 'accepted'
    and (public.is_friend_of_me(requester_id) or public.is_friend_of_me(addressee_id))
  );
