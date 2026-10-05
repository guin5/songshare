export function musicUrl(value, platform) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if ((!platform || platform === 'spotify') && u.hostname === 'open.spotify.com') {
      const m = u.pathname.match(/^\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})\/?$/);
      if (m) return `https://open.spotify.com/track/${m[1]}`;
    }
    if ((!platform || platform === 'apple') && u.hostname === 'music.apple.com') {
      // MusicLink returns countryless /song/ID links. Use the US storefront
      // and a placeholder slug; Apple redirects it to the recording's slug.
      const shortSong = u.pathname.match(/^\/(?:([a-z]{2})\/)?song\/(\d+)\/?$/);
      if (shortSong) u.pathname = `/${shortSong[1] || 'us'}/song/track/${shortSong[2]}`;
      else if (/^\/(album|song)\/[^/]+\/\d+\/?$/.test(u.pathname)) u.pathname = '/us' + u.pathname;
      // An album URL must identify an individual song with ?i=.
      if (/^\/[a-z]{2}\/(album|song)\/[^/]+\/\d+\/?$/.test(u.pathname)) {
        const id = u.searchParams.get('i');
        if (u.pathname.includes('/album/') && !/^\d+$/.test(id || '')) return null;
        u.hash = ''; u.search = ''; if (id) u.searchParams.set('i', id);
        return u.href;
      }
    }
  } catch {} return null;
}
export function safeImage(value) {
  try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function matchedSong(data, source) {
  if (!data?.success || !Array.isArray(data.data)) throw new Error('No matching song was found.');
  const tracks=data.data.filter(item=>item?.type==='track');
  const canonical=musicUrl(source);
  const entity=tracks.find(item=>Object.values(item.platforms || {}).some(url=>musicUrl(url)===canonical)) || tracks[0];
  if (!entity) throw new Error('Please use a song link, rather than an album or playlist.');
  const spotify_url=musicUrl(source,'spotify') || musicUrl(entity.platforms?.spotify,'spotify');
  const apple_url=musicUrl(source,'apple') || musicUrl(entity.platforms?.apple_music,'apple');
  if (!spotify_url && !apple_url) throw new Error('No supported song links were found.');
  return { title: String(entity.title || 'Unknown title').slice(0,160), artist: String(entity.artist || 'Unknown artist').slice(0,160), artwork_url:safeImage(entity.image_url), spotify_url, apple_url };
}
