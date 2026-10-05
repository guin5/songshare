export function musicUrl(value, platform) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if ((!platform || platform === 'spotify') && u.hostname === 'open.spotify.com') {
      const m = u.pathname.match(/^\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})\/?$/);
      if (m) return `https://open.spotify.com/track/${m[1]}`;
    }
    if ((!platform || platform === 'apple') && u.hostname === 'music.apple.com') {
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
  const entity=data.entitiesByUniqueId?.[data.entityUniqueId];
  if (!entity || entity.type !== 'song') throw new Error('Please use a song link, rather than an album or playlist.');
  const spotify_url=musicUrl(data.linksByPlatform?.spotify?.url,'spotify') || musicUrl(source,'spotify');
  const apple_url=musicUrl(data.linksByPlatform?.appleMusic?.url,'apple') || musicUrl(source,'apple');
  if (!spotify_url && !apple_url) throw new Error('No supported song links were found.');
  return { title: String(entity.title || 'Unknown title').slice(0,160), artist: String(entity.artistName || 'Unknown artist').slice(0,160), artwork_url:safeImage(entity.thumbnailUrl), spotify_url, apple_url };
}
