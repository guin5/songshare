import { musicUrl, safeImage } from './music.js';
const cfg=window.SONGBOARD_CONFIG || {}, $=id=>document.getElementById(id);
const ready=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl || '') && !!cfg.supabaseKey;
let songs=[],candidate=null,session=null,authPromise=null,captchaToken='',captchaWidget,trashView=false,loadVersion=0;
const status=(id,msg,kind='')=>{ $(id).textContent=msg;$(id).className=`status ${kind}`; };
async function request(path,options={}) {
 const {timeoutMs=20000,...fetchOptions}=options;
 const headers={apikey:cfg.supabaseKey,'Content-Type':'application/json',...options.headers};
 const res=await fetch(cfg.supabaseUrl+path,{...fetchOptions,headers,signal:AbortSignal.timeout(timeoutMs)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok) throw new Error(data.error_description || data.message || data.error || 'Request failed. Please try again.');
 return data;
}
async function auth(){
 if(authPromise)return authPromise;
 authPromise=(async()=>{
  if(session && session.expires_at>Date.now()/1000+60)return session;
  let saved;try{saved=JSON.parse(localStorage.getItem('songboard-session:'+cfg.supabaseUrl));}catch{}
  if(saved?.refresh_token){
   try{session=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:saved.refresh_token})});}catch{session=null;}
  }
  if(!session){
   if(cfg.turnstileSiteKey && !captchaToken)throw new Error('Complete the verification before adding a song.');
   session=await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({data:{},gotrue_meta_security:{captcha_token:captchaToken || undefined}})});
  }
  session.expires_at=Date.now()/1000+session.expires_in;
  try{localStorage.setItem('songboard-session:'+cfg.supabaseUrl,JSON.stringify(session));}catch{}
  return session;
 })();try{return await authPromise;}finally{authPromise=null;}
}
async function api(body){
 if(!ready)throw new Error('Song submissions will work once the site is connected. See the included setup guide.');
 const s=await auth();return request('/functions/v1/song-api',{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`},body:JSON.stringify(body),timeoutMs:body.action==='resolve'?60000:20000});
}
async function moveSong(song,button){
 const restoring=!!song.deleted_at;
 button.disabled=true;status('list-status',restoring?'Restoring song…':'Moving song to trash…');
 try{
  if(!ready)throw new Error('Trash will work once the site is connected.');
  const s=await auth();
  await request('/rest/v1/rpc/'+(restoring?'restore_trashed_song':'move_song_to_trash'),{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`},body:JSON.stringify({p_id:song.id})});
  await load();
 }catch(e){status('list-status',e.message,'error');button.disabled=false;}
}
function card(song){
 const article=document.createElement('article');article.className='song';
 const image=safeImage(song.artwork_url);let art;
 if(image){art=document.createElement('img');art.src=image;art.alt='';art.loading='lazy';art.referrerPolicy='no-referrer';art.addEventListener('error',()=>{const p=document.createElement('div');p.className='art';p.textContent='♫';art.replaceWith(p);},{once:true});}
 else{art=document.createElement('div');art.textContent='♫';}art.className='art';article.append(art);
 const info=document.createElement('div');info.className='song-info';
 const title=document.createElement('h3');title.textContent=song.title;const artist=document.createElement('p');artist.className='artist';artist.textContent=song.artist;info.append(title,artist);
 if(song.added_by){const by=document.createElement('p');by.className='byline';by.textContent=`from ${song.added_by}`;info.append(by);}
 const links=document.createElement('div');links.className='links';
 for(const [field,platform,label] of [['spotify_url','spotify','Spotify'],['apple_url','apple','Apple Music']]){
  const url=musicUrl(song[field],platform);if(!url)continue;
  const a=document.createElement('a');a.href=url;a.textContent=label;a.className=`music-link ${platform}`;a.target='_blank';a.rel='noopener noreferrer';links.append(a);
 }info.append(links);
 if(song.id){
  const button=document.createElement('button');button.type='button';button.className='quiet song-action';button.textContent=song.deleted_at?'Restore':'Delete';button.setAttribute('aria-label',`${button.textContent} ${song.title}`);button.addEventListener('click',()=>moveSong(song,button));info.append(button);
  if(song.deleted_at){const expiry=document.createElement('p');expiry.className='trash-expiry';expiry.textContent='Deletes '+new Date(new Date(song.deleted_at).getTime()+30*86400000).toLocaleDateString();info.append(expiry);}
 }
 article.append(info);return article;
}
function render(){
 const query=$('search').value.trim().toLowerCase();const visible=songs.filter(s=>(s.title+' '+s.artist+' '+s.added_by).toLowerCase().includes(query));
 $('songs').replaceChildren(...visible.map(card));$('count').textContent=songs.length;
 if(!visible.length){const el=document.createElement('div');el.className='empty';el.textContent=query?'No songs found.':trashView?'Trash is empty.':'No songs yet.';$('songs').append(el);}
}
async function load(){
 const version=++loadVersion;
 if(!ready){status('list-status','Preview mode — connect the site to enable the shared collection.');render();return;}
 $('refresh').disabled=true;status('list-status','Loading songs…');
 try{const rows=await request('/rest/v1/songs?select=id,title,artist,artwork_url,spotify_url,apple_url,added_by,created_at,deleted_at&deleted_at='+(trashView?'not.is.null&order=deleted_at.desc':'is.null&order=created_at.desc')+'&limit=1000');if(version!==loadVersion)return;songs=rows;render();status('list-status',songs.length===1000?'Showing the newest 1,000 songs.':'');}
 catch(e){if(version===loadVersion)status('list-status',e.message,'error');}finally{if(version===loadVersion)$('refresh').disabled=false;}
}
async function add(song,button){
 button.disabled=true;status('form-status','Adding your song…');
 try{await api({action:'add',song,added_by:$('name').value.trim() || 'Anonymous'});status('form-status','Song added.','success');candidate=null;$('preview').hidden=true;$('lookup-form').reset();$('manual-form').reset();$('manual').open=false;await load();}
 catch(e){status('form-status',e.message,'error');}finally{button.disabled=false;}
}
$('lookup-form').addEventListener('submit',async e=>{
 e.preventDefault();const url=musicUrl($('song-url').value.trim());if(!url){status('form-status','Paste a direct Spotify track or Apple Music song link.','error');return;}
 $('find').disabled=true;$('preview').hidden=true;status('form-status','Finding your song…');
 try{candidate=await api({action:'resolve',url});$('preview').replaceChildren(card(candidate));const btn=document.createElement('button');btn.type='button';btn.textContent='Add this song';btn.addEventListener('click',()=>add(candidate,btn));$('preview').append(btn);$('preview').hidden=false;status('form-status',candidate.spotify_url&&candidate.apple_url?'Check the match, then add it.':'One service link was found. You can add it now or enter both links manually.');}
 catch(e){status('form-status',e.message+' You can also add links manually.','error');}finally{$('find').disabled=false;}
});
$('manual-form').addEventListener('submit',e=>{
 e.preventDefault();const sp=$('spotify').value.trim(),ap=$('apple').value.trim();const spotify_url=sp?musicUrl(sp,'spotify'):null,apple_url=ap?musicUrl(ap,'apple'):null;
 if((sp&&!spotify_url)||(ap&&!apple_url)||(!spotify_url&&!apple_url)){status('form-status','Enter at least one valid song link. Check that each link is in the correct field.','error');return;}
 const title=$('title').value.trim(),artist=$('artist').value.trim();if(!title||!artist){status('form-status','Enter a song title and artist.','error');return;}
 add({title,artist,spotify_url,apple_url,artwork_url:null},e.submitter);
});
$('search').addEventListener('input',render);$('refresh').addEventListener('click',load);
$('trash-toggle').addEventListener('click',()=>{trashView=!trashView;$('list-title').textContent=trashView?'Trash':'Songs';$('trash-toggle').textContent=trashView?'Songs':'Trash';$('trash-note').hidden=!trashView;songs=[];render();load();});
if(ready && cfg.turnstileSiteKey){
 window.onCaptchaLoaded=()=>{captchaWidget=window.turnstile.render('#captcha',{sitekey:cfg.turnstileSiteKey,theme:'light',callback:t=>{captchaToken=t;},'expired-callback':()=>{captchaToken='';}});};
 const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onCaptchaLoaded&render=explicit';script.async=true;script.onerror=()=>status('form-status','Verification could not load. Refresh to try again.','error');document.head.append(script);
}
load();setInterval(()=>{if(ready&&!document.hidden)load();},30000);
