-- Anyone who can see an entry (its author and the author's friends) can see
-- who liked it, not just the author.
--
-- Replaces "Authors can see who liked their entries" with a broader policy.
-- "Users can see their own likes" stays, so you still see your own likes on
-- entries you can no longer read, e.g. after being unfriended.

comment on table public.entry_likes is
  'Likes on diary entries. Readable by anyone who can see the entry, and by the liker.';

drop policy "Authors can see who liked their entries" on public.entry_likes;

-- The subquery runs under entries' own row-level security, so "exists" means
-- "the caller can see this entry".
create policy "Users can see likes on entries they can see"
  on public.entry_likes for select to authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id));
