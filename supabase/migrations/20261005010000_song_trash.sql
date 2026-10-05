-- Shared, recoverable trash. Only the scheduled job permanently removes songs.
alter table public.songs add column if not exists deleted_at timestamptz;
create index if not exists songs_deleted on public.songs(deleted_at) where deleted_at is not null;
grant select(deleted_at) on public.songs to anon, authenticated;
alter policy "Public songs" on public.songs
 using (deleted_at is null or deleted_at > now() - interval '30 days');

create or replace function public.move_song_to_trash(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 update public.songs set deleted_at=now() where id=p_id and deleted_at is null;
 if not found then raise exception 'That song has already been moved or removed. Refresh the list.'; end if;
end; $$;

create or replace function public.restore_trashed_song(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 update public.songs set deleted_at=null
 where id=p_id and deleted_at is not null and deleted_at > now() - interval '30 days';
 if not found then raise exception 'That song has already been restored or its 30 days in trash have ended. Refresh the list.'; end if;
end; $$;
revoke all on function public.move_song_to_trash(uuid) from public, anon;
revoke all on function public.restore_trashed_song(uuid) from public, anon;
grant execute on function public.move_song_to_trash(uuid) to authenticated;
grant execute on function public.restore_trashed_song(uuid) to authenticated;

-- Hourly cleanup keeps working with no visitors or open browser tabs.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('purge-song-trash', '0 * * * *',
 $$delete from public.songs where deleted_at <= now() - interval '30 days'$$);
