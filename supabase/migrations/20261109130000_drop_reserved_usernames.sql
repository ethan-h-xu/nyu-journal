-- Drop the reserved-username check added in 20261109120000_profiles.sql.
--
-- It was an unnamed column check, so Postgres picked its name; find it by its
-- definition (the "<> ALL (ARRAY[...])" list) rather than guessing.
do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  where c.conrelid = 'public.profiles'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%<> ALL%';

  if constraint_name is null then
    raise exception 'Reserved-username check not found on public.profiles';
  end if;

  execute format('alter table public.profiles drop constraint %I', constraint_name);
end;
$$;
