create table public.songs (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 160),
 artist text not null check(length(trim(artist)) between 1 and 160),
 spotify_url text unique check(spotify_url ~ '^https://open[.]spotify[.]com/track/[A-Za-z0-9]{22}$'),
 apple_url text unique check(apple_url ~ '^https://music[.]apple[.]com/[a-z]{2}/(song/[^/]+/[0-9]+|album/[^/]+/[0-9]+[?]i=[0-9]+)([?]i=[0-9]+)?$'),
 artwork_url text check(artwork_url is null or (length(artwork_url)<=2000 and artwork_url ~ '^https://')),
 added_by text not null check(length(trim(added_by)) between 1 and 40),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 check(spotify_url is not null or apple_url is not null)
);
create index songs_created on public.songs(created_at desc);
create index songs_owner_time on public.songs(user_id,created_at desc);
alter table public.songs enable row level security;
revoke all on public.songs from anon, authenticated;
grant select(id,title,artist,spotify_url,apple_url,artwork_url,added_by,created_at) on public.songs to anon,authenticated;
create policy "Public songs" on public.songs for select using(true);
create table public.song_lookup_events(user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create index lookup_time on public.song_lookup_events(created_at);
alter table public.song_lookup_events enable row level security;
revoke all on public.song_lookup_events from anon,authenticated;
create function public.allow_song_lookup() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 perform pg_advisory_xact_lock(90261005);
 delete from public.song_lookup_events where created_at<now()-interval '10 minutes';
 if (select count(*) from public.song_lookup_events where user_id=auth.uid())>=20 then raise exception 'Too many lookups. Try again in 10 minutes.'; end if;
 if (select count(*) from public.song_lookup_events where created_at>now()-interval '1 minute')>=8 then raise exception 'Song matching is busy. Try again in a minute, or enter links manually.'; end if;
 insert into public.song_lookup_events(user_id) values(auth.uid());
end; $$;
create function public.submit_song(p_title text,p_artist text,p_spotify text,p_apple text,p_artwork text,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare song_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if (select count(*) from public.songs where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'You can add 10 songs per hour. Try again later.'; end if;
 insert into public.songs(title,artist,spotify_url,apple_url,artwork_url,added_by,user_id)
 values(trim(p_title),trim(p_artist),p_spotify,p_apple,p_artwork,trim(p_name),auth.uid()) returning id into song_id;
 return song_id;
end; $$;
revoke all on function public.allow_song_lookup() from public,anon;
revoke all on function public.submit_song(text,text,text,text,text,text) from public,anon;
grant execute on function public.allow_song_lookup() to authenticated;
grant execute on function public.submit_song(text,text,text,text,text,text) to authenticated;
