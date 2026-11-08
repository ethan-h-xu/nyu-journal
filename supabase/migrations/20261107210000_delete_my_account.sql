-- Lets a signed-in user delete their own account. Their entries go with it,
-- through entries.user_id's "on delete cascade".
--
-- Runs as the function's owner (security definer) because users can't touch
-- auth.users directly. It only ever deletes the caller's own row.
create function public.delete_my_account()
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
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
