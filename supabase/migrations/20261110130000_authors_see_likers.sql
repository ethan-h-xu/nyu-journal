-- An entry's author can see who liked it. Everyone else still reads only
-- their own likes and gets counts from entry_like_summaries().
--
-- Policies are OR'd, so this adds to "Users can see their own likes".

comment on table public.entry_likes is
  'Likes on diary entries. Users read their own likes and the likes on their own entries; counts come from entry_like_summaries().';

create policy "Authors can see who liked their entries"
  on public.entry_likes for select to authenticated
  using (
    exists (
      select 1
        from public.entries e
       where e.id = entry_id
         and e.user_id = (select auth.uid())
    )
  );
