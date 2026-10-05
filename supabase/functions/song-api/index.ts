import { musicUrl, matchedSong, safeImage } from './music.js';
const base=Deno.env.get('SUPABASE_URL')!;
const key=Deno.env.get('SUPABASE_ANON_KEY')!;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return response({error:'Method not allowed.'},405);
 try{
  const token=req.headers.get('Authorization') || '';
  if(!token.startsWith('Bearer '))return response({error:'Please refresh and try again.'},401);
  const headers={apikey:key,Authorization:token,'Content-Type':'application/json'};
  const user=await fetch(base+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
  if(!user.ok)return response({error:'Your session expired. Refresh and try again.'},401);
  const text=await req.text();if(text.length>6000)return response({error:'Submission is too large.'},413);
  const body=JSON.parse(text);
  async function rpc(name:string,data:unknown){
   const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
   const result=await r.json().catch(()=>null);if(!r.ok)throw new Error(result?.code==='23505'?'That song is already in the rotation.':result?.message || 'Could not save the song.');return result;
  }
  if(body.action==='resolve'){
   const url=musicUrl(body.url);if(!url)return response({error:'Use a Spotify track or Apple Music song link.'},400);
   await rpc('allow_song_lookup',{});
   const matchingKey=Deno.env.get('MUSICLINK_API_KEY');
   if(!matchingKey)throw new Error('Automatic song matching is not configured yet.');
   const upstream=await fetch('https://api.musiclink.one/v2/resolve?'+new URLSearchParams({q:url}),{headers:{Authorization:`Bearer ${matchingKey}`},signal:AbortSignal.timeout(45000)});
   if(upstream.status===429)throw new Error(upstream.headers.has('Retry-After')?'Song matching is busy. Please try again shortly.':'The automatic matching allowance is used up for this month.');
   if(upstream.status===404)throw new Error('No matching song was found.');
   if(upstream.status===401)throw new Error('Automatic matching needs the site owner to check its API key.');
   if(!upstream.ok)throw new Error('Song matching is temporarily unavailable.');
   return response(matchedSong(await upstream.json(),url));
  }
  if(body.action==='add'){
   const s=body.song || {},sp=s.spotify_url?musicUrl(s.spotify_url,'spotify'):null,ap=s.apple_url?musicUrl(s.apple_url,'apple'):null;
   if((s.spotify_url&&!sp)||(s.apple_url&&!ap)||(!sp&&!ap))return response({error:'Invalid song link.'},400);
   const title=String(s.title || '').trim(),artist=String(s.artist || '').trim(),name=String(body.added_by || 'Anonymous').trim();
   if(!title||title.length>160||!artist||artist.length>160||!name||name.length>40)return response({error:'Check the title, artist, and name lengths.'},400);
   const result=await rpc('submit_song',{p_title:title,p_artist:artist,p_spotify:sp,p_apple:ap,p_artwork:safeImage(s.artwork_url),p_name:name});
   return response({id:result},201);
  }
  return response({error:'Unknown action.'},400);
 }catch(e){const msg=e instanceof Error?e.message:'Request failed.';return response({error:msg.includes('JSON')?'Invalid request.':msg},400);}
});
