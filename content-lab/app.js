(function(){
"use strict";
/* ================= constants ================= */
/* versões de uma marca só (ex.: Mycapital Lab) definem window.__LAB__ = {nome, marca, slug} */
const LAB=window.__LAB__||{};
const APP=LAB.nome||'Content Lab';
const ENX=!!LAB.enxuto; /* versão enxuta: Notícias pelos pilares, Referências da internet e do Claude, sem vidIQ */
const CH=[
 {id:'site',label:'Site',code:'SITE'},
 {id:'blog',label:'Blog',code:'BLOG'},
 {id:'instagram',label:'Instagram',code:'IG'},
 {id:'linkedin',label:'LinkedIn',code:'IN'},
 {id:'youtube',label:'YouTube',code:'YT'}];
const CHM=Object.fromEntries(CH.map(c=>[c.id,c]));
const STATUS=[{id:'ideia',label:'Ideia'},{id:'producao',label:'Em produção'},{id:'revisao',label:'Revisão'},{id:'agendado',label:'Agendado'},{id:'publicado',label:'Publicado'}];
const STM=Object.fromEntries(STATUS.map(s=>[s.id,s]));
const ISTATUS=[['nova','Nova'],['em-uso','Em uso'],['usada','Usada'],['arquivada','Arquivada']];
const ISTM=Object.fromEntries(ISTATUS);
const FORMATS=['Reels','Carrossel','Post estático','Stories','Live','Artigo','Guia','Landing page','Post texto','Carrossel PDF','Vídeo longo','Shorts','Newsletter'];
const COLS=['news','refs','posts','dates','ideas','metrics','competitors','compnews','insights'];
const DTYPES=['Data comemorativa','Lançamento','Campanha','Evento','Prazo','Aniversário da marca','Sazonalidade'];
const TABS=[
 {id:'noticias',label:'Notícias'},{id:'referencias',label:'Referências'},{id:'calendario',label:'Calendário'},{id:'datas',label:'Datas importantes'},
 {id:'marca',label:'Marca'},{id:'ideias',label:'Mapa de ideias'},{id:'metricas',label:'Métricas'},{id:'concorrentes',label:'Concorrentes'}];
/* a versão de uma marca só pode renomear e reordenar as abas */
TABS.forEach(t=>{if(LAB.abas&&LAB.abas[t.id])t.label=LAB.abas[t.id]});
if(Array.isArray(LAB.ordem))TABS.sort((a,b)=>{const i=x=>{const k=LAB.ordem.indexOf(x.id);return k<0?99:k};return i(a)-i(b)});
const tabLabel=id=>(TABS.find(t=>t.id===id)||{}).label||id;
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESF=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DOWF=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const METRICS=[
 {k:'followers',l:'Seguidores'},{k:'reach',l:'Alcance'},{k:'engagement',l:'Engajamento',pct:1},{k:'clicks',l:'Cliques e visitas'}];
const STAR='<svg class="star" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.4l-4.2 2.4 1-4.6L1.3 6l4.7-.5z"/></svg>';
const SPARK='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .8l1.7 4.6 4.6 1.7-4.6 1.7L8 13.4 6.3 8.8 1.7 7.1l4.6-1.7z"/><path d="M13.3 10.6l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/></svg>';

/* ================= helpers ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const safeUrl=u=>{try{const x=new URL(String(u||'').trim());return /^https?:$/.test(x.protocol)?x.href:''}catch(e){return ''}};
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseISO=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3]):null};
const TODAY=()=>iso(new Date());
const fmtDay=s=>{const d=parseISO(s);return d?d.getDate()+' '+MES[d.getMonth()]:''};
const fmtMonth=s=>{const m=/^(\d{4})-(\d{2})/.exec(s||'');return m?MES[+m[2]-1]+'/'+m[1].slice(2):s||''};
const NF=new Intl.NumberFormat('pt-BR');
const NFC=new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1});
const fmtN=(v,pct)=>v==null||v===''||isNaN(v)?'–':pct?(Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%'):NF.format(v);
const fmtNC=(v,pct)=>v==null||isNaN(v)?'–':pct?(Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%'):NFC.format(v);
const clean=t=>String(t||'').replace(/\s*—\s*/g,', ').replace(/\s–\s/g,', ');
const code=id=>{const c=CHM[id];return c?`<span class="code ${c.id}" title="${c.label}">${c.code}</span>`:''};
const exTag=it=>it&&it.exemplo?'<span class="ex" title="Dado de exemplo. Remova em Marca.">exemplo</span>':it&&it.origem==='importador'?'<span class="imp" title="Trazido pelo importador de posts, com números reais da plataforma.">importado</span>':it&&it.origem==='radar'?'<span class="imp" title="Achado no radar de oportunidades do Instagram, com números reais do vidIQ e fit avaliado pelo Claude.">radar</span>':it&&it.origem==='web'?'<span class="imp" title="Encontrado pelo Claude em pesquisa na internet.">internet</span>':it&&it.origem==='claude'?'<span class="imp" title="Ideia criada pelo Claude a partir das referências. Não tem números próprios.">Claude</span>':'';
const stTag=s=>{const x=STM[s]||STM.ideia;return `<span class="status st-${x.id}"><i></i>${x.label}</span>`};
const aiBtn=(label,act,attrs='',cls='')=>`<button class="btn ai ${cls}" data-act="${act}" ${attrs}>${SPARK}${esc(label)}</button>`;
const btn=(label,act,attrs='',cls='')=>`<button class="btn ${cls}" data-act="${act}" ${attrs}>${label}</button>`;
function toast(msg,ms){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,ms||2600)}

/* ================= store (db or in-memory preview) ================= */
let db=null, sample=null, mcp=null, assets=null, downloads=null;
const DEMO=window.__DEMO__||{};
const mem={}, memL={};
function memCol(p){return mem[p]||(mem[p]=new Map())}
function memList(p){return [...memCol(p)].map(([id,d])=>Object.assign({id},d))}
function memEmit(p){(memL[p]||[]).forEach(cb=>cb(memList(p)))}
Object.keys(DEMO).forEach(p=>Object.entries(DEMO[p]).forEach(([id,d])=>memCol(p).set(id,d)));
function dbErr(e){
  const c=e&&e.code;
  if(c==='invalid_argument') toast('Não foi possível salvar. Você pode estar com acesso só de leitura.');
  else if(c==='quota_exceeded') toast('O limite de itens desta central foi atingido. Exclua itens antigos para continuar.');
  else toast('Não foi possível salvar agora. Tente de novo em instantes.');
  throw e;
}
const Store={
  sub(p,cb){
    if(db){return db.collection(p).onSnapshot(s=>cb(s.docs.map(d=>Object.assign({id:d.id},d.data()))),e=>{console.warn(e);if(e.code!=='revoked')toast('Não consegui carregar parte dos dados.')})}
    (memL[p]||(memL[p]=[])).push(cb);cb(memList(p));
    return()=>{memL[p]=(memL[p]||[]).filter(x=>x!==cb)};
  },
  async add(p,data){
    data=Object.assign({},data,{createdAt:new Date().toISOString()});
    if(db){try{const r=await db.collection(p).add(data);return r.id}catch(e){dbErr(e)}}
    const id=uid();memCol(p).set(id,data);memEmit(p);return id;
  },
  async set(p,id,data){
    if(db){try{return await db.collection(p).doc(id).set(data)}catch(e){dbErr(e)}}
    memCol(p).set(id,data);memEmit(p);
  },
  async update(p,id,patch){
    if(db){try{return await db.collection(p).doc(id).update(patch)}catch(e){dbErr(e)}}
    memCol(p).set(id,Object.assign({},memCol(p).get(id),patch));memEmit(p);
  },
  async remove(p,id){
    if(db){try{return await db.collection(p).doc(id).delete()}catch(e){dbErr(e)}}
    memCol(p).delete(id);memEmit(p);
  },
  async list(p){
    if(db){const s=await db.collection(p).get();return s.docs.map(d=>Object.assign({id:d.id},d.data()))}
    return memList(p);
  }
};
const strip=o=>{const x=Object.assign({},o);delete x.id;return x};

/* ================= state ================= */
const now=new Date();
const state={
  mode:'preview', loading:false, brands:[], brandId:null,
  tab:(TABS.find(t=>t.id===location.hash.slice(1))||TABS.find(t=>t.id===LS.get('cl.tab'))||TABS[0]).id,
  data:{news:[],refs:[],posts:[],dates:[],ideas:[],metrics:[],competitors:[],compnews:[],insights:[]},
  cal:{y:now.getFullYear(),m:now.getMonth()},
  f:{newsTag:'',newsPeriod:String(LS.get('cl.newsPeriod','')),refTipo:'',refTema:'',calCh:'',ideaCh:'',ideaPilar:String(LS.get('cl.ideaPilar','')),ideaAll:false,metric:'followers',mPeriod:String(LS.get('cl.mPeriod','30')),mFrom:LS.get('cl.mFrom',''),mTo:LS.get('cl.mTo',''),compPeriod:String(LS.get('cl.compPeriod','30')),compFilter:'',compKind:String(LS.get('cl.compKind','')),kGrupo:String(LS.get('cl.kGrupo','')),kPer:String(LS.get('cl.kPer','4s')),kFrom:LS.get('cl.kFrom',''),kTo:LS.get('cl.kTo','')},
  brandDirty:false, vidiq:null, novidade:null
};
const bpath=c=>`brands/${state.brandId}/${c}`;
const curBrand=()=>state.brands.find(b=>b.id===state.brandId)||null;
const activeCh=()=>{const b=curBrand();const on=CH.filter(c=>!b||!b.channels||!b.channels[c.id]||b.channels[c.id].on!==false);return on.length?on:CH};
const pillars=()=>{const b=curBrand();return (b&&Array.isArray(b.pillars)?b.pillars:[]).filter(Boolean)};

let unsubBrands=null, unsubCols=[], unsubVidiq=null;
function subBrands(){
  if(unsubBrands)unsubBrands();
  if(unsubVidiq)unsubVidiq();
  unsubVidiq=Store.sub('importador',list=>{state.vidiq=list.find(d=>d.id==='vidiq')||null;if(state.tab==='concorrentes'||state.tab==='referencias')scheduleRender()});
  if(!subBrands._nov){subBrands._nov=true;Store.sub('app',list=>{state.novidade=list.find(d=>d.id==='novidade')||null;scheduleRender()})}
  unsubBrands=Store.sub('brands',list=>{
    state.brands=(LAB.marca?list.filter(b=>b.id===LAB.marca):list).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));
    state.loading=false;
    if(!state.brands.find(b=>b.id===state.brandId)){
      const saved=LS.get('cl.brand',null);
      state.brandId=(state.brands.find(b=>b.id===saved)||state.brands[0]||{}).id||null;
      state.brandDirty=false;
      subCols();
    }
    render();
  });
}
function subCols(){
  unsubCols.forEach(u=>u());unsubCols=[];
  COLS.forEach(c=>state.data[c]=[]);
  if(!state.brandId)return;
  COLS.forEach(c=>unsubCols.push(Store.sub(bpath(c),list=>{state.data[c]=list;scheduleRender(c==='dates')})));
}
function setBrand(id){
  if(id===state.brandId)return;
  state.brandId=id;state.brandDirty=false;LS.set('cl.brand',id);subCols();render();
}

/* ================= render ================= */
function render(){renderTop();renderTabs();renderMain(true)}
/* junta várias atualizações do banco (8 coleções) num único desenho por quadro */
let rafId=0, rafTabs=false;
function scheduleRender(tabs){
  rafTabs=rafTabs||!!tabs;if(rafId)return;
  rafId=requestAnimationFrame(()=>{rafId=0;if(rafTabs)renderTabs();rafTabs=false;renderMain()});
}
function renderTop(){
  const sel=$('#brandSel'), b=curBrand();
  sel.innerHTML=state.brands.map(x=>`<option value="${esc(x.id)}"${x.id===state.brandId?' selected':''}>${esc(x.name||'Sem nome')}</option>`).join('')+
    `<option value="__new">+ Nova marca</option>`;
  if(!state.brands.length)sel.value='__new';
  $('#brandDot').style.background=(b&&/^#[0-9a-f]{6}$/i.test(b.color||''))?b.color:'var(--accent)';
  $('#modeBadge').hidden=state.mode!=='preview';
  if(LAB.marca)$('.brand-switch').hidden=true;
}
function renderTabs(){
  const due=dueSoon().length;
  $('#tabs').innerHTML=TABS.map(t=>`<button class="tab" role="tab" data-act="tab" data-tab="${t.id}" aria-selected="${t.id===state.tab}">${t.label}${t.id==='datas'&&due?`<span class="tabcount" title="${due} ${due>1?'datas pedem':'data pede'} preparação">${due}</span>`:''}</button>`).join('');
}
function renderMain(force){
  const main=$('#main');
  if(state.tab==='marca'&&state.brandDirty&&!force)return;
  if(state.loading||!curBrand())main._html='';
  if(state.loading){main.innerHTML='<div class="loading"><div class="thinking"><span class="pulse"></span>Carregando sua central...</div></div>';return}
  if(!curBrand()){main.innerHTML=viewOnboard();return}
  const v={noticias:viewNews,referencias:viewRefs,calendario:viewCal,datas:viewDates,marca:viewBrand,ideias:viewIdeas,metricas:viewMetrics,concorrentes:viewComps}[state.tab];
  const html=novidadeCard()+v();
  /* só troca o DOM quando algo mudou: preserva vídeos tocando, foco e rolagem */
  if(main._html!==html){main.innerHTML=html;main._html=html}
  if(state.tab==='marca')state.brandDirty=false;
}
function head(title,desc,actions){
  return `<div class="sec-head"><div><h2>${title}</h2><p>${desc}</p></div><div class="actions">${actions||''}</div></div>`;
}
function chips(filterKey,opts,cur){
  return `<div class="chips" role="group">`+opts.map(([v,l])=>`<button class="chip" data-act="filter" data-f="${filterKey}" data-v="${esc(v)}" aria-pressed="${cur===v}">${l}</button>`).join('')+`</div>`;
}
function empty(title,text,action){return `<div class="empty"><h3>${title}</h3><p>${text}</p>${action||''}</div>`}

/* ---------- onboarding ---------- */
function viewOnboard(){
  return `<div class="empty" style="max-width:520px;margin:40px auto">
    <h3>Crie a primeira marca</h3>
    <p>Cada marca tem notícias, referências, calendário, ideias, métricas e concorrentes separados.</p>
    ${btn('Criar marca','new-brand','','primary')}
  </div>`;
}

/* ---------- notícias ---------- */
function parseSources(txt){
  return String(txt||'').split('\n').map(l=>{const [n,u]=l.split('|').map(s=>(s||'').trim());const url=safeUrl(u||n);return url?{name:u?n:new URL(url).hostname,url}:null}).filter(Boolean);
}
const PERIODS=[['','Todas'],['1','Últimas 24h'],['7','7 dias'],['15','15 dias']];
function newsAge(n){
  const d=parseISO(n.date);
  if(d)return Math.round((parseISO(TODAY())-d)/864e5);
  const c=n.createdAt?new Date(n.createdAt):null;
  return c&&!isNaN(c)?(Date.now()-c.getTime())/864e5:Infinity;
}
const inPeriod=(n,p)=>!p||newsAge(n)<=Number(p);
function newsFiltered(){
  if(ENX)return newsDosPilares().filter(n=>inPeriod(n,state.f.newsPeriod));
  return state.data.news.filter(n=>inPeriod(n,state.f.newsPeriod)&&(!state.f.newsTag||n.tag===state.f.newsTag));
}
/* versão enxuta: só entram notícias ligadas aos pilares da marca. O Claude classifica cada notícia
   (campos pilar e pilarBase = pilares da época); enquanto isso, vale uma leitura por palavras-chave. */
const semAcento=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const pilaresAssin=()=>pillars().join('|');
const PILAR_PISTAS=[[/tribut|\bir\b|impost/,/impost|\bir\b|irpf|darf|declara|isen|receita federal|tribut|restitui/],
  [/carteira/,/carteira|investiment|acoes|\bfii|tesouro|renda fixa|dividend|\betf|\bcdb|ibovespa|bolsa/],
  [/educa/,/entenda|saiba|como |o que |guia|erro/],
  [/rotina|performance/,/aposentadoria|rotina|habito|corrida|endurance/]];
function pilarHeur(n){
  const txt=semAcento(n.title+' '+(n.tag||'')+' '+(n.summary||''));
  for(const p of pillars()){
    const pn=semAcento(p);
    if(pn.split(/\s+/).filter(w=>w.length>3&&!['para','como'].includes(w)).some(w=>txt.includes(w)))return p;
    for(const [re,pistas] of PILAR_PISTAS)if(re.test(pn)&&pistas.test(txt))return p;
  }
  return '';
}
function pilarDa(n){
  if(n.pilarBase===pilaresAssin())return pillars().includes(n.pilar)?n.pilar:'';
  return pilarHeur(n);
}
const newsDosPilares=()=>state.data.news.filter(n=>pilarDa(n));
let pilaresRodando='';
async function classificarNoticias(){
  const sig=pilaresAssin();
  if(!sample||!sig||pilaresRodando)return;
  const fila=state.data.news.filter(n=>n.pilarBase!==sig).slice(0,40);
  if(!fila.length)return;
  pilaresRodando=sig;let ok=false;
  try{
    const r=await sample.json(`${RULES}\n\n${brandCtx()}\n\nPILARES DE CONTEÚDO\n${pillars().map(p=>'- '+p).join('\n')}\n\nNOTÍCIAS\n${fila.map((n,i)=>`${i}. ${n.title}${n.summary?' | '+n.summary:''}`).join('\n')}\n\nTAREFA: para cada notícia, diga a qual pilar ela se liga de verdade, pensando no público da marca. Se não tiver ligação clara com nenhum pilar, use "". Responda só com JSON: [{"i":0,"pilar":"nome exato do pilar ou vazio"}].`,{cache:false});
    const lista=Array.isArray(r)?r:(r&&r.items)||[];
    for(const x of lista){const n=fila[Number(x&&x.i)];if(!n)continue;
      await Store.update(bpath('news'),n.id,{pilar:pillars().includes(x.pilar)?x.pilar:'',pilarBase:sig});ok=true}
  }catch(e){console.warn(e)}
  finally{pilaresRodando='';if(ok&&state.data.news.some(n=>n.pilarBase!==sig))setTimeout(classificarNoticias,1500)}
}
function viewNews(){
  if(ENX)classificarNoticias();
  const all=(ENX?newsDosPilares():state.data.news).slice().sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt)));
  const inP=all.filter(n=>inPeriod(n,state.f.newsPeriod));
  const tags=ENX?[]:[...new Set(inP.map(n=>n.tag).filter(Boolean))].sort();
  if(state.f.newsTag&&!tags.includes(state.f.newsTag))state.f.newsTag='';
  const list=state.f.newsTag?inP.filter(n=>n.tag===state.f.newsTag):inP;
  const src=ENX?[]:parseSources((curBrand()||{}).sources);
  let h=head('Notícias do nicho',ENX?'Só as matérias ligadas aos pilares de conteúdo da marca, para acompanhar o mercado e virar pauta. Os pilares ficam na aba Marca.':'Matérias salvas para acompanhar o mercado e virar pauta. Cadastre as fontes que você mais consulta na aba Marca.',
    aiBtn('Sugerir pautas','ai-news-all')+btn('Salvar notícia','new','data-col="news"','primary'));
  if(src.length)h+=`<div class="sources"><span class="eyebrow">Fontes</span>${src.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>`).join('')}</div>`;
  if(!all.length)return h+empty(ENX?'Nenhuma notícia ligada aos pilares':'Nenhuma notícia salva',ENX&&!pillars().length?'Cadastre os pilares de conteúdo na aba Marca.':'Cole o link de uma matéria do seu nicho para começar.',btn('Salvar notícia','new','data-col="news"','primary'));
  h+=`<div class="toolbar"><span class="eyebrow">Período</span>${chips('newsPeriod',PERIODS.map(([v,l])=>[v,`${l} <span class="cnt">${all.filter(n=>inPeriod(n,v)).length}</span>`]),state.f.newsPeriod)}<span class="hint muted" style="font-size:12px">Conta a data de publicação; sem ela, o dia em que a notícia foi salva.</span></div>`;
  if(tags.length>1)h+=`<div class="toolbar">${chips('newsTag',[['','Todos os temas'],...tags.map(t=>[t,esc(t)])],state.f.newsTag)}</div>`;
  if(!list.length)return h+empty('Nenhuma notícia nesse período','Escolha um período maior ou aguarde a próxima atualização da rotina diária.',btn('Ver todas','filter','data-f="newsPeriod" data-v=""'));
  h+='<div class="stack">'+list.map(n=>{
    const u=safeUrl(n.url);
    return `<article class="row"><div class="row-main">
      <div class="meta">${n.source?`<span class="src">${esc(n.source)}</span>`:''}${n.date?`<span>${fmtDay(n.date)}</span>`:''}${ENX?`<span class="tagpill">${esc(pilarDa(n))}</span>`:n.tag?`<span class="tagpill">${esc(n.tag)}</span>`:''}${exTag(n)}</div>
      <h3>${u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n.title)}</a>`:esc(n.title)}</h3>
      ${n.summary?`<p>${esc(n.summary)}</p>`:''}
    </div><div class="row-actions">${aiBtn('Virar pauta','ai-news-one',`data-id="${esc(n.id)}"`,'sm')}${btn('Editar','edit',`data-col="news" data-id="${esc(n.id)}"`,'sm')}</div></article>`;
  }).join('')+'</div>';
  return h;
}

/* ---------- mídia (prévias) ---------- */
const MEDIA_ACCEPT='image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm';
const validAsset=id=>/^[0-9a-f]{32}$/i.test(String(id||''));
function mediaTag(id,type){
  if(!validAsset(id))return '';
  const src='/_blob/'+id;
  return type==='video'?`<video data-media src="${src}" controls muted playsinline preload="metadata"></video>`:`<img data-media src="${src}" alt="Prévia do post" loading="lazy">`;
}
const MEDIA_EMPTY='<div class="media-empty">Sem prévia. Envie um print ou o vídeo do post.</div>';
function videoFrame(src){return new Promise((res,rej)=>{const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=src;
  const t=setTimeout(()=>rej(new Error('timeout')),10000);
  v.onloadeddata=()=>{try{v.currentTime=Math.min(1,(v.duration||2)/2)}catch(_){rej(_)}};
  v.onseeked=()=>{clearTimeout(t);const c=document.createElement('canvas');const sc=Math.min(1,1280/Math.max(v.videoWidth,v.videoHeight,1));c.width=Math.round(v.videoWidth*sc);c.height=Math.round(v.videoHeight*sc);c.getContext('2d').drawImage(v,0,0,c.width,c.height);c.toBlob(b=>b?res(b):rej(new Error('frame')),'image/jpeg',.85)};
  v.onerror=()=>{clearTimeout(t);rej(new Error('video'))};});}
async function attachMedia(file){
  if(!file||!modalCtx||modalCtx.col!=='refs')return;
  if(!/^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/.test(file.type)){toast('Use imagem (PNG, JPG, WebP, GIF) ou vídeo (MP4, WebM).',4000);return}
  if(file.size>20*1024*1024){toast('Arquivo acima de 20 MB. Envie um print ou um trecho menor do vídeo.',4000);return}
  if(!assets){toast(`O envio de prévias funciona quando o ${APP} é aberto no Claude, por quem pode editar.`,4500);return}
  const box=$('#mediaBox'), ctx=modalCtx;
  box.innerHTML='<div class="thinking"><span class="pulse"></span>Enviando...</div>';
  try{
    const r=await assets.upload(file);
    (ctx.uploaded||(ctx.uploaded=[])).push(r.id);
    if(modalCtx!==ctx)return;
    const type=file.type.startsWith('video')?'video':'image';
    $('#f-media').value=r.id;$('#f-mediaType').value=type;ctx.file=file;
    box.innerHTML=mediaTag(r.id,type);
  }catch(e){
    box.innerHTML=validAsset($('#f-media').value)?mediaTag($('#f-media').value,$('#f-mediaType').value):MEDIA_EMPTY;
    toast({too_large:'Arquivo grande demais.',unsupported_type:'Formato não aceito.',quota_or_state:`O espaço de arquivos do ${APP} acabou. Exclua referências antigas com prévia.`,rate_limited:'Muitos envios seguidos. Tente de novo em instantes.',not_granted:'Você não tem permissão para enviar arquivos aqui.'}[e&&e.code]||'Não consegui enviar o arquivo. Tente de novo.',4500);
  }
}
async function currentMediaImage(){
  const ctx=modalCtx;if(!ctx)return null;
  const id=$('#f-media').value, type=$('#f-mediaType').value;
  let blob=ctx.file||null;
  if(!blob&&validAsset(id)){const r=await fetch('/_blob/'+id);if(!r.ok)return null;blob=await r.blob()}
  if(!blob)return null;
  if(type==='video'||String(blob.type).startsWith('video')){const u=URL.createObjectURL(blob);try{return await videoFrame(u)}finally{URL.revokeObjectURL(u)}}
  return blob;
}
async function fillRefWithClaude(btnEl){
  if(!sample){toast(`As sugestões do Claude funcionam quando o ${APP} é aberto no Claude.`);return}
  const v=collect(SCHEMA.refs);
  let img=null;try{img=await currentMediaImage()}catch(_){img=null}
  if(!img&&!v.url&&!v.hook){toast('Adicione um print, um vídeo ou o link do post primeiro.',4000);return}
  const lim=await sample.limits().catch(()=>null), canImg=!!(lim&&lim.images&&img);
  const old=btnEl.innerHTML;btnEl.disabled=true;btnEl.innerHTML=SPARK+'Analisando...';
  try{
    const opts={cache:false};if(canImg)opts.images=[img];
    const r=await sample.json(`${RULES}\n\n${brandCtx()}\n\nREFERÊNCIA VIRAL\nPlataforma: ${v.platform}\nLink: ${v.url||'-'}\nCampos já preenchidos: ${JSON.stringify({format:v.format,creator:v.creator,views:v.views,hook:v.hook,why:v.why,tags:v.tags})}\n\nTAREFA: ${canImg?'A imagem é um print ou um quadro do vídeo desse post. Leia o que aparece nela.':'Não há imagem; use só os dados acima e deixe vazio o que não dá para saber.'} Preencha: format (Reels, Carrossel, Post estático, Stories, Vídeo ou Live), creator (@perfil visível ou ""), views (números visíveis de curtidas, views ou comentários, ou ""), hook (texto da capa ou primeira frase, transcrito), why (por que esse post funcionou, 1 a 2 frases, pensando no público da marca), tags (3 a 5 temas separados por vírgula). Nunca invente números. Responda só com JSON: {"format":"","creator":"","views":"","hook":"","why":"","tags":""}`,opts);
    let n=0;['format','creator','views','hook','why','tags'].forEach(k=>{const el=document.getElementById('f-'+k),val=r&&r[k]?clean(String(r[k])):'';if(el&&val&&!el.value.trim()){if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===val))el.add(new Option(val,val));el.value=val;n++}});
    toast(n?`${n} campos preenchidos. Revise antes de salvar.`:'Nada novo para preencher. Os campos já estavam completos ou a imagem não trouxe informação.',4000);
  }catch(e){toast(aiErrMsg(e),4500)}
  finally{if(btnEl.isConnected){btnEl.disabled=false;btnEl.innerHTML=old}}
}

/* ---------- referências ---------- */
const refTipo=r=>ENX?(r.origem==='claude'?'claude':r.origem==='radar'||r.origem==='web'?'web':'manual'):r.origem==='radar'?'radar':'manual';
/* referências com números reais (a Bússola não usa as variações criadas pelo Claude) */
const refsReais=()=>refsMercado().filter(r=>r.origem!=='claude');
const PLAT={instagram:['IG','Instagram'],tiktok:['TT','TikTok'],youtube:['YT','YouTube'],linkedin:['IN','LinkedIn'],x:['X','X'],web:['WEB','Site']};
const platTag=r=>{const k=PLAT[r.platform]?r.platform:'instagram';return `<span class="code ${k}" title="${PLAT[k][1]}">${PLAT[k][0]}</span>`};
/* Referências são do mercado: a própria marca e os concorrentes (que têm aba própria) ficam fora */
const perfilKey=h=>String(h||'').trim().toLowerCase().replace(/^https?:\/\/(www\.)?instagram\.com\//,'').replace(/^@/,'').replace(/[\/?#].*$/,'');
function perfisFora(){
  const b=curBrand()||{}, s=new Set([perfilKey(b.channels&&b.channels.instagram&&b.channels.instagram.handle),perfilKey(b.name)]);
  for(const c of state.data.competitors){s.add(perfilKey(c.instagram));s.add(perfilKey(c.name))}
  s.delete('');return s;
}
function refsTodas(){const fora=perfisFora();return state.data.refs.filter(r=>r.origem!=='importador'&&!/concorrente|minha marca/.test(String(r.tags||''))&&!fora.has(perfilKey(r.creator)))}
/* versão enxuta: viral tem que ser atual. Só entram posts de no máximo 30 dias (postedAt);
   variações do Claude seguem a data do post em que se inspiram (baseDate). Exemplos ficam sempre. */
const REF_DIAS=30;
const refData=r=>r.origem==='claude'?r.baseDate:r.postedAt;
const refRecente=r=>{if(r.exemplo)return true;const d=parseISO(refData(r));return !!d&&(parseISO(TODAY())-d)/864e5<=REF_DIAS};
function refsMercado(){const l=refsTodas();return ENX?l.filter(refRecente):l}
/* temas das referências: tags livres, sem o marcador estrutural "oportunidade" (já coberto pelo filtro Radar/Salvas) */
function refTags(r){return String(r.tags||'').split(',').map(t=>t.trim()).filter(Boolean)}
function refTemas(list){
  const mapa=new Map();
  for(const r of list)for(const t of refTags(r)){const k=t.toLowerCase();if(k==='oportunidade'||mapa.has(k))continue;mapa.set(k,t)}
  return [...mapa.values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function viewRefs(){
  /* ordem da bússola: mais parecidas com a marca primeiro; alcance pago por último */
  const peso=r=>{const t=String(r.tags||'');return (t.includes('fit alto')||t.includes('alta semelhança')?0:t.includes('viral no nicho')?1:2)+(t.includes('possivelmente pago')?3:0)};
  const all=refsMercado().sort((a,b)=>peso(a)-peso(b)||String(b.createdAt).localeCompare(String(a.createdAt)));
  const porTipo=state.f.refTipo?all.filter(r=>refTipo(r)===state.f.refTipo):all;
  const temas=ENX?[]:refTemas(porTipo);
  if(state.f.refTema&&!temas.some(t=>t.toLowerCase()===state.f.refTema.toLowerCase()))state.f.refTema='';
  const list=state.f.refTema?porTipo.filter(r=>refTags(r).some(t=>t.toLowerCase()===state.f.refTema.toLowerCase())):porTipo;
  let h=ENX?head('Referências virais','Conteúdos que viralizaram na internet e cabem nos pilares da marca, variações criadas pelo Claude a partir deles e as referências que você salvou. Concorrentes ficam na aba Concorrentes.',
    aiBtn('Padrões em comum','ai-refs-all')+btn('Nova referência','new','data-col="refs"','primary')):head('Referências virais','O que está em alta no mercado e cabe nos canais da marca: oportunidades do radar (perfis de todo o Instagram, com fit avaliado pelo Claude) e as que você salvou. Concorrentes ficam na aba Concorrentes.',
    aiBtn('Padrões em comum','ai-refs-all')+igBtn()+btn('Nova referência','new','data-col="refs"','primary'));
  if(!ENX)h+=igStatus();
  h+=bussola();
  autoBussola(ENX?all.filter(r=>r.origem!=='claude'):all);
  const velhas=ENX?refsTodas().length-refsMercado().length:0;
  if(velhas)h+=`<p class="muted small">${velhas===1?'1 referência fica oculta por ter':velhas+' referências ficam ocultas por terem'} mais de ${REF_DIAS} dias de postagem.</p>`;
  h+=`<div class="toolbar">${chips('refTipo',ENX?[['','Todas'],['web','Da internet'],['claude','Variações do Claude'],['manual','Salvas por você']]:[['','Todas'],['radar','Oportunidades do radar'],['manual','Salvas por você']],state.f.refTipo)}</div>`;
  if(temas.length>1)h+=`<div class="toolbar">${chips('refTema',[['','Todos os temas'],...temas.map(t=>[t,esc(t)])],state.f.refTema)}</div>`;
  if(!all.length)return h+empty('Nenhuma referência ainda','Salve o link de um post que viralizou e anote o gancho e por que funcionou.',btn('Nova referência','new','data-col="refs"','primary'));
  if(!list.length)return h+empty('Nada neste filtro',ENX?'Troque o filtro ou adicione uma nova referência.':state.f.refTipo==='radar'&&!state.f.refTema?'O radar roda junto com o botão "Atualizar Instagram", no máximo 1 vez por semana.':'Troque o filtro ou adicione uma nova referência.');
  h+='<div class="grid">'+list.map(r=>{
    const u=safeUrl(r.url);
    return `<article class="card ref">
      ${validAsset(r.media)?`<div class="rmedia">${mediaTag(r.media,r.mediaType)}</div>`:''}
      <div class="meta">${ENX?platTag(r):'<span class="code instagram">IG</span>'}<span class="src">${esc(r.origem==='claude'?'Variação do Claude':r.creator||'Perfil')}</span>${ENX&&refData(r)?`<span>· ${r.origem==='claude'?'base de ':'postado em '}${fmtDay(refData(r))}</span>`:''}${r.format?`<span>· ${esc(r.format)}</span>`:''}${exTag(r)}</div>
      ${r.hook?`<div class="hook">${esc(r.hook)}</div>`:''}
      ${r.why?`<div class="kv"><b>${r.origem==='claude'?'Por que deve funcionar':'Por que funcionou'}:</b> ${esc(r.why)}</div>`:''}
      ${r.base?`<div class="kv"><b>Inspirada em:</b> ${safeUrl(r.baseUrl)?`<a href="${esc(safeUrl(r.baseUrl))}" target="_blank" rel="noopener">${esc(r.base)} ↗</a>`:esc(r.base)}</div>`:''}
      ${r.fit?`<div class="kv fit"><b>Como a marca entra:</b> ${esc(r.fit)}</div>`:''}
      ${r.views?`<div class="kv"><b>Resultado:</b> ${esc(r.views)}</div>`:''}
      ${r.tags?`<div class="chips">${String(r.tags).split(',').map(t=>t.trim()).filter(Boolean).map(t=>`<span class="tagpill">${esc(t)}</span>`).join('')}</div>`:''}
      <div class="foot">${r.origem==='claude'?btn(`Adicionar ao ${ENX?tabLabel('calendario').toLowerCase():'calendário'}`,'ref-plan',`data-id="${esc(r.id)}"`,'sm primary'):''}${aiBtn('Adaptar para a marca','ai-ref-one',`data-id="${esc(r.id)}"`,'sm')}${u?`<a class="btn sm" href="${esc(u)}" target="_blank" rel="noopener">Abrir ↗</a>`:''}${btn('Editar','edit',`data-col="refs" data-id="${esc(r.id)}"`,'sm ghost')}</div>
    </article>`;
  }).join('')+'</div>';
  return h;
}

/* ---------- novidade da semana (documento app/novidade, gravado pela rotina de evolução) ---------- */
function novidadeCard(){
  if(ENX)return ''; /* a versão enxuta não mostra o cartão de novidade */
  const n=state.novidade;if(!n||!n.titulo)return '';
  if(LS.get('cl.novidadeVista','')===(n.chave||n.data))return '';
  const idade=(Date.now()-new Date(n.data||0).getTime())/864e5;if(idade>10)return '';
  const aba=TABS.find(t=>t.id===n.aba);
  return `<div class="novidade" role="status"><span class="nv-tag">${SPARK}Novidade da semana</span><div class="nv-body"><b>${esc(n.titulo)}</b><p>${esc(n.texto||'')}</p></div>
    <div class="nv-act">${aba&&aba.id!==state.tab?`<button class="btn sm" data-act="tab" data-tab="${aba.id}">Ver em ${esc(aba.label)}</button>`:''}${btn('Entendi','nov-ok','','sm ghost')}</div></div>`;
}

/* ---------- bússola de conteúdo (brands/{marca}/insights/bussola) ---------- */
function emAltaGoogle(){
  const t=state.data.insights.find(x=>x.id==='tendencias');if(!t)return '';
  const termos=(Array.isArray(t.termos)?t.termos:[]).filter(x=>(x.subindo||[]).length);
  const alta=Array.isArray(t.emAlta)?t.emAlta:[];
  if(!termos.length&&!alta.length)return '';
  const chip=q=>`<span class="tagpill" title="Crescimento no Google Trends">${esc(q.busca)}${q.valor?` <b>${esc(String(q.valor))}</b>`:''}</span>`;
  return `<section class="trends"><h4>Em alta no Google <span class="muted small">Brasil, ${t.periodo==='today 1-m'?'últimos 30 dias':esc(t.periodo||'')}${t.geradoEm?' · '+fmtDay(String(t.geradoEm).slice(0,10)):''}</span></h4>
    ${termos.map(x=>`<div class="trow"><span class="eyebrow">${esc(x.termo)}</span><div class="chips">${x.subindo.slice(0,6).map(chip).join('')}</div></div>`).join('')}
    ${alta.length?`<div class="trow"><span class="eyebrow">Assuntos do dia</span><div class="chips">${alta.slice(0,6).map(a=>`<span class="tagpill">${esc(a.assunto)}${a.trafego?` <b>${esc(a.trafego)}</b>`:''}</span>`).join('')}</div></div>`:''}
    <p class="muted small">Buscas que mais cresceram ligadas aos temas da marca. Bom ponto de partida para ganchos e títulos.</p></section>`;
}
function bussola(){
  const b=state.data.insights.find(x=>x.id==='bussola');
  const up=state.bussolaRodando?`<span class="rstat pending"><span class="pulse"></span>Atualizando com as referências novas...</span>`:aiBtn(b?'Atualizar Bússola':'Gerar Bússola','ai-bussola','','sm');
  if(!b)return `<div class="bussola empty-b"><div><span class="eyebrow">Bússola de conteúdo</span><p class="muted">O Claude lê as referências e os números reais e diz o que está funcionando no mercado e o que produzir agora. Ela se atualiza sozinha quando as referências mudam.</p></div>${up}</div>`;
  const li=(arr,f)=>(Array.isArray(arr)?arr:[]).map(f).join('');
  return `<details class="bussola" ${LS.get('cl.bussolaFechada',false)?'':'open'}><summary><span class="eyebrow">Bússola de conteúdo</span><b>O que está viralizando no mercado${ENX?'':' e o que fazer agora'}</b><span class="muted small">${b.atualizadoEm?'atualizada em '+fmtDay(String(b.atualizadoEm).slice(0,10)):''}${b.base?' · '+esc(b.base):''}</span></summary>
    <div class="b-grid${ENX?' so-funciona':''}">
      <section><h4>Funciona</h4><ul>${li(b.funciona,x=>`<li><b>${esc(x.titulo)}</b>${x.prova?`<span class="prova">${esc(x.prova)}</span>`:''}${x.acao?`<span class="acao">→ ${esc(x.acao)}</span>`:''}</li>`)}</ul></section>
${ENX?'':`      <section><h4>Evite</h4><ul>${li(b.evitar,x=>`<li><b>${esc(x.titulo)}</b>${x.prova?`<span class="prova">${esc(x.prova)}</span>`:''}</li>`)}</ul>
        ${Array.isArray(b.agora)&&b.agora.length?`<h4>Faça agora</h4><ol>${li(b.agora,x=>`<li>${esc(x)}</li>`)}</ol>`:''}</section>`}
    </div>
    ${emAltaGoogle()}
    <div class="foot">${up}<span class="muted small">Viu algo viralizando na aba Explorar? Tire um print e cole em Nova referência: o Claude preenche e a Bússola passa a considerar.</span></div>
  </details>`;
}
/* a Bússola acompanha as Referências: quando elas mudam (nova, editada ou apagada), o Claude refaz a leitura */
let bussolaAuto='';
const BUSSOLA_MIN=ENX?2:3; /* na versão enxuta só entram virais dos últimos 30 dias, então há menos referências */
function bussolaDesatualizada(refs){
  const b=state.data.insights.find(x=>x.id==='bussola');if(!b)return refs.length>=BUSSOLA_MIN;
  const ult=refs.reduce((m,r)=>{const t=String(r.updatedAt||r.createdAt||'');return t>m?t:m},'');
  return ult>String(b.atualizadoEm||'')||(typeof b.nRefs==='number'&&b.nRefs!==refs.length);
}
function autoBussola(refs){
  if(!sample||state.bussolaRodando||refs.length<BUSSOLA_MIN||!bussolaDesatualizada(refs))return;
  const assin=refs.length+'|'+refs.map(r=>r.updatedAt||r.createdAt||'').sort().pop();
  if(assin===bussolaAuto)return;bussolaAuto=assin;
  setTimeout(()=>refreshBussola(null),0);
}
async function refreshBussola(btnEl){
  if(!sample){toast('A Bússola é atualizada pelo Claude quando a central é aberta no Claude.');return}
  const refs=refsReais(), posts=state.data.posts.filter(p=>p.status==='publicado');
  if(refs.length<BUSSOLA_MIN){if(btnEl)toast('Salve algumas referências primeiro.');return}
  const old=btnEl?btnEl.innerHTML:'';if(btnEl){btnEl.disabled=true;btnEl.innerHTML=SPARK+'Analisando...'}
  state.bussolaRodando=true;if(!btnEl)renderMain(true);
  try{
    const r=await sample.json(`${RULES}\n\n${brandCtx()}\n\nREFERÊNCIAS DO MERCADO (posts de outros perfis que funcionaram, com números reais)\n${lines(refs,x=>`- ${x.creator||''} [${x.format||''}] "${x.hook||''}" | ${x.views||''} | etiquetas: ${x.tags||''} | por que: ${x.why||''}${x.fit?' | como a marca entra: '+x.fit:''}`,40)}\n\nPUBLICADOS PELA MARCA\n${lines(posts,x=>`- ${x.date} [${x.format||''}] "${x.title}" | ${x.notes||''}`,30)}\n\nBUSCAS EM ALTA NO GOOGLE (Brasil)\n${(()=>{const t=state.data.insights.find(x=>x.id==='tendencias');return t&&Array.isArray(t.termos)?t.termos.map(x=>`- ${x.termo}: ${(x.subindo||[]).map(q=>q.busca+' ('+q.valor+')').join('; ')}`).join('\n'):'sem dados'})()}\n\nTAREFA: você é estrategista de conteúdo da marca. Compare o que está viralizando no mercado com o que a marca publica. Considere "alcance possivelmente pago" como formato de anúncio, não como viral orgânico. Responda só com JSON: {"base":"de onde vêm os dados, curto","funciona":[{"titulo":"padrão que funciona","prova":"exemplos e números reais das listas acima","acao":"como a marca aplica"}],"evitar":[{"titulo":"","prova":""}],"agora":["3 a 5 ações concretas para as próximas 2 semanas"]}. Use no máximo 5 itens em funciona e 3 em evitar. Nunca invente números.`,{cache:false});
    if(!r||!Array.isArray(r.funciona))throw {code:'invalid_json'};
    const doc={atualizadoEm:new Date().toISOString(),base:clean(r.base||''),funciona:r.funciona.slice(0,5).map(x=>({titulo:clean(x.titulo),prova:clean(x.prova),acao:clean(x.acao)})),
      evitar:(r.evitar||[]).slice(0,3).map(x=>({titulo:clean(x.titulo),prova:clean(x.prova)})),agora:(r.agora||[]).slice(0,5).map(clean),origem:'claude',nRefs:refs.length};
    await Store.set(bpath('insights'),'bussola',doc);toast(btnEl?'Bússola atualizada':'Bússola atualizada com as referências novas');
  }catch(e){if(btnEl)toast(aiErrMsg(e),4500)}
  finally{state.bussolaRodando=false;if(btnEl&&btnEl.isConnected){btnEl.disabled=false;btnEl.innerHTML=old}else if(!btnEl)renderMain(true)}
}

/* ---------- calendário ---------- */
function viewCal(){
  const {y,m}=state.cal, today=TODAY();
  const posts=state.data.posts.filter(p=>!state.f.calCh||p.channel===state.f.calCh);
  const byDay={};posts.forEach(p=>{(byDay[p.date]||(byDay[p.date]=[])).push(p)});
  Object.values(byDay).forEach(a=>a.sort((a,b)=>String(a.time||'99').localeCompare(String(b.time||'99'))));
  const mk=`${y}-${pad(m+1)}`;
  const dmap=datesByDay(y);
  const monthPosts=posts.filter(p=>String(p.date).startsWith(mk));
  const counts=STATUS.map(s=>[s,monthPosts.filter(p=>(p.status||'ideia')===s.id).length]);
  let h=head(ENX?tabLabel('calendario'):'Calendário de conteúdo','Planejamento por canal. Toque em um dia para criar um post nele.',
    aiBtn('Planejar a semana','ai-week')+btn('Novo post','new','data-col="posts"','primary'));
  h+=`<div class="toolbar">
    <div class="cal-nav"><button class="iconbtn" data-act="cal-prev" aria-label="Mês anterior">‹</button><div class="cal-title">${MESF[m]} ${y}</div><button class="iconbtn" data-act="cal-next" aria-label="Próximo mês">›</button><button class="btn sm ghost" data-act="cal-today">Hoje</button></div>
    <div class="spacer"></div>
    ${chips('calCh',[['','Todos'],...activeCh().map(c=>[c.id,c.label])],state.f.calCh)}
  </div>
  <div class="toolbar pipeline">${counts.map(([s,n])=>`<span class="status st-${s.id}"><i></i>${s.label} <b>${n}</b></span>`).join('')}</div>`;
  const soon=upcoming().filter(o=>o.days<=30);
  if(soon.length)h+=`<div class="dstrip"><span class="eyebrow">Próximos 30 dias</span>${soon.map(o=>`<button class="dpill${o.prep?' prep':''}" data-act="edit" data-col="dates" data-id="${esc(o.d.id)}">${STAR}<b>${fmtDay(o.key)}</b> ${esc(o.d.title)} <span class="muted">${whenTxt(o.days)}</span></button>`).join('')}</div>`;
  // grid
  const first=new Date(y,m,1), start=new Date(y,m,1-first.getDay());
  const last=new Date(y,m+1,0); const cells=Math.ceil((first.getDay()+last.getDate())/7)*7;
  let g='<div class="cal-grid">'+DOW.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  for(let i=0;i<cells;i++){
    const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i), k=iso(d), ps=byDay[k]||[];
    g+=`<div class="cell${d.getMonth()!==m?' out':''}${k===today?' today':''}" data-act="new-on" data-date="${k}" role="button" tabindex="0" aria-label="${d.getDate()} de ${MESF[d.getMonth()]}, ${ps.length} posts">
      <span class="dnum">${d.getDate()}</span>
      ${(dmap[k]||[]).map(x=>`<button class="dmark" data-act="edit" data-col="dates" data-id="${esc(x.id)}" title="${esc(x.title)}">${STAR}<span class="t">${esc(x.title)}</span></button>`).join('')}
      ${ps.slice(0,3).map(p=>`<button class="pchip" data-act="edit" data-col="posts" data-id="${esc(p.id)}" title="${esc(p.title)}">${code(p.channel)}<span class="t">${esc(p.title)}</span>${stTag(p.status).replace(/>[^<]+<\/span>$/,'></span>')}</button>`).join('')}
      ${ps.length>3?`<span class="more">+${ps.length-3} mais</span>`:''}
    </div>`;
  }
  g+='</div>';
  // agenda (mobile)
  const days=[...new Set([...Object.keys(byDay),...Object.keys(dmap)])].filter(k=>k.startsWith(mk)).sort();
  let a='<div class="agenda">';
  if(!days.length)a+=empty('Nada planejado neste mês','Crie um post ou peça ao Claude um plano para a semana.',btn('Novo post','new','data-col="posts"','primary'));
  days.forEach(k=>{const d=parseISO(k);
    a+=`<div class="aday${k===today?' today':''}"><h4>${DOWF[d.getDay()]}, ${d.getDate()} ${MES[d.getMonth()]}</h4>`+
      (dmap[k]||[]).map(x=>`<button class="dmark big" data-act="edit" data-col="dates" data-id="${esc(x.id)}">${STAR}<span class="t">${esc(x.title)}</span></button>`).join('')+
      (byDay[k]||[]).map(p=>`<button class="apost" data-act="edit" data-col="posts" data-id="${esc(p.id)}">${code(p.channel)}<span class="t">${esc(p.title)}</span>${p.time?`<span class="time">${esc(p.time)}</span>`:''}${stTag(p.status)}</button>`).join('')+`</div>`});
  a+='</div>';
  return h+g+a;
}

/* ---------- datas importantes ---------- */
function nextOcc(d){
  const b=parseISO(d.date);if(!b)return null;
  if(!d.recurring)return b;
  const t=parseISO(TODAY());
  let n=new Date(t.getFullYear(),b.getMonth(),b.getDate());
  if(n<t)n=new Date(t.getFullYear()+1,b.getMonth(),b.getDate());
  return n;
}
function upcoming(){
  const t=parseISO(TODAY());
  return state.data.dates.map(d=>{const n=nextOcc(d);if(!n)return null;
    const days=Math.round((n-t)/864e5), lead=Number(d.lead)>=0&&d.lead!==''&&d.lead!=null?Number(d.lead):14;
    return {d,n,key:iso(n),days,lead,prep:days>=0&&days<=lead,past:days<0};
  }).filter(Boolean).sort((a,b)=>a.n-b.n);
}
const dueSoon=()=>upcoming().filter(o=>o.prep);
function datesByDay(y){
  const map={};
  state.data.dates.forEach(d=>{const b=parseISO(d.date);if(!b)return;
    const keys=d.recurring?[y-1,y,y+1].map(yy=>iso(new Date(yy,b.getMonth(),b.getDate()))):[d.date];
    keys.forEach(k=>(map[k]||(map[k]=[])).push(d));});
  return map;
}
const whenTxt=n=>n===0?'hoje':n===1?'amanhã':n<0?(n===-1?'ontem':`há ${-n} dias`):`em ${n} dias`;
function viewDates(){
  const all=upcoming();
  let h=head(ENX?tabLabel('datas'):'Datas importantes',`Datas comemorativas, lançamentos, campanhas e prazos da marca. Cada data avisa quando chega a hora de começar a preparar o conteúdo e aparece ${ENX?'no planejamento':'no calendário'}.`,
    aiBtn('Sugerir datas do nicho','ai-dates')+btn('Nova data','new','data-col="dates"','primary'));
  if(!all.length)return h+empty('Nenhuma data cadastrada','Cadastre aniversário da marca, lançamentos e datas do nicho, ou peça sugestões ao Claude.',btn('Nova data','new','data-col="dates"','primary'));
  const row=o=>{const d=o.d;
    const prepFrom=new Date(o.n.getFullYear(),o.n.getMonth(),o.n.getDate()-o.lead);
    return `<article class="row drow${o.prep?' prep':''}${o.past?' past':''}">
      <div class="dbox"><b>${o.n.getDate()}</b><span>${MES[o.n.getMonth()]}${o.n.getFullYear()!==new Date().getFullYear()?' '+String(o.n.getFullYear()).slice(2):''}</span></div>
      <div class="row-main">
        <div class="meta">${d.type?`<span class="tagpill">${esc(d.type)}</span>`:''}${d.recurring?'<span>todo ano</span>':''}${exTag(d)}</div>
        <h3>${esc(d.title)}</h3>
        <div class="meta"><span class="when">${whenTxt(o.days)}</span>${o.past?'':o.prep?'<span class="prepflag">Hora de preparar</span>':`<span>preparar a partir de ${prepFrom.getDate()} ${MES[prepFrom.getMonth()]}</span>`}</div>
        ${d.notes?`<p>${esc(d.notes)}</p>`:''}
      </div>
      <div class="row-actions">${aiBtn('Ideias de conteúdo','ai-date-ideas',`data-id="${esc(d.id)}"`,'sm')}${o.past?'':btn('Criar post','date-post',`data-id="${esc(d.id)}"`,'sm')}${btn('Editar','edit',`data-col="dates" data-id="${esc(d.id)}"`,'sm ghost')}</div>
    </article>`};
  const prep=all.filter(o=>o.prep), next=all.filter(o=>!o.prep&&!o.past), past=all.filter(o=>o.past).reverse();
  if(prep.length)h+=`<h3 class="dsec">Hora de preparar <span>${prep.length}</span></h3><div class="stack">${prep.map(row).join('')}</div>`;
  if(next.length)h+=`<h3 class="dsec">Próximas <span>${next.length}</span></h3><div class="stack">${next.map(row).join('')}</div>`;
  if(past.length)h+=`<h3 class="dsec">Já passaram <span>${past.length}</span></h3><div class="stack">${past.map(row).join('')}</div>`;
  return h;
}

/* ---------- marca ---------- */
function viewBrand(){
  const b=curBrand(), ch=b.channels||{};
  const f=(k,l,type,opt={})=>{
    const v=b[k]??'';
    const inp=type==='textarea'?`<textarea id="b-${k}" rows="${opt.rows||3}" placeholder="${esc(opt.ph||'')}">${esc(Array.isArray(v)?v.join('\n'):v)}</textarea>`
      :`<input type="text" id="b-${k}" value="${esc(v)}" placeholder="${esc(opt.ph||'')}">`;
    return `<div class="field${opt.full?' full':''}"><label for="b-${k}">${l}</label>${inp}${opt.hint?`<span class="hint">${opt.hint}</span>`:''}</div>`;
  };
  let h=head('Configurações da marca','Tudo o que o Claude usa como contexto nas sugestões. Quanto mais específico, melhores as ideias.',
    aiBtn('Revisar posicionamento','ai-brand')+btn('Salvar alterações','brand-save','','primary'));
  h+=`<form class="bform" id="brandForm" autocomplete="off">
    <div class="bsec">Identidade</div>
    ${f('name','Nome da marca','text')}
    ${LAB.marca?`<input type="hidden" id="b-color" value="${esc(b.color||'')}">`:`<div class="field"><label for="b-color">Cor de identificação</label><div style="display:flex;gap:10px;align-items:center"><input type="color" id="b-color" value="${/^#[0-9a-f]{6}$/i.test(b.color||'')?b.color:'#D0106E'}"><span class="hint">Aparece no seletor de marcas.</span></div></div>`}
    ${f('niche','Nicho','text',{full:1})}
    ${f('description','O que a marca faz','textarea',{full:1,rows:2})}
    ${f('audience','Público','textarea',{rows:3})}
    ${f('tone','Tom de voz','textarea',{rows:3})}
    <div class="bsec">Conteúdo</div>
    ${f('pillars','Pilares de conteúdo','textarea',{rows:5,hint:'Um por linha. Viram as colunas do Mapa de ideias.'})}
    ${f('avoid','O que evitar','textarea',{rows:5,hint:'Palavras, temas e formatos que não combinam com a marca.'})}
    ${f('hashtags','Hashtags principais','text',{full:1})}
    ${f('briefing','Instruções para o Claude','textarea',{full:1,rows:3,hint:'Padrões de entrega, estrutura de posts, SEO, CTA etc.'})}
    <div class="bsec">Canais</div>
    ${CH.map(c=>{const o=ch[c.id]||{};return `<div class="chrow field full"><label class="chtoggle"><input type="checkbox" id="b-ch-${c.id}" ${o.on!==false?'checked':''}> ${code(c.id)} ${c.label}</label><input type="text" id="b-h-${c.id}" value="${esc(o.handle||'')}" placeholder="Perfil ou link" aria-label="Perfil ou link do ${c.label}"></div>`}).join('')}
    <div class="bsec">Fontes de notícias</div>
    ${f('sources','Sites que você acompanha','textarea',{full:1,rows:4,ph:'Nome | https://site.com',hint:'Uma por linha, no formato Nome | link. Aparecem no topo da aba Notícias.'})}
    <div class="field full" style="flex-direction:row;justify-content:flex-end">${btn('Salvar alterações','brand-save','','primary')}</div>
  </form>
  <div class="danger-zone backup-zone">
    <p><b>Backup.</b> Baixa um arquivo JSON com a marca e tudo o que está nela (notícias, referências, calendário, datas, ideias, métricas e concorrentes). As prévias ficam como id de arquivo.</p>
    ${btn('Baixar backup','brand-backup')}
  </div>
  <div class="danger-zone">
    <p><b>Dados de exemplo.</b> Remove os itens marcados como exemplo em todas as abas desta marca.</p>
    ${btn('Remover exemplos','brand-examples','','danger')}
  </div>
  ${LAB.marca?'':`<div class="danger-zone">
    <p><b>Excluir marca.</b> Apaga a marca e tudo o que está nela. Não dá para desfazer.</p>
    ${btn('Excluir marca','brand-delete','','danger')}
  </div>`}`;
  return h;
}
function readBrandForm(){
  const b=curBrand(), g=id=>{const el=document.getElementById(id);return el?el.value.trim():''};
  const channels={};CH.forEach(c=>channels[c.id]={on:document.getElementById('b-ch-'+c.id).checked,handle:g('b-h-'+c.id)});
  return Object.assign(strip(b),{
    name:g('b-name')||b.name, color:g('b-color'), niche:g('b-niche'), description:g('b-description'),
    audience:g('b-audience'), tone:g('b-tone'), pillars:g('b-pillars').split('\n').map(s=>s.trim()).filter(Boolean),
    avoid:g('b-avoid'), hashtags:g('b-hashtags'), briefing:g('b-briefing'), sources:g('b-sources'), channels,
    updatedAt:new Date().toISOString()});
}

/* ---------- mapa de ideias ---------- */
function viewIdeas(){
  let ideas=state.data.ideas.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  if(state.f.ideaCh)ideas=ideas.filter(i=>(i.channels||[]).includes(state.f.ideaCh));
  if(!state.f.ideaAll)ideas=ideas.filter(i=>!['usada','arquivada'].includes(i.status));
  const ps=pillars(), groups=ps.map(p=>[p,[]]), other=[];
  ideas.forEach(i=>{const g=groups.find(([p])=>p===i.pillar);(g?g[1]:other).push(i)});
  if(other.length)groups.push(['Sem pilar',other]);
  /* filtro por pilar: lista suspensa, porque a marca pode ter muitos pilares */
  if(state.f.ideaPilar&&!groups.some(([p])=>p===state.f.ideaPilar))state.f.ideaPilar='';
  const shown=state.f.ideaPilar?groups.filter(([p])=>p===state.f.ideaPilar):groups;
  let h=head('Mapa de ideias',`Banco de ideias organizado pelos pilares da marca. Consulte na hora de preencher ${ENX?'o planejamento':'o calendário'}.`,
    aiBtn('Gerar ideias','ai-ideas')+btn('Nova ideia','new','data-col="ideas"','primary'));
  h+=`<div class="toolbar"><label class="fsel"><span class="eyebrow">Pilar</span><select data-fsel="ideaPilar" aria-label="Filtrar por pilar"><option value="">Todos os pilares</option>${groups.map(([p,l])=>`<option value="${esc(p)}"${p===state.f.ideaPilar?' selected':''}>${esc(p)} (${l.length})</option>`).join('')}</select></label>${chips('ideaCh',[['','Todos os canais'],...activeCh().map(c=>[c.id,c.label])],state.f.ideaCh)}<div class="spacer"></div>
    <button class="chip" data-act="idea-all" aria-pressed="${state.f.ideaAll}">Mostrar usadas e arquivadas</button></div>`;
  if(!state.data.ideas.length&&!ps.length)return h+empty('Nenhuma ideia ainda','Cadastre os pilares na aba Marca e gere as primeiras ideias com o Claude.');
  h+='<div class="map">'+shown.map(([p,list])=>`<section class="pillar"><div class="pillar-head"><h3>${esc(p)}</h3><span>${list.length}</span></div>`+
    (list.length?list.map(i=>`<article class="idea${['usada','arquivada'].includes(i.status)?' dim':''}">
      <div class="meta">${(i.channels||[]).map(code).join('')}${i.format?`<span>${esc(i.format)}</span>`:''}${i.status&&i.status!=='nova'?`<span class="tagpill">${esc(ISTM[i.status]||i.status)}</span>`:''}${exTag(i)}</div>
      <h4>${esc(i.title)}</h4>${i.notes?`<p class="clamp">${esc(i.notes)}</p>`:''}
      <div class="foot">${btn('Agendar','idea-schedule',`data-id="${esc(i.id)}"`,'sm')}${aiBtn('Desenvolver','ai-idea-dev',`data-id="${esc(i.id)}"`,'sm')}${btn('Editar','edit',`data-col="ideas" data-id="${esc(i.id)}"`,'sm ghost')}</div>
    </article>`).join(''):`<p class="muted" style="font-size:13px;padding:4px 2px">Sem ideias neste pilar.</p>`)+
    `<button class="btn sm ghost" data-act="new" data-col="ideas" data-pillar="${esc(p==='Sem pilar'?'':p)}">+ Adicionar</button></section>`).join('')+'</div>';
  return h;
}

/* ---------- métricas ---------- */
const DAY=864e5;
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const diffDays=(a,b)=>Math.round((b-a)/DAY);
const fmtD=d=>d.getDate()+' '+MES[d.getMonth()]+(d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():'');
const M_PERIODS=[['7','Últimos 7 dias'],['30','Últimos 30 dias'],['365','Crescimento em 12 meses'],['custom','Personalizado']];
function recSpan(r){
  let s=parseISO(r.start), e=parseISO(r.end);
  if(!s&&!e&&/^\d{4}-\d{2}$/.test(r.month||'')){const [y,m]=r.month.split('-').map(Number);s=new Date(y,m-1,1);e=new Date(y,m,0)}
  if(!s&&!e&&r.date)s=e=parseISO(r.date);
  if(s&&!e)e=s; if(e&&!s)s=e;
  if(!s)return null;
  if(e<s){const t=s;s=e;e=t}
  return {s,e};
}
function metricRows(ch){
  return state.data.metrics.filter(r=>!ch||r.channel===ch).map(r=>{const sp=recSpan(r);return sp?Object.assign({},r,{_s:sp.s,_e:sp.e,_days:diffDays(sp.s,sp.e)+1}):null}).filter(Boolean).sort((a,b)=>a._e-b._e);
}
const has=(r,k)=>r[k]!=null&&r[k]!==''&&!isNaN(r[k]);
function overlapFrac(r,a,b){const s=r._s>a?r._s:a,e=r._e<b?r._e:b;const d=diffDays(s,e)+1;return d>0?d/r._days:0}
function flowSum(rows,k,a,b){let t=0,ok=false;rows.forEach(r=>{const f=overlapFrac(r,a,b);if(f>0&&has(r,k)){t+=Number(r[k])*f;ok=true}});return ok?t:null}
function engAvg(rows,a,b){let w=0,t=0;rows.forEach(r=>{const f=overlapFrac(r,a,b);if(f>0&&has(r,'engagement')){const d=f*r._days;w+=d;t+=Number(r.engagement)*d}});return w?t/w:null}
function follSnaps(rows){const t=parseISO(TODAY());return rows.filter(r=>has(r,'followers')).map(r=>({d:r._e>t?t:r._e,v:Number(r.followers)})).sort((a,b)=>a.d-b.d)}
function follAt(snaps,d){let v=null;snaps.forEach(s=>{if(s.d<=d)v=s.v});return v}
function mRange(){
  const t=parseISO(TODAY()), p=state.f.mPeriod;let a,b=t;
  if(p==='7')a=addDays(t,-6);
  else if(p==='365')a=new Date(t.getFullYear()-1,t.getMonth(),t.getDate()+1);
  else if(p==='custom'){a=parseISO(state.f.mFrom)||addDays(t,-29);b=parseISO(state.f.mTo)||t;if(b<a){const x=a;a=b;b=x}}
  else a=addDays(t,-29);
  const len=diffDays(a,b)+1;
  return {a,b,len,pa:addDays(a,-len),pb:addDays(a,-1)};
}
/* one channel, one metric, one range -> summary */
function mSummary(rows,k,R){
  if(k==='followers'){
    const sn=follSnaps(rows);
    const end=follAt(sn,R.b); if(end==null)return null;
    let start=follAt(sn,R.pb), since=null;
    if(start==null){const first=sn.find(s=>s.d>=R.a&&s.d<=R.b);if(first&&first.d<follAtDate(sn,R.b)){start=first.v;since=first.d}}
    return {value:end,diff:start!=null?end-start:null,pct:start?((end-start)/start*100):null,since,kind:'stock'};
  }
  if(k==='engagement'){const v=engAvg(rows,R.a,R.b);if(v==null)return null;const p=engAvg(rows,R.pa,R.pb);return {value:v,diff:p!=null?v-p:null,kind:'rate'}}
  const v=flowSum(rows,k,R.a,R.b);if(v==null)return null;const p=flowSum(rows,k,R.pa,R.pb);
  return {value:Math.round(v),pct:p?((v-p)/p*100):null,prev:p,kind:'flow'};
}
function follAtDate(sn,d){let x=null;sn.forEach(s=>{if(s.d<=d)x=s.d});return x}
function mSeries(rows,k,R){
  const monthly=R.len>62, pts=[];
  const buckets=[];
  if(monthly){let c=new Date(R.a.getFullYear(),R.a.getMonth(),1);while(c<=R.b){const s=c<R.a?R.a:c, e0=new Date(c.getFullYear(),c.getMonth()+1,0), e=e0>R.b?R.b:e0;buckets.push({s,e,label:MES[c.getMonth()]+'/'+String(c.getFullYear()).slice(2)});c=new Date(c.getFullYear(),c.getMonth()+1,1)}}
  else for(let i=0;i<R.len;i++){const d=addDays(R.a,i);buckets.push({s:d,e:d,label:d.getDate()+' '+MES[d.getMonth()]})}
  const sn=k==='followers'?follSnaps(rows):null;
  buckets.forEach(bk=>{
    let v;
    if(k==='followers')v=follAt(sn,bk.e);
    else if(k==='engagement')v=engAvg(rows,bk.s,bk.e);
    else v=flowSum(rows,k,bk.s,bk.e);
    if(v!=null)pts.push({x:bk.label,y:k==='engagement'?v:Math.round(v)});
  });
  return pts;
}
function viewMetrics(){
  const cfg=kpiCfg();if(cfg)return viewKpis(cfg);
  const all=metricRows();
  /* abre na métrica que tem dados (ex.: só Alcance e Posts vêm do vidIQ) */
  const temK=k=>all.some(r=>has(r,k));
  if(!temK(state.f.metric)){const m=METRICS.find(x=>temK(x.k));if(m)state.f.metric=m.k}
  const M=METRICS.find(x=>x.k===state.f.metric)||METRICS[0];
  const R=mRange();
  let h=head('Métricas',`Acompanhe cada canal no período que quiser. Registre os números de um dia, de uma semana ou de um mês; o ${APP} soma e compara sozinho.`,
    aiBtn('Analisar desempenho','ai-metrics')+btn('Registrar números','new','data-col="metrics"','primary'));
  if(!all.length)return h+empty('Nenhuma métrica registrada','Registre os números de cada canal para ver a evolução aqui.',btn('Registrar números','new','data-col="metrics"','primary'));
  const p=state.f.mPeriod;
  h+=`<div class="toolbar"><span class="eyebrow">Período</span>${chips('mPeriod',M_PERIODS,p)}
    ${p==='custom'?`<div class="crange"><label for="mFrom">De</label><input type="date" id="mFrom" value="${iso(R.a)}"><label for="mTo">até</label><input type="date" id="mTo" value="${iso(R.b)}">${btn('Aplicar','m-apply','','sm primary')}</div>`:''}</div>
  <p class="rlabel"><b>${fmtD(R.a)} a ${fmtD(R.b)}</b> <span class="muted">· ${R.len} ${R.len>1?'dias':'dia'} · comparado com ${fmtD(R.pa)} a ${fmtD(R.pb)}</span></p>
  <div class="toolbar">${chips('metric',METRICS.map(x=>[x.k,temK(x.k)?x.l:`${x.l} <span class="cnt">sem dados</span>`]),M.k)}</div>`;
  const notas=[...new Set(all.map(r=>r.notes).filter(Boolean))];
  if(notas.length)h+=`<p class="muted" style="font-size:12.5px;margin:-6px 0 14px">Fonte: ${esc(notas[0])}${notas.length>1?` (+${notas.length-1} observações nos registros)`:''}</p>`;
  const label={stock:'no fim do período',rate:'média no período',flow:'total no período'};
  const cards=CH.map(c=>{
    const rows=all.filter(r=>r.channel===c.id);if(!rows.length)return '';
    const sm=mSummary(rows,M.k,R);if(!sm)return '';
    const pts=mSeries(rows,M.k,R);
    let delta='',note='';
    const pill=(v,txt)=>{const cls=Math.abs(v)<0.05?'flat':v>0?'up':'down';return `<span class="delta ${cls}">${cls==='up'?'▲':cls==='down'?'▼':'■'} ${txt}</span>`};
    const sgn=v=>(v>0?'+':v<0?'−':'');
    const nf1=v=>Math.abs(v).toLocaleString('pt-BR',{maximumFractionDigits:1});
    if(sm.kind==='stock'){
      if(sm.diff!=null){delta=pill(sm.diff,`${sgn(sm.diff)}${NF.format(Math.abs(sm.diff))}${sm.pct!=null?` (${sgn(sm.pct)}${nf1(sm.pct)}%)`:''}`);note=sm.since?`crescimento desde ${fmtD(sm.since)}`:'crescimento no período'}
      else note='sem registro anterior para comparar';
    }else if(sm.kind==='rate'){
      if(sm.diff!=null){delta=pill(sm.diff,`${sgn(sm.diff)}${nf1(sm.diff)} p.p.`);note='vs. período anterior'}else note='sem dados do período anterior';
    }else{
      if(sm.pct!=null){delta=pill(sm.pct,`${sgn(sm.pct)}${nf1(sm.pct)}%`);note='vs. período anterior'}else note='sem dados do período anterior';
    }
    return `<div class="mcard"><div class="mcard-head"><span class="sw" style="background:var(--c-${c.id})"></span>${c.label}<span class="spacer"></span><span class="muted" style="font-weight:500;font-size:12.5px">${label[sm.kind]}</span></div>
      <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="mbig">${fmtN(sm.kind==='rate'?sm.value:Math.round(sm.value),M.pct)}</div>${delta}<span class="muted" style="font-size:12px">${note}</span></div>
      ${pts.length?spark(pts,c.id,M.pct,M.l):'<p class="muted" style="font-size:12.5px;margin:10px 0 6px">Poucos registros para o gráfico.</p>'}</div>`;
  }).join('');
  h+=cards?`<div class="mgrid">${cards}</div>`:empty('Sem números nesse período',`Nenhum canal tem ${M.l.toLowerCase()} registrado entre ${fmtD(R.a)} e ${fmtD(R.b)}.`,btn('Registrar números','new','data-col="metrics"','primary'));
  const inR=all.filter(r=>r._e>=R.a&&r._s<=R.b).sort((a,b)=>b._e-a._e);
  const per=r=>+r._s===+r._e?fmtD(r._e):`${fmtD(r._s)} a ${fmtD(r._e)}`;
  if(inR.length){
    h+=`<h3 class="dsec">Registros no período <span>${inR.length}</span></h3><div class="tbl-wrap"><table><thead><tr><th>Período</th><th>Canal</th><th class="n">Seguidores</th><th class="n">Alcance</th><th class="n">Engaj.</th><th class="n">Cliques</th><th class="n">Posts</th><th></th></tr></thead><tbody>`+
      inR.map(r=>`<tr><td>${per(r)}</td><td>${code(r.channel)} ${esc((CHM[r.channel]||{}).label||r.channel)} ${exTag(r)}</td>
      <td class="n">${fmtN(r.followers)}</td><td class="n">${fmtN(r.reach)}</td><td class="n">${fmtN(r.engagement,1)}</td><td class="n">${fmtN(r.clicks)}</td><td class="n">${fmtN(r.posts)}</td>
      <td>${btn('Editar','edit',`data-col="metrics" data-id="${esc(r.id)}"`,'sm ghost')}</td></tr>`).join('')+`</tbody></table></div>
      <p class="muted" style="font-size:12px;margin-top:8px">Registros que cobrem só parte do período entram de forma proporcional aos dias.</p>`;
  }
  return h;
}
function spark(pts,ch,pct,label){
  const W=300,H=118,pl=8,pr=8,pt=14,pb=20;
  const ys=pts.map(p=>p.y);let mn=Math.min(...ys),mx=Math.max(...ys);
  if(mn===mx){mn=mn-Math.abs(mn||1)*.1;mx=mx+Math.abs(mx||1)*.1}
  const padv=(mx-mn)*.15;mn-=padv;mx+=padv;
  const X=i=>pts.length===1?W/2:pl+i*(W-pl-pr)/(pts.length-1);
  const Y=v=>pt+(1-(v-mn)/(mx-mn))*(H-pt-pb);
  const line=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.y).toFixed(1)).join(' ');
  const area=line+` L${X(pts.length-1).toFixed(1)} ${H-pb} L${X(0).toFixed(1)} ${H-pb} Z`;
  const col=`var(--c-${ch})`, cw=(W-pl-pr)/Math.max(pts.length-1,1), dense=pts.length>16;
  let s=`<svg class="mchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} de ${esc((CHM[ch]||{}).label)}, de ${esc(pts[0].x)} a ${esc(pts[pts.length-1].x)}">`;
  [0,.5,1].forEach(t=>{const yy=pt+t*(H-pt-pb);s+=`<line x1="${pl}" x2="${W-pr}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1"/>`});
  s+=`<path d="${area}" fill="${col}" opacity=".10"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p,i)=>{const last=i===pts.length-1;if(dense&&!last)return;s+=`<circle cx="${X(i)}" cy="${Y(p.y)}" r="${last?4.5:3}" fill="${last?col:'var(--surface)'}" stroke="${col}" stroke-width="2"/>`});
  s+=`<text x="${X(0)}" y="${H-5}" text-anchor="start">${esc(pts[0].x)}</text>`;
  if(pts.length>1)s+=`<text x="${X(pts.length-1)}" y="${H-5}" text-anchor="end">${esc(pts[pts.length-1].x)}</text>`;
  pts.forEach((p,i)=>{const x0=pts.length===1?0:Math.max(0,X(i)-cw/2);const w=pts.length===1?W:Math.min(cw,W-x0);
    s+=`<rect x="${x0}" y="0" width="${w}" height="${H}" fill="transparent" data-tip="${esc(p.x)} · ${esc(fmtN(p.y,pct))}"/>`});
  return s+'</svg>';
}

/* ---------- KPIs semanais (planilha "KPIs do Marketing"): insights/kpis + metrics/kpi-AAAA-MM-DD ---------- */
const K_PER=[['4s','Último mês'],['52s','Último ano'],['tudo','Tudo'],['custom','Personalizado']];
const kpiCfg=()=>{const c=state.data.insights.find(x=>x.id==='kpis');return c&&Array.isArray(c.grupos)&&c.grupos.length?c:null};
const kpiWeeks=()=>state.data.metrics.filter(r=>r.tipo==='kpi'&&/^\d{4}-\d{2}-\d{2}$/.test(r.data||'')).sort((a,b)=>a.data<b.data?-1:1);
const kv=(w,g,k)=>{const v=w&&w.valores&&w.valores[g]&&w.valores[g][k];return v==null||v===''||isNaN(v)?null:Number(v)};
const kAprox=(w,g,k)=>!!(w&&w.aprox&&Array.isArray(w.aprox[g])&&w.aprox[g].includes(k));
function fmtTempo(s){s=Math.round(s);const m=Math.floor(s/60),r=s%60;return m?`${m}'${pad(r)}''`:`${r}''`}
function fmtK(v,tipo,aprox){
  if(v==null)return '–';
  const t=tipo==='tempo'?fmtTempo(v):tipo==='horas'?Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1})+' h':NF.format(Math.round(v*10)/10);
  return (aprox?'~':'')+t;
}
/* aceita 7351, 7.351, 37,6 mil, 3,5 e, para tempo, 1'20'', 1:20 ou segundos */
function parseKpi(raw,tipo){
  let s=String(raw||'').trim().replace(/[`´]/g,'');
  if(!s)return {v:null};
  if(tipo==='tempo'){
    const m=/^(?:(\d+)\s*['’:]\s*)?(\d+)\s*(?:''|"|”|’’|s)?$/.exec(s);
    return m?{v:(+(m[1]||0))*60+(+m[2])}:{err:1};
  }
  const mil=/^(\d+(?:[.,]\d+)?)\s*mil$/i.exec(s);
  if(mil)return {v:Math.round(parseFloat(mil[1].replace(',','.'))*1000),aprox:true};
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))s=s.replace(/\./g,'');
  s=s.replace(',','.');
  return /^\d+(\.\d+)?$/.test(s)?{v:+s}:{err:1};
}
/* semanas do período (pelo último dia que cada semana cobre) e o período anterior de mesmo tamanho, para comparar */
function kpiRange(all){
  const last=parseISO(all[all.length-1].end), p=K_PER.some(x=>x[0]===state.f.kPer)?state.f.kPer:'4s';
  const inR=(w,x,y)=>{const e=parseISO(w.end);return e>=x&&e<=y};
  if(p==='tudo')return {p,sel:all,prev:[],a:parseISO(all[0].start),b:last};
  let a,b=last;
  if(p==='custom'){a=parseISO(state.f.kFrom)||addDays(last,-27);b=parseISO(state.f.kTo)||last;if(b<a){const x=a;a=b;b=x}}
  else a=addDays(last,p==='52s'?-363:-27);
  const len=diffDays(a,b)+1, pa=addDays(a,-len), pb=addDays(a,-1);
  return {p,sel:all.filter(w=>inR(w,a,b)),prev:all.filter(w=>inR(w,pa,pb)),a,b,pa,pb};
}
/* número do período: estoque = valor no fim; soma e horas = total; media e tempo = média por semana */
function kAgg(ws,g,m){
  const vals=ws.map(w=>kv(w,g,m.k)).filter(v=>v!=null);if(!vals.length)return null;
  const aprox=ws.some(w=>kv(w,g,m.k)!=null&&kAprox(w,g,m.k));
  if(m.tipo==='estoque')return {v:vals[vals.length-1],first:vals[0],n:vals.length,aprox};
  const t=vals.reduce((a,b)=>a+b,0);
  if(m.tipo==='soma'||m.tipo==='horas')return {v:m.tipo==='horas'?Math.round(t*10)/10:t,n:vals.length,aprox};
  return {v:Math.round(t/vals.length),n:vals.length,aprox};
}
const K_ROT={estoque:'no fim do período',soma:'total no período',horas:'total no período',media:'média por semana',tempo:'média por semana'};
function kCompare(m,cur,prv){
  if(!cur)return '';
  let d,base;
  if(m.tipo==='estoque'){base=prv?prv.v:(cur.n>1?cur.first:null);if(base==null)return '';d=cur.v-base}
  else{if(!prv)return '';base=prv.v;d=cur.v-base}
  const cls=Math.abs(d)<1e-9?'flat':d>0?'up':'down', arrow=cls==='up'?'▲':cls==='down'?'▼':'■', sg=d>0?'+':d<0?'−':'';
  const txt=m.tipo==='estoque'?`${sg}${NF.format(Math.abs(Math.round(d*10)/10))}`:
    base?`${sg}${Math.abs(d/base*100).toLocaleString('pt-BR',{maximumFractionDigits:0})}%`:(m.tipo==='tempo'?sg+fmtTempo(Math.abs(d)):`${sg}${NF.format(Math.abs(d))}`);
  const tit=m.tipo==='estoque'?(prv?'crescimento no período':'desde a primeira semana do período'):'vs. período anterior';
  return `<span class="delta ${cls}" title="${tit}">${arrow} ${txt}</span>`;
}
const wLabel=w=>fmtD(parseISO(w.data));
const wPer=w=>`${fmtD(parseISO(w.start))} a ${fmtD(parseISO(w.end))}`;
function kSpark(ws,g,m,cor){
  const pts=ws.map(w=>{const v=kv(w,g,m.k);return v==null?null:{x:wLabel(w),y:m.tipo==='horas'?v:Math.round(v)}}).filter(Boolean);
  if(pts.length<2)return '<p class="muted" style="font-size:12.5px;margin:10px 0 6px">Poucas semanas para o gráfico.</p>';
  return spark(pts,cor,false,m.l).replace(/data-tip="([^"]*) · ([^"]*)"/g,(all,x,y)=>{const p=pts.find(q=>esc(q.x)===x);return p?`data-tip="${x} · ${esc(fmtK(p.y,m.tipo))}"`:all});
}
function viewKpis(cfg){
  const all=kpiWeeks();
  let h=head('Métricas','Acompanhamento semanal dos canais, no formato da planilha de KPIs. A data de cada semana é o dia do preenchimento; os números são dos 7 dias anteriores.',
    aiBtn('Analisar desempenho','ai-metrics')+btn('Lançar semana','kpi-new','','primary'));
  if(!all.length)return h+empty('Nenhuma semana lançada','Lance os números da semana para começar o acompanhamento.',btn('Lançar semana','kpi-new','','primary'));
  const last=all[all.length-1], dias=diffDays(parseISO(last.data),parseISO(TODAY()));
  h+=`<p class="igstat">Última semana lançada: <b>${esc(wLabel(last))}</b> (${esc(wPer(last))}).${dias>=7?` <b>Faltam ${Math.floor(dias/7)} ${Math.floor(dias/7)>1?'semanas':'semana'}</b> para chegar a hoje.`:''}</p>`;
  const gs=cfg.grupos, gid=gs.some(g=>g.id===state.f.kGrupo)?state.f.kGrupo:'';
  h+=`<div class="toolbar">${chips('kGrupo',[['','Visão geral'],...gs.map(g=>[g.id,esc(g.nome)])],gid)}</div>
    <div class="toolbar"><span class="eyebrow">Período</span>${chips('kPer',K_PER,state.f.kPer)}</div>`;
  const R=kpiRange(all), ws=R.sel, n=ws.length;
  if(R.p==='custom')h+=`<div class="toolbar crange"><label for="kFrom">De</label><input type="date" id="kFrom" value="${iso(R.a)}"><label for="kTo">até</label><input type="date" id="kTo" value="${iso(R.b)}">${btn('Aplicar','k-apply','','sm primary')}</div>`;
  const cmp=R.p==='tudo'?'todo o histórico, sem período anterior para comparar':R.prev.length?`comparado com ${fmtD(R.pa)} a ${fmtD(R.pb)}`:'sem semanas lançadas no período anterior para comparar';
  h+=`<p class="rlabel"><b>${fmtD(R.a)} a ${fmtD(R.b)}</b> <span class="muted">· ${n} ${n===1?'semana lançada':'semanas lançadas'} · ${cmp}</span></p>`;
  if(!n)return h+empty('Nenhuma semana nesse período','Escolha outro período ou lance a semana.',btn('Lançar semana','kpi-new','','primary'));
  if(!gid){
    h+='<div class="mgrid">'+gs.map(g=>{
      const ms=g.metricas||[], main=ms[0];
      const rows=ms.map(m=>{const c=kAgg(ws,g.id,m);return `<tr><td>${esc(m.l)}<span class="krot">${K_ROT[m.tipo]||''}</span></td><td class="n">${c?fmtK(c.v,m.tipo,c.aprox):'–'}</td><td class="n">${kCompare(m,c,kAgg(R.prev,g.id,m))}</td></tr>`}).join('');
      return `<div class="mcard kcard"><div class="mcard-head"><span class="sw" style="background:var(--c-${esc(g.cor||g.id)})"></span>${esc(g.nome)}<span class="spacer"></span>${btn('Ver canal','filter',`data-f="kGrupo" data-v="${esc(g.id)}"`,'sm ghost')}</div>
        ${main?`<div class="muted small">${esc(main.l)} semana a semana</div>${kSpark(ws,g.id,main,g.cor||g.id)}`:''}
        <table class="ktbl"><tbody>${rows}</tbody></table></div>`;
    }).join('')+'</div>';
  }else{
    const g=gs.find(x=>x.id===gid), ms=g.metricas||[];
    h+='<div class="mgrid">'+ms.map(m=>{
      const c=kAgg(ws,g.id,m);
      return `<div class="mcard"><div class="mcard-head">${esc(m.l)}<span class="spacer"></span>${m.fonte?`<span class="muted" style="font-weight:500;font-size:12px">${esc(m.fonte)}</span>`:''}</div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="mbig">${c?fmtK(c.v,m.tipo,c.aprox):'–'}</div>${kCompare(m,c,kAgg(R.prev,g.id,m))}<span class="muted" style="font-size:12px">${K_ROT[m.tipo]||''}${c&&m.tipo!=='estoque'?`, ${c.n} ${c.n>1?'semanas':'semana'}`:''}</span></div>
        ${kSpark(ws,g.id,m,g.cor||g.id)}</div>`;
    }).join('')+'</div>';
  }
  /* tabela no formato da planilha: métricas nas linhas, semanas nas colunas (mais recente primeiro) */
  const cols=ws.slice().reverse().slice(0,gid?26:10), grupos=gid?gs.filter(g=>g.id===gid):gs;
  h+=`<h3 class="dsec">Semanas do período <span>${cols.length<n?`as ${cols.length} mais recentes de ${n}`:n}</span></h3><div class="tbl-wrap"><table class="ksheet"><thead><tr><th>Dado</th>${cols.map(w=>`<th class="n"><span title="${esc(wPer(w))}">${esc(wLabel(w))}</span><br>${btn('Editar','kpi-edit',`data-id="${esc(w.id)}"`,'sm ghost')}</th>`).join('')}</tr></thead><tbody>`+
    grupos.map(g=>`<tr class="kgrp"><td colspan="${cols.length+1}"><span class="sw" style="background:var(--c-${esc(g.cor||g.id)})"></span> ${esc(g.nome)}</td></tr>`+
      (g.metricas||[]).map(m=>`<tr><td>${esc(m.l)}</td>${cols.map(w=>`<td class="n">${fmtK(kv(w,g.id,m.k),m.tipo,kAprox(w,g.id,m.k))}</td>`).join('')}</tr>`).join('')).join('')+
    `</tbody></table></div><p class="muted" style="font-size:12px;margin-top:8px">~ = número arredondado na origem (ex.: 37,6 mil). Traço = não lançado.${cfg.nota?' '+esc(cfg.nota):''}</p>`;
  return h;
}
function openKpiEditor(week){
  const cfg=kpiCfg();if(!cfg)return;
  const all=kpiWeeks(), ref=week||all[all.length-1];
  const data=week?week.data:TODAY();
  modalCtx={col:'kpi',item:week||null};
  const dlg=$('#modal .dialog');
  const campo=(g,m)=>{
    const v=week?kv(week,g.id,m.k):null, ph=ref&&!week?kv(ref,g.id,m.k):null;
    const show=v==null?'':m.tipo==='tempo'?fmtTempo(v):(kAprox(week,g.id,m.k)?(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil':String(v).replace('.',','));
    return `<div class="field"><label for="k-${g.id}-${m.k}">${esc(m.l)}</label><input type="text" inputmode="decimal" id="k-${g.id}-${m.k}" data-g="${esc(g.id)}" data-k="${esc(m.k)}" data-t="${esc(m.tipo)}" value="${esc(show)}" placeholder="${ph!=null?'semana anterior: '+esc(fmtK(ph,m.tipo)):''}">${m.fonte?`<span class="hint">${esc(m.fonte)}</span>`:''}</div>`;
  };
  dlg.innerHTML=`<div class="dlg-head"><h2 id="dlgTitle">${week?'Editar semana':'Lançar semana'}</h2><button class="iconbtn" data-act="modal-close" aria-label="Fechar">×</button></div>
    <form class="dlg-body" id="editForm" autocomplete="off">
      <div class="field full"><label for="k-data">Data do preenchimento</label><input type="date" id="k-data" value="${esc(data)}"><span class="hint">Os números são dos 7 dias anteriores a essa data. Deixe em branco o que não tiver.</span></div>
      ${cfg.grupos.map(g=>`<h3 class="bsec" style="grid-column:1/-1"><span class="sw" style="background:var(--c-${esc(g.cor||g.id)})"></span> ${esc(g.nome)}</h3>${(g.metricas||[]).map(m=>campo(g,m)).join('')}`).join('')}
      <p class="field full hint">Aceita 7351, 7.351, 37,6 mil e, para tempo, 1'20'' ou 1:20.</p>
      <p class="err full" id="formErr" hidden style="grid-column:1/-1"></p></form>
    <div class="dlg-foot">${week?btn('Excluir','kpi-del','','danger'):''}<span class="spacer"></span>${btn('Cancelar','modal-close','','ghost')}${btn(week?'Salvar':'Lançar','kpi-save','','primary')}</div>`;
  dlg.setAttribute('aria-labelledby','dlgTitle');
  $('#modal').hidden=false;
}
async function saveKpi(){
  const week=modalCtx&&modalCtx.item, err=$('#formErr'), data=$('#k-data').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data)){err.textContent='Escolha a data do preenchimento.';err.hidden=false;return}
  const id='kpi-'+data, other=kpiWeeks().find(w=>w.data===data&&(!week||w.id!==week.id));
  if(other){err.textContent=`Já existe uma semana lançada em ${fmtD(parseISO(data))}. Feche e use Editar nela.`;err.hidden=false;return}
  const valores={}, aprox={}, ruins=[];
  document.querySelectorAll('#editForm input[data-g]').forEach(inp=>{
    const r=parseKpi(inp.value,inp.dataset.t);
    if(r.err){ruins.push(inp.closest('.field').querySelector('label').textContent);return}
    if(r.v==null)return;
    (valores[inp.dataset.g]||(valores[inp.dataset.g]={}))[inp.dataset.k]=r.v;
    if(r.aprox)(aprox[inp.dataset.g]||(aprox[inp.dataset.g]=[])).push(inp.dataset.k);
  });
  if(ruins.length){err.textContent='Não entendi o número em: '+ruins.join(', ')+'.';err.hidden=false;return}
  if(!Object.keys(valores).length){err.textContent='Preencha pelo menos um número.';err.hidden=false;return}
  const d=parseISO(data), doc={tipo:'kpi',data,start:iso(addDays(d,-7)),end:iso(addDays(d,-1)),valores,
    origem:week?(week.origem||'manual'):'manual',createdAt:week&&week.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(Object.keys(aprox).length)doc.aprox=aprox;
  try{
    await Store.set(bpath('metrics'),id,doc);
    if(week&&week.id!==id)await Store.remove(bpath('metrics'),week.id);
    toast(week?'Semana atualizada':'Semana lançada');modalCtx.saved=true;closeModal();
  }catch(_){}
}

/* ---------- concorrentes ---------- */
const TRIGGER_ID='trig_01AM7vMvx9QEQ2wfVjsVCMuz';
const IMPORT_TRIGGER_ID='trig_013cy9D6MRXUtjTWdWLd4Abn'; // rotina "Instagram do Content Lab" (vidIQ)
const CC_KINDS=[['','Tudo'],['conteudo','Conteúdo publicado'],['noticia','Notícias sobre a empresa']];
const kindOf=n=>n.kind==='conteudo'?'conteudo':'noticia';
const CC_PERIODS=[['7','7 dias'],['15','15 dias'],['30','30 dias'],['','Todas']];
const AUTO_CH=[['site','Site'],['blog','Blog'],['instagram','Instagram'],['linkedin','LinkedIn'],['youtube','YouTube'],['tiktok','TikTok']];
const AUTO_CODE={site:'SITE',blog:'BLOG',instagram:'IG',linkedin:'IN',youtube:'YT',tiktok:'TT'};
const chCode=k=>`<span class="code ${esc(k)}">${AUTO_CODE[k]||esc(String(k).slice(0,4).toUpperCase())}</span>`;
function compStatus(c){
  const r=c.research||{};
  if(r.status==='pedido'&&(!c.autoCheckedAt||String(r.requestedAt)>String(c.autoCheckedAt)))
  {const age=(Date.now()-new Date(r.requestedAt||0).getTime())/6e4;
    if(r.requestedAt&&age>30)return `<span class="rstat stuck" title="A pesquisa roda como uma tarefa agendada do Claude. Se ela pedir aprovação, fica parada até alguém aprovar.">Pesquisa parada há ${age<120?Math.round(age)+' min':Math.round(age/60)+' h'}. Confira se a tarefa agendada está esperando aprovação.</span>`;
    return `<span class="rstat pending"><span class="pulse"></span>Pesquisa pedida${r.requestedAt?' em '+fmtDay(String(r.requestedAt).slice(0,10)):''}</span>`;}
  if(c.autoCheckedAt)return `<span class="rstat done">Revisado em ${fmtDay(String(c.autoCheckedAt).slice(0,10))}</span>`;
  return '<span class="rstat">Ainda não pesquisado</span>';
}
function chLink(k,v,autoUrl){
  const au=safeUrl(autoUrl);if(au)return au;
  const s=String(v||'').trim();if(!s)return '';
  if(/^https?:\/\//i.test(s))return safeUrl(s);
  if(s.includes('.'))return safeUrl('https://'+s.replace(/^\/+/,''));
  const h=s.replace(/^@/,'');
  if(k==='instagram')return 'https://www.instagram.com/'+encodeURIComponent(h)+'/';
  if(k==='tiktok')return 'https://www.tiktok.com/@'+encodeURIComponent(h);
  if(k==='youtube')return 'https://www.youtube.com/@'+encodeURIComponent(h);
  return '';
}
/* chave para comparar links (sem www, query e barra final; reel = p) */
const linkKey=u=>{const x=safeUrl(u);if(!x)return '';const p=new URL(x);let path=p.pathname.replace(/\/+$/,'');
  const h=p.hostname.replace(/^(www|m)\./,'');
  if(h==='youtube.com'&&path==='/watch')return h+'/watch?v='+(p.searchParams.get('v')||'');
  if(h==='instagram.com')path=path.replace(/^\/(reels?|tv)\//,'/p/');
  return h+path};
const shortUrl=u=>u.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'');
function viewComps(){
  const list=state.data.competitors.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));
  let h=head('Concorrentes','Cadastre um concorrente e o Claude revisa os canais dele e busca notícias relevantes na internet. A pesquisa, as notícias e as suas anotações ficam juntas aqui.',
    aiBtn('Lacunas e oportunidades','ai-comps')+(list.length?igBtn():'')+btn('Novo concorrente','new','data-col="competitors"','primary'));
  if(list.length)h+=igStatus();
  if(!list.length)return h+empty('Nenhum concorrente cadastrado','Cadastre o nome e, se souber, o site e os perfis. O Claude completa o resto com a pesquisa.',btn('Novo concorrente','new','data-col="competitors"','primary'));
  const names=Object.fromEntries(list.map(c=>[c.id,c.name]));
  if(state.f.compFilter&&!names[state.f.compFilter])state.f.compFilter='';
  const allNews=state.data.compnews.slice().sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt)));

  /* ---- cards ---- */
  h+='<div class="grid comp-grid">'+list.map(c=>{
    const ac=c.autoChannels&&typeof c.autoChannels==='object'?c.autoChannels:{};
    const rows=AUTO_CH.map(([k,l])=>{
      const user=c[k]||'', a=ac[k]||{}, url=chLink(k,user,a.url);
      if(!user&&!url&&!a.notes)return '';
      const label=user&&!/^https?:\/\//i.test(user)&&!user.includes('/')?user:(url?shortUrl(url):user);
      return `<li>${chCode(k)}<div><span class="chname">${l}</span>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`:`<span>${esc(label)}</span>`}${a.notes?`<p>${esc(a.notes)}</p>`:''}</div></li>`;
    }).filter(Boolean);
    const extra=Object.keys(ac).filter(k=>!AUTO_CODE[k]&&ac[k]&&(ac[k].url||ac[k].notes));
    extra.forEach(k=>{const u=safeUrl(ac[k].url);rows.push(`<li>${chCode(k)}<div><span class="chname">${esc(k)}</span>${u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(shortUrl(u))} ↗</a>`:''}${ac[k].notes?`<p>${esc(ac[k].notes)}</p>`:''}</div></li>`)});
    const nCount=allNews.filter(n=>n.competitorId===c.id).length;
    const pending=(c.research||{}).status==='pedido'&&(!c.autoCheckedAt||String((c.research||{}).requestedAt)>String(c.autoCheckedAt));
    const au=c.audiencia&&typeof c.audiencia==='object'?c.audiencia:{};
    const auRows=[['instagram','seguidores'],['youtube','inscritos'],['linkedin','seguidores']].filter(([k])=>au[k]&&au[k].n>0);
    const auDate=auRows.map(([k])=>String(au[k].em||'')).sort().pop();
    const NOME={instagram:'Instagram',youtube:'YouTube',linkedin:'LinkedIn'};
    const audiencia=auRows.length?`<div class="kst-row">${auRows.map(([k,l])=>`<div class="kst" title="${esc(NF.format(au[k].n))} ${l} no ${NOME[k]}${au[k].em?', lido em '+fmtDay(String(au[k].em).slice(0,10)):''}"><b>${esc(fmtNC(au[k].n))}</b><span>${NOME[k]}</span></div>`).join('')}</div>`
      :`<p class="muted small">Seguidores e inscritos chegam com a próxima coleta diária.</p>`;
    const x=c.autoContent&&typeof c.autoContent==='object'?c.autoContent:null;
    const conteudo=x&&(x.topics||x.formats||x.whatWorks)?`<section><span class="eyebrow">Conteúdo${x.updatedAt?' · '+fmtDay(String(x.updatedAt).slice(0,10)):''}</span>${x.topics?`<p><b>Sobre o que falam:</b> ${esc(x.topics)}</p>`:''}${x.formats?`<p><b>Formatos e frequência:</b> ${esc(x.formats)}</p>`:''}${x.whatWorks?`<p><b>O que tem funcionado:</b> ${esc(x.whatWorks)}</p>`:''}</section>`:'';
    const aberto=!!(state.compOpen&&state.compOpen[c.id]);
    return `<article class="card comp min">
      <div class="comp-head"><h3>${esc(c.name)}</h3>${exTag(c)}</div>
      ${audiencia}
      ${c.positioning?`<p class="cpos clamp2">${esc(c.positioning)}</p>`:''}
      <p class="cres clamp2">${c.autoSummary?esc(c.autoSummary):(pending?'Pesquisa em andamento.':'Ainda sem pesquisa.')}</p>
      <details class="cmore" data-id="${esc(c.id)}"${aberto?' open':''}><summary><span class="vm">Ver mais</span><span class="vl">Ver menos</span></summary>
        <div class="cmore-body">
          ${conteudo}
          <section><span class="eyebrow">Canais</span>${rows.length?`<ul class="chlist">${rows.join('')}</ul>`:`<p class="muted small">Nenhum canal ainda. ${pending?'A pesquisa vai encontrar os perfis oficiais.':'Toque em "Pesquisar agora" ou adicione em Editar.'}</p>`}</section>
          <section class="two"><div><span class="eyebrow">Pontos fortes</span><p>${c.strengths?esc(c.strengths):'<span class="muted">a preencher</span>'}</p></div><div><span class="eyebrow">Brechas</span><p>${c.weaknesses?esc(c.weaknesses):'<span class="muted">a preencher</span>'}</p></div></section>
          ${c.frequency||c.notes?`<section>${c.frequency?`<p><b>Frequência:</b> ${esc(c.frequency)}</p>`:''}${c.notes?`<p>${esc(c.notes)}</p>`:''}</section>`:''}
          <div class="meta">${compStatus(c)}${auDate?`<span class="muted small">Seguidores lidos em ${fmtDay(auDate.slice(0,10))}</span>`:''}</div>
        </div>
      </details>
      <div class="foot">${aiBtn('Comparar','ai-comp-one',`data-id="${esc(c.id)}" title="Comparar com a marca"`,'sm')}${btn(pending?'Pesquisar de novo':'Pesquisar','comp-research',`data-id="${esc(c.id)}"`,'sm ghost')}${nCount?`<button class="btn sm ghost" data-act="comp-news" data-v="${esc(c.id)}">${nCount} ${nCount>1?'conteúdos e notícias':'item'} ↓</button>`:''}${btn('Editar','edit',`data-col="competitors" data-id="${esc(c.id)}"`,'sm ghost')}</div>
    </article>`;
  }).join('')+'</div>';

  /* ---- news & content below ---- */
  const byComp=allNews.filter(n=>(!state.f.compFilter||n.competitorId===state.f.compFilter));
  const byKind=byComp.filter(n=>!state.f.compKind||kindOf(n)===state.f.compKind);
  const news=byKind.filter(n=>inPeriod(n,state.f.compPeriod));
  h+=`<div class="sec-row" id="compNews"><h3 class="dsec">Conteúdos e notícias dos concorrentes <span>${news.length}</span></h3>${btn('+ Adicionar','new','data-col="compnews"','sm ghost')}</div>
  <div class="toolbar">${chips('compKind',CC_KINDS.map(([v,l])=>[v,`${l} <span class="cnt">${byComp.filter(n=>inPeriod(n,state.f.compPeriod)&&(!v||kindOf(n)===v)).length}</span>`]),state.f.compKind)}</div>
  <div class="toolbar"><span class="eyebrow">Período</span>${chips('compPeriod',CC_PERIODS.map(([v,l])=>[v,`${l} <span class="cnt">${byKind.filter(n=>inPeriod(n,v)).length}</span>`]),state.f.compPeriod)}</div>
  <div class="toolbar">${chips('compFilter',[['','Todos'],...list.map(c=>[c.id,esc(c.name)])],state.f.compFilter)}</div>`;
  if(!news.length)h+=`<p class="muted">Nada nesse filtro. De segunda a sexta, a rotina da manhã acompanha o que cada concorrente publica e o que sai sobre ele.</p>`;
  else h+='<div class="stack">'+news.map(n=>{const u=safeUrl(n.url), isC=kindOf(n)==='conteudo';
    return `<article class="row${isC?' crow':''}">${validAsset(n.media)?`<div class="thumb">${u?`<a href="${esc(u)}" target="_blank" rel="noopener" tabindex="-1">`:''}${mediaTag(n.media,n.mediaType)}${u?'</a>':''}</div>`:''}<div class="row-main">
      <div class="meta"><span class="cname">${esc(names[n.competitorId]||n.competitorName||'Concorrente')}</span>${isC?`<span class="kind">Conteúdo</span>${n.channel?chCode(n.channel):''}${n.format?`<span>${esc(n.format)}</span>`:''}`:`<span class="kind news">Notícia</span>${n.source?`<span class="src">${esc(n.source)}</span>`:''}`}${n.date?`<span>${fmtDay(n.date)}</span>`:''}${n.tag?`<span class="tagpill">${esc(n.tag)}</span>`:''}${exTag(n)}</div>
      <h3>${u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n.title)}</a>`:esc(n.title)}</h3>
      ${n.signal?`<div class="signal">▲ ${esc(n.signal)}</div>`:''}
      ${n.summary?`<p>${esc(n.summary)}</p>`:''}
    </div><div class="row-actions">${isC?aiBtn('Adaptar para a marca','ai-compcontent-adapt',`data-id="${esc(n.id)}"`,'sm'):aiBtn('Como responder','ai-compnews-one',`data-id="${esc(n.id)}"`,'sm')}${btn('Editar','edit',`data-col="compnews" data-id="${esc(n.id)}"`,'sm ghost')}</div></article>`}).join('')+'</div>';
  return h;
}
async function requestResearch(c){
  const b=curBrand();if(!b||!c)return;
  try{await Store.update(bpath('competitors'),c.id,{research:{status:'pedido',requestedAt:new Date().toISOString()}})}catch(_){return}
  const later='Pedido registrado. A pesquisa acontece na próxima rotina da manhã (segunda a sexta).';
  if(!mcp){toast(later,5000);return}
  try{
    await mcp.callTool('Claude Code Remote','fire_trigger',{trigger_id:TRIGGER_ID,
      text:`PEDIDO AVULSO: faça apenas a etapa de concorrentes (notícias e revisão dos canais) para o concorrente "${c.name}" (id ${c.id}) da marca "${b.name}" (id ${b.id}). Não pesquise as notícias gerais das marcas nesta execução.`},{cache:false});
    toast('Pesquisa iniciada. A revisão dos canais e as notícias aparecem aqui em alguns minutos.',5000);
  }catch(e){
    const msg={
      server_not_connected:'Não encontrei a conexão com as tarefas agendadas do Claude. '+later,
      needs_reauth:'A conexão com as tarefas agendadas do Claude precisa ser refeita em Configurações, Conectores. '+later,
      not_in_manifest:'O disparo imediato não foi liberado nesta página. '+later,
      blocked_by_policy:'A sua organização bloqueou o disparo imediato. '+later,
      tool_error:'Não consegui iniciar a pesquisa agora. '+later
    }[e&&e.code];
    toast(msg||later,6000);
  }
}

const igBtn=()=>btn('Atualizar Instagram','comp-import','title="Busca Reels novos dos concorrentes e da marca pelo vidIQ, gastando só os créditos liberados para manter o saldo até a renovação."');
/* situação da atualização do Instagram (documento importador/vidiq, gravado pela rotina) */
function igStatus(){
  const v=state.vidiq, pl=v&&v.ultimoPlano, req=LS.get('cl.igReq',null);
  const dd=s=>{const d=parseISO(String(s||'').slice(0,10));return d?pad(d.getDate())+'/'+pad(d.getMonth()+1):''};
  if(req&&(!pl||!pl.em||String(pl.em)<req)&&(Date.now()-new Date(req).getTime())<30*6e4)
    return `<div class="igstat"><span class="rstat pending"><span class="pulse"></span>Atualização pedida. O Claude confere os créditos e busca só o que vale a pena; o resultado aparece aqui em alguns minutos.</span></div>`;
  if(!pl)return `<div class="igstat muted">Instagram ainda não atualizado por aqui. Toque em "Atualizar Instagram".</div>`;
  const parts=[`<b>Instagram atualizado em ${dd(v.atualizadoEm||pl.hoje)}</b>`];
  if(pl.saldoDepois!=null)parts.push(`${NF.format(pl.saldoDepois)} créditos do vidIQ até ${dd(pl.renova)}`);
  if(pl.proximaEm)parts.push(`próxima atualização útil em ${dd(pl.proximaEm)}`);
  return `<div class="igstat">${parts.join(' · ')}${pl.motivo&&pl.custo===0&&pl.hoje!==v.atualizadoEm?`<span class="muted"> · Último clique (${dd(pl.hoje)}): ${esc(pl.motivo)}</span>`:''}</div>`;
}
async function requestImport(){
  const b=curBrand();if(!b)return;
  const later='Tente de novo em instantes.';
  if(!mcp){toast(later,5000);return}
  try{
    await mcp.callTool('Claude Code Remote','fire_trigger',{trigger_id:IMPORT_TRIGGER_ID,
      text:`PEDIDO: a Carla clicou em "Atualizar Instagram" na marca "${b.name}" (id ${b.id}). Siga o ROTINA.md; o comando planejar decide quanto pode gastar.`},{cache:false});
    LS.set('cl.igReq',new Date().toISOString());renderMain(true);
    toast('Atualização pedida. Os posts novos aparecem aqui em alguns minutos.',5000);
  }catch(e){toast(e&&e.code==='needs_reauth'?'A conexão com as rotinas do Claude precisa ser refeita em Configurações, Conectores.':'Não consegui pedir a atualização agora. '+later,6000)}
}

/* ================= editor modal ================= */
const SCHEMA={
 news:{name:'notícia',fields:[
  {k:'title',l:'Título',t:'text',req:1,full:1},{k:'url',l:'Link',t:'url',full:1,ph:'https://'},
  {k:'source',l:'Fonte',t:'text'},{k:'date',l:'Data da matéria',t:'date'},
  {k:'tag',l:'Tema',t:'text',ph:'Ex.: Dividendos'},{k:'summary',l:'Resumo e por que importa',t:'textarea',full:1,rows:3}]},
 refs:{name:'referência',fields:[
  {k:'media',l:'Prévia do post',t:'media',full:1},{k:'mediaType',t:'hidden'},
  {k:'platform',l:'Plataforma',t:'select',o:ENX?Object.entries(PLAT).map(([k,v])=>[k,v[1]]):[['instagram','Instagram']]},
  {k:'format',l:'Formato',t:'list',o:['Reels','Carrossel','Post estático','Stories','Vídeo','Live']},
  {k:'url',l:'Link do post',t:'url',full:1,ph:'https://'},{k:'creator',l:'Perfil',t:'text',ph:'@perfil'},
  ...(ENX?[{k:'postedAt',l:'Data da postagem',t:'date',req:1}]:[]),
  {k:'views',l:'Resultado',t:'text',ph:'Ex.: 1,2 mi de views'},
  {k:'hook',l:'Gancho (primeira frase ou tela)',t:'textarea',full:1,rows:2},
  {k:'why',l:'Por que funcionou',t:'textarea',full:1,rows:3},{k:'fit',l:'Como a marca entra',t:'textarea',full:1,rows:3,ph:'Fit com a marca e como adaptar'},{k:'tags',l:'Etiquetas',t:'text',full:1,ph:'Separe por vírgula'}]},
 posts:{name:'post',fields:[
  {k:'title',l:'Título ou tema',t:'text',req:1,full:1},{k:'date',l:'Data',t:'date',req:1},{k:'time',l:'Horário',t:'time'},
  {k:'channel',l:'Canal',t:'channel'},{k:'format',l:'Formato',t:'list',o:FORMATS},
  {k:'status',l:'Status',t:'select',o:STATUS.map(s=>[s.id,s.label])},{k:'pillar',l:'Pilar',t:'pillar'},
  {k:'caption',l:'Texto, legenda ou roteiro',t:'textarea',full:1,rows:8,ai:1},
  {k:'link',l:'Link do conteúdo publicado',t:'url',full:1,ph:'https://'},{k:'notes',l:'Observações',t:'textarea',full:1,rows:2}]},
 dates:{name:'data',fields:[
  {k:'title',l:'Nome da data',t:'text',req:1,full:1,ph:'Ex.: Aniversário da marca, Black Friday'},
  {k:'date',l:'Data',t:'date',req:1},{k:'type',l:'Tipo',t:'select',o:DTYPES.map(x=>[x,x])},
  {k:'recurring',l:'Repete todo ano',t:'check'},{k:'lead',l:'Começar a preparar com quantos dias de antecedência',t:'number'},
  {k:'notes',l:'Notas',t:'textarea',full:1,rows:3,ph:'O que fazer, campanhas passadas, cuidados'}]},
 ideas:{name:'ideia',fields:[
  {k:'title',l:'Ideia',t:'text',req:1,full:1},{k:'pillar',l:'Pilar',t:'pillar'},{k:'format',l:'Formato',t:'list',o:FORMATS},
  {k:'channels',l:'Canais',t:'multi',full:1},
  {k:'status',l:'Status',t:'select',o:ISTATUS},{k:'source',l:'Origem',t:'text',ph:'Ex.: notícia, referência'},
  {k:'notes',l:'Ângulo e notas',t:'textarea',full:1,rows:4}]},
 metrics:{name:'registro de métricas',fields:[
  {k:'_note',t:'note',l:'Pode ser um dia (mesma data em De e Até), uma semana ou um mês. Alcance, cliques e posts são o total do período; seguidores é o número no último dia.'},
  {k:'channel',l:'Canal',t:'channel',full:1},{k:'start',l:'De',t:'date',req:1},{k:'end',l:'Até',t:'date',req:1},
  {k:'followers',l:'Seguidores no último dia',t:'number'},{k:'reach',l:'Alcance ou visualizações',t:'number'},
  {k:'engagement',l:'Taxa de engajamento média (%)',t:'number',step:'0.1'},{k:'clicks',l:'Cliques ou visitas',t:'number'},
  {k:'posts',l:'Publicações no período',t:'number'},{k:'notes',l:'Observações',t:'textarea',full:1,rows:2}]},
 competitors:{name:'concorrente',fields:[
  {k:'name',l:'Nome',t:'text',req:1},{k:'site',l:'Site',t:'url',ph:'https://'},
  {k:'instagram',l:'Instagram',t:'text',ph:'@perfil'},{k:'linkedin',l:'LinkedIn',t:'text',ph:'linkedin.com/company/...'},{k:'youtube',l:'YouTube',t:'text',ph:'Link ou @canal'},
  {k:'tiktok',l:'TikTok',t:'text',ph:'@perfil'},{k:'blog',l:'Blog',t:'url',ph:'https://'},
  {k:'frequency',l:'Frequência de postagem',t:'text',ph:'Ex.: 5 posts por semana'},
  {k:'positioning',l:'Posicionamento',t:'textarea',full:1,rows:2},
  {k:'strengths',l:'Pontos fortes',t:'textarea',rows:3},{k:'weaknesses',l:'Brechas',t:'textarea',rows:3},
  {k:'lastCheck',l:'Última análise',t:'date'},{k:'notes',l:'Anotações',t:'textarea',full:1,rows:2}]},
 compnews:{name:'item de concorrente',fields:[
  {k:'competitorId',l:'Concorrente',t:'comp'},{k:'kind',l:'Tipo',t:'select',o:[['conteudo','Conteúdo publicado'],['noticia','Notícia sobre a empresa']]},
  {k:'title',l:'Título, gancho ou manchete',t:'text',req:1,full:1},{k:'url',l:'Link',t:'url',full:1,ph:'https://'},
  {k:'channel',l:'Canal (para conteúdo)',t:'select',o:[['','Não se aplica'],...AUTO_CH]},{k:'format',l:'Formato',t:'list',o:FORMATS},
  {k:'source',l:'Fonte (para notícia)',t:'text'},{k:'date',l:'Data',t:'date'},
  {k:'signal',l:'Resultado visível',t:'text',ph:'Ex.: 12 mil views, muitos comentários'},{k:'tag',l:'Tema',t:'text',ph:'Ex.: IR, Lançamento'},
  {k:'summary',l:'O que disseram e por que chamou atenção',t:'textarea',full:1,rows:3}]},
 __brand:{name:'marca',fields:[{k:'name',l:'Nome da marca',t:'text',req:1,full:1},{k:'niche',l:'Nicho',t:'text',full:1,ph:'Ex.: moda sustentável, fintech, gastronomia'}]}
};
let modalCtx=null;
function fieldHtml(f,v){
  const id='f-'+f.k, full=f.full?' full':'';
  if(f.t==='multi'){
    const cur=Array.isArray(v)?v:[];
    return `<fieldset class="field${full}"><legend>${f.l}</legend><div class="checks">${CH.map(c=>`<label><input type="checkbox" name="${id}" value="${c.id}"${cur.includes(c.id)?' checked':''}> ${c.label}</label>`).join('')}</div></fieldset>`;
  }
  if(f.t==='hidden')return `<input type="hidden" id="${id}" value="${esc(v==null?'':v)}">`;
  if(f.t==='media')return `<div class="field full"><span class="flabel">${f.l}</span>
    <div class="media-box" id="mediaBox">${validAsset(v)?mediaTag(v,(modalCtx&&modalCtx.item&&modalCtx.item.mediaType)||''):MEDIA_EMPTY}</div>
    <div class="ai-row"><label class="btn sm" for="f-mediafile">Enviar print ou vídeo</label><input type="file" id="f-mediafile" accept="${MEDIA_ACCEPT}" hidden>
    ${btn('Remover prévia','media-remove','','sm ghost')}${aiBtn('Preencher com o Claude','ai-ref-fill','','sm')}</div>
    <span class="hint">No computador, você também pode colar um print (Ctrl+V). O Claude lê o print ou um quadro do vídeo e preenche formato, gancho, resultado e por que funcionou.</span>
    <input type="hidden" id="${id}" value="${esc(v==null?'':v)}"></div>`;
  if(f.t==='note')return `<p class="field full hint" style="font-size:13px;color:var(--ink-2);background:var(--surface-2);padding:9px 11px;border-radius:var(--r-sm)">${esc(f.l)}</p>`;
  if(f.t==='check')return `<div class="field${full}" style="justify-content:flex-end"><label class="chtoggle" style="font-size:14px;color:var(--ink)"><input type="checkbox" id="${id}"${v?' checked':''} style="accent-color:var(--accent);width:18px;height:18px"> ${f.l}</label></div>`;
  let inp;
  const val=v==null?'':v;
  if(f.t==='textarea')inp=`<textarea id="${id}" rows="${f.rows||3}" placeholder="${esc(f.ph||'')}">${esc(val)}</textarea>`;
  else if(f.t==='select'||f.t==='channel'||f.t==='pillar'||f.t==='comp'){
    let o=f.t==='channel'?activeCh().map(c=>[c.id,c.label]):f.t==='pillar'?[['','Sem pilar'],...pillars().map(p=>[p,p])]:f.t==='comp'?state.data.competitors.map(c=>[c.id,c.name||'Sem nome']):f.o;
    if(val&&!o.some(x=>x[0]===val))o=o.concat([[val,val]]);
    inp=`<select class="in" id="${id}">${o.map(([a,b])=>`<option value="${esc(a)}"${a===val?' selected':''}>${esc(b)}</option>`).join('')}</select>`;
  }
  /* formato: lista suspensa com todas as opções (o datalist escondia as outras quando o campo já vinha preenchido) */
  else if(f.t==='list'){const o=val&&!f.o.includes(val)?[val,...f.o]:f.o;
    inp=`<select class="in" id="${id}"><option value="">Escolha</option>${o.map(x=>`<option value="${esc(x)}"${x===val?' selected':''}>${esc(x)}</option>`).join('')}</select>`}
  else inp=`<input type="${f.t}" id="${id}" value="${esc(val)}" placeholder="${esc(f.ph||'')}"${f.step?` step="${f.step}"`:''}${f.t==='number'?' inputmode="decimal"':''}>`;
  const ai=f.ai?`<div class="ai-row">${aiBtn('Rascunhar texto','ai-caption','id="aiCapBtn"','sm')}${aiBtn('Sugerir ganchos','ai-hooks','','sm')}</div>`:'';
  return `<div class="field${full}"><label for="${id}">${f.l}</label>${inp}${ai}</div>`;
}
function openEditor(col,item,preset,extra){
  const sc=SCHEMA[col];modalCtx={col,item,extra};
  const v=Object.assign({},preset||{},item||{});
  if(col==='metrics'&&item&&!item.start){const sp=recSpan(item);if(sp){v.start=iso(sp.s);v.end=iso(sp.e)}}
  const isNew=!item;
  const dlg=$('#modal .dialog');
  dlg.innerHTML=`<div class="dlg-head"><h2 id="dlgTitle">${isNew?(['post','registro de métricas','concorrente','item de concorrente'].includes(sc.name)?'Novo ':'Nova ')+sc.name:'Editar '+sc.name}</h2>${item&&item.exemplo?exTag(item):''}<button class="iconbtn" data-act="modal-close" aria-label="Fechar">×</button></div>
    <form class="dlg-body" id="editForm" autocomplete="off">${sc.fields.map(f=>fieldHtml(f,v[f.k])).join('')}<p class="err full" id="formErr" hidden style="grid-column:1/-1"></p></form>
    <div class="dlg-foot">${item?btn('Excluir','del-item','','danger'):''}<span class="spacer"></span>${btn('Cancelar','modal-close','','ghost')}${btn(isNew?'Adicionar':'Salvar','save-item','','primary')}</div>`;
  dlg.setAttribute('aria-labelledby','dlgTitle');
  $('#modal').hidden=false;
  setTimeout(()=>{const first=dlg.querySelector('input,textarea,select');if(first&&window.matchMedia('(min-width:700px)').matches)first.focus()},30);
}
function closeModal(){capCtl&&capCtl.abort();$('#modal').hidden=true;
  const ctx=modalCtx;modalCtx=null;
  if(ctx&&ctx.uploaded&&assets)ctx.uploaded.filter(id=>!(ctx.saved&&id===ctx.keep)).forEach(id=>assets.delete(id).catch(()=>{}));
}
function collect(sc){
  const out={};
  sc.fields.forEach(f=>{
    const id='f-'+f.k;
    if(f.t==='multi'){out[f.k]=[...document.querySelectorAll(`input[name="${id}"]:checked`)].map(i=>i.value);return}
    const el=document.getElementById(id);if(!el)return;
    if(f.t==='check'){out[f.k]=el.checked;return}
    const raw=el.value.trim();
    if(f.t==='number')out[f.k]=raw===''?null:Number(raw.replace(',','.'));
    else out[f.k]=raw;
  });
  return out;
}
async function saveItem(){
  const {col,item,extra}=modalCtx, sc=SCHEMA[col], vals=collect(sc);
  const miss=sc.fields.filter(f=>f.req&&!vals[f.k]&&!(col==='refs'&&f.k==='postedAt'&&item&&item.origem==='claude')).map(f=>f.l);
  const err=$('#formErr');
  if(miss.length){err.textContent='Preencha: '+miss.join(', ')+'.';err.hidden=false;return}
  if(col==='metrics'&&vals.start>vals.end){const t=vals.start;vals.start=vals.end;vals.end=t}
  if(col==='metrics'&&Object.entries(vals).some(([k,v])=>typeof v==='number'&&isNaN(v))){err.textContent='Use apenas números nos campos de métricas.';err.hidden=false;return}
  try{
    if(col==='__brand'){await createBrand(vals);closeModal();return}
    if(col==='compnews'){const c=state.data.competitors.find(x=>x.id===vals.competitorId);vals.competitorName=c?c.name:''}
    if(col==='refs'&&vals.creator&&perfisFora().has(perfilKey(vals.creator))){err.textContent='Esse perfil é da própria marca ou de um concorrente. Referências são de outros perfis do mercado; o concorrente é acompanhado na aba Concorrentes.';err.hidden=false;return}
    if(col==='refs'){if(!validAsset(vals.media)){vals.media='';vals.mediaType=''}modalCtx.keep=vals.media}
    if(item){await Store.set(bpath(col),item.id,Object.assign(strip(item),vals,{updatedAt:new Date().toISOString()}));toast('Alterações salvas');
      if(col==='refs'&&assets&&validAsset(item.media)&&item.media!==vals.media)assets.delete(item.media).catch(()=>{})}
    else if(col==='competitors'){const nid=await Store.add(bpath(col),vals);closeModal();requestResearch(Object.assign({id:nid},vals));return}
    else{await Store.add(bpath(col),vals);toast(sc.name.charAt(0).toUpperCase()+sc.name.slice(1)+' adicionad'+(['post','registro de métricas','concorrente','item de concorrente'].includes(sc.name)?'o':'a'))}
    if(extra&&extra.ideaId)await Store.update(bpath('ideas'),extra.ideaId,{status:'em-uso'});
    modalCtx.saved=true;closeModal();
  }catch(e){}
}
async function createBrand(vals){
  const id=await Store.add('brands',{name:vals.name,niche:vals.niche||'',color:'#D0106E',description:'',audience:'',tone:'',pillars:[],avoid:'Travessão (—) nos textos.',hashtags:'',briefing:'',sources:'',
    channels:Object.fromEntries(CH.map(c=>[c.id,{on:true,handle:''}]))});
  state.tab='marca';LS.set('cl.tab','marca');
  setBrand(id);toast('Marca criada. Complete as configurações.');
}

/* ================= Claude ================= */
const RULES='Escreva em português do Brasil. Nunca use travessão (—) nem meia-risca (–) como pontuação; use vírgula, dois-pontos, ponto ou parênteses. Seja específico para esta marca e evite ideias genéricas. Não invente números, estatísticas, leis ou recursos de produto; quando um fato precisar de checagem, marque com [confirmar].';
function brandCtx(){
  const b=curBrand()||{};
  return `CONTEXTO DA MARCA
Marca: ${b.name||''}
Nicho: ${b.niche||''}
O que faz: ${b.description||''}
Público: ${b.audience||''}
Tom de voz: ${b.tone||''}
Pilares: ${pillars().join('; ')||'não definidos'}
Canais ativos: ${activeCh().map(c=>c.label).join(', ')}
Evitar: ${b.avoid||''}
Hashtags: ${b.hashtags||''}
Instruções da equipe: ${b.briefing||''}`;
}
const IDEA_SHAPE='Responda apenas com um array JSON no formato [{"title":"título da ideia","pillar":"um dos pilares, escrito exatamente como na lista","channels":["instagram"],"format":"Carrossel","notes":"ângulo e gancho em 1 ou 2 frases"}]. Valores válidos em channels: site, blog, instagram, linkedin, youtube.';
function normIdea(src){return x=>{
  if(!x||!x.title)return null;
  const ch=(Array.isArray(x.channels)?x.channels:[x.channels]).map(s=>String(s||'').toLowerCase()).filter(s=>CHM[s]);
  return {title:clean(x.title),pillar:String(x.pillar||''),channels:ch,format:String(x.format||''),notes:clean(x.notes||''),status:'nova',source:src||'Sugestão do Claude'};
}}
const ideaCard=i=>`<div class="meta">${i.channels.map(code).join('')}${i.format?`<span>${esc(i.format)}</span>`:''}${i.pillar?`<span class="tagpill">${esc(i.pillar)}</span>`:''}</div><h4>${esc(i.title)}</h4>${i.notes?`<p>${esc(i.notes)}</p>`:''}`;
const addIdea=i=>Store.add(bpath('ideas'),i);

let aiCtl=null, aiItems=[], aiLast=null, aiText='';
function openSheet(title,sub){
  $('#sheetTitle').innerHTML=SPARK+esc(title);
  $('#sheetSub').textContent=sub||'';$('#sheetSub').hidden=!sub;
  $('#sheet').hidden=false;
}
function closeSheet(){aiCtl&&aiCtl.abort();$('#sheet').hidden=true}
function aiErrMsg(e){
  const c=e&&e.code;
  if(['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(c))return 'As sugestões do Claude não estão liberadas nesta visualização. Abra a central no Claude e permita o uso quando for solicitado.';
  if(c==='rate_limited')return 'Muitos pedidos seguidos ou limite de uso atingido. Espere um pouco e tente de novo.';
  if(c==='session_expired')return 'Sua sessão expirou. Entre de novo no Claude e tente outra vez.';
  if(c==='prompt_too_large')return 'Há dados demais para enviar de uma vez. Filtre ou apague itens antigos e tente de novo.';
  if(c==='invalid_json')return 'A resposta veio num formato inesperado. Tente gerar de novo.';
  if(c==='refused')return 'O Claude não respondeu a este pedido. Ajuste o conteúdo e tente de novo.';
  return 'Não foi possível gerar agora. Tente de novo em instantes.';
}
async function ask(o){
  aiLast=o;
  openSheet(o.title,o.sub);
  const body=$('#sheetBody'), foot=$('#sheetFoot');
  if(!sample){body.innerHTML='<p class="muted">As sugestões do Claude funcionam quando a central é aberta no app ou no site do Claude. Nesta visualização elas não estão disponíveis.</p>';foot.innerHTML=btn('Fechar','sheet-close');return}
  if(aiCtl)aiCtl.abort();
  const ctl=aiCtl=new AbortController();
  body.innerHTML='<div class="thinking"><span class="pulse"></span><span id="thinkTxt">Pensando...</span></div>';
  foot.innerHTML=btn('Parar','ai-stop');
  const prompt=RULES+'\n\n'+brandCtx()+'\n\n'+o.prompt;
  try{
    if(o.kind==='json'){
      let r=await sample.json(prompt,{signal:ctl.signal,cache:false,onText:()=>{const t=$('#thinkTxt');if(t)t.textContent='Escrevendo sugestões...'}});
      if(ctl!==aiCtl)return;
      if(!Array.isArray(r))r=(r&&(r.items||r.ideas||r.posts))||[];
      aiItems=r.map(o.norm).filter(Boolean);
      if(!aiItems.length){body.innerHTML='<p class="muted">Nenhuma sugestão veio no formato esperado. Tente gerar de novo.</p>';foot.innerHTML=btn('Gerar de novo','ai-again','','primary');return}
      body.innerHTML=aiItems.map((it,i)=>`<div class="sug">${o.card(it)}<button class="btn sm" data-act="ai-add" data-i="${i}">${esc(o.addLabel)}</button></div>`).join('');
      foot.innerHTML=btn('Gerar outras','ai-again','','ghost')+'<span class="spacer"></span>'+btn('Adicionar todas','ai-add-all','','primary');
    }else{
      body.innerHTML='<div class="thinking"><span class="pulse"></span>Pensando...</div><div class="ai-text" id="aiOut"></div>';
      const r=await sample(prompt,{signal:ctl.signal,cache:false,onText:({text})=>{const th=body.querySelector('.thinking');if(th)th.remove();aiText=clean(text);$('#aiOut').textContent=aiText}});
      if(ctl!==aiCtl)return;
      aiText=clean(r.text);$('#aiOut').textContent=aiText;
      foot.innerHTML=btn('Gerar de novo','ai-again','','ghost')+'<span class="spacer"></span>'+btn('Copiar texto','ai-copy','','primary');
      if(r.truncated)body.insertAdjacentHTML('beforeend','<p class="muted">A resposta foi cortada por tamanho. Peça algo mais específico.</p>');
    }
  }catch(e){
    if(ctl!==aiCtl&&e.code==='cancelled')return;
    const kept=e.text?`<div class="ai-text">${esc(clean(e.text))}</div>`:'';
    if(e.code==='cancelled'){body.innerHTML=kept||'<p class="muted">Geração interrompida.</p>';foot.innerHTML=btn('Gerar de novo','ai-again','','primary');return}
    body.innerHTML=kept+`<p class="err">${esc(aiErrMsg(e))}</p>`;
    foot.innerHTML=btn('Tentar de novo','ai-again','','primary');
  }
}
const lines=(arr,f,max)=>arr.slice(0,max).map(f).join('\n');

const AI={
  'ai-news-all'(){
    const news=newsFiltered();
    if(!news.length)return toast(state.data.news.length?'Não há notícias no filtro atual.':'Salve algumas notícias primeiro.');
    ask({title:'Pautas a partir das notícias',sub:'Ideias baseadas nas notícias salvas. Revise os fatos antes de publicar.',kind:'json',addLabel:'Salvar no mapa de ideias',card:ideaCard,onAdd:addIdea,norm:normIdea('Notícias do nicho'),
      prompt:`NOTÍCIAS SALVAS\n${lines(news,n=>`- ${n.title}${n.source?' ('+n.source+')':''}${n.summary?': '+n.summary:''}`,20)}\n\nTAREFA: transforme essas notícias em 6 pautas de conteúdo para a marca, com ângulos úteis para o público (não apenas repetir a notícia). Distribua entre canais e pilares.\n${IDEA_SHAPE}`});
  },
  'ai-news-one'(id){
    const n=state.data.news.find(x=>x.id===id);if(!n)return;
    ask({title:'Virar pauta',sub:n.title,kind:'json',addLabel:'Salvar no mapa de ideias',card:ideaCard,onAdd:addIdea,norm:normIdea('Notícia: '+n.title),
      prompt:`NOTÍCIA\nTítulo: ${n.title}\nFonte: ${n.source||''}\nResumo: ${n.summary||''}\n\nTAREFA: proponha 3 pautas diferentes a partir desta notícia (por exemplo: explicativa, prática e opinativa), cada uma no canal em que funciona melhor.\n${IDEA_SHAPE}`});
  },
  'ai-refs-all'(){
    const refs=ENX?refsMercado():state.data.refs;if(!refs.length)return toast(ENX?'Não há referências dos últimos 30 dias.':'Salve algumas referências primeiro.');
    ask({title:'Padrões das referências',kind:'text',prompt:`REFERÊNCIAS VIRAIS SALVAS\n${lines(refs,r=>`- [${r.platform}/${r.format||''}] ${r.creator||''} | gancho: "${r.hook||''}" | por que funcionou: ${r.why||''} | resultado: ${r.views||''}`,25)}\n\nTAREFA: identifique os padrões que se repetem (tipo de gancho, formato, ritmo, pedido de ação, tema) e explique como a marca pode aplicar cada padrão. Termine com 5 ganchos prontos para a marca. Use tópicos curtos.`});
  },
  'ai-ref-one'(id){
    const r=state.data.refs.find(x=>x.id===id);if(!r)return;
    ask({title:'Adaptar referência',sub:r.hook||r.creator,kind:'json',addLabel:'Salvar no mapa de ideias',card:ideaCard,onAdd:addIdea,norm:normIdea('Referência: '+(r.creator||r.platform)),
      prompt:`REFERÊNCIA\nPlataforma: ${r.platform}\nFormato: ${r.format||''}\nGancho: ${r.hook||''}\nPor que funcionou: ${r.why||''}${r.fit?'\nComo a marca entra: '+r.fit:''}\n\nTAREFA: crie 3 adaptações desta referência para a marca, mantendo a mecânica que fez o post funcionar mas com tema e linguagem próprios. Nas notas, escreva o gancho de abertura.\n${IDEA_SHAPE}`});
  },
  'ai-week'(){
    const {y,m}=state.cal, t=new Date();
    const startD=(t.getFullYear()===y&&t.getMonth()===m)?t:new Date(y,m,1);
    const start=iso(startD), end=iso(new Date(startD.getFullYear(),startD.getMonth(),startD.getDate()+6));
    const booked=state.data.posts.filter(p=>p.date>=start&&p.date<=end);
    const ideas=state.data.ideas.filter(i=>!['usada','arquivada'].includes(i.status));
    ask({title:'Plano da semana',sub:`De ${fmtDay(start)} a ${fmtDay(end)}`,kind:'json',addLabel:'Adicionar ao calendário',
      card:p=>`<div class="meta">${code(p.channel)}<span>${fmtDay(p.date)}${p.time?' · '+esc(p.time):''}</span>${p.format?`<span>${esc(p.format)}</span>`:''}${p.pillar?`<span class="tagpill">${esc(p.pillar)}</span>`:''}</div><h4>${esc(p.title)}</h4>${p.caption?`<p class="clamp">${esc(p.caption)}</p>`:''}${p.why?`<p class="muted">${esc(p.why)}</p>`:''}`,
      onAdd:p=>{const x=Object.assign({},p);delete x.why;return Store.add(bpath('posts'),x)},
      norm:x=>{if(!x||!x.title)return null;const d=/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&x.date>=start&&x.date<=end?x.date:start;const ch=CHM[String(x.channel||'').toLowerCase()]?String(x.channel).toLowerCase():activeCh()[0].id;
        return {title:clean(x.title),date:d,time:/^\d{2}:\d{2}$/.test(x.time||'')?x.time:'',channel:ch,format:String(x.format||''),pillar:String(x.pillar||''),caption:clean(x.caption||''),status:'ideia',why:clean(x.why||'')}},
      prompt:`PERÍODO: de ${start} a ${end} (hoje é ${TODAY()}).\nPOSTS JÁ AGENDADOS NO PERÍODO\n${lines(booked,p=>`- ${p.date} ${p.channel}: ${p.title}`,30)||'nenhum'}\n\nIDEIAS DISPONÍVEIS NO MAPA\n${lines(ideas,i=>`- ${i.title} (${i.pillar||'sem pilar'})`,30)||'nenhuma'}\n\nDATAS IMPORTANTES PRÓXIMAS\n${lines(upcoming().filter(o=>!o.past&&o.days<=45),o=>`- ${o.key}: ${o.d.title}`,15)||'nenhuma'}\n\nNOTÍCIAS RECENTES\n${lines(state.data.news,n=>`- ${n.title}`,8)||'nenhuma'}\n\nTAREFA: monte um plano de 6 posts para completar a semana, equilibrando canais ativos e pilares, sem repetir o que já está agendado. Aproveite as ideias do mapa quando fizer sentido.\nResponda apenas com um array JSON: [{"date":"AAAA-MM-DD","time":"HH:MM","channel":"instagram","format":"Carrossel","title":"...","pillar":"pilar exato da lista","caption":"rascunho curto do texto ou roteiro (até 60 palavras)","why":"por que este post nesta data, 1 frase"}]. Valores válidos em channel: ${activeCh().map(c=>c.id).join(', ')}.`});
  },
  'ai-dates'(){
    const ex=state.data.dates.map(d=>`- ${d.title} (${d.date})`);
    const t=TODAY(), end=iso(new Date(new Date().getFullYear()+1,new Date().getMonth(),new Date().getDate()));
    ask({title:'Datas do nicho',sub:'Confira cada data antes de planejar.',kind:'json',addLabel:'Salvar data',
      card:d=>`<div class="meta"><span class="tagpill">${esc(d.type)}</span><span>${fmtDay(d.date)} ${d.date.slice(0,4)}</span>${d.recurring?'<span>todo ano</span>':''}</div><h4>${esc(d.title)}</h4>${d.notes?`<p>${esc(d.notes)}</p>`:''}`,
      onAdd:d=>Store.add(bpath('dates'),d),
      norm:x=>{if(!x||!x.title||!/^\d{4}-\d{2}-\d{2}$/.test(x.date||''))return null;return {title:clean(x.title),date:x.date,recurring:!!x.recurring,type:DTYPES.includes(x.type)?x.type:'Data comemorativa',lead:Number(x.lead)>0?Math.min(Number(x.lead),90):14,notes:clean(x.notes||''),source:'Sugestão do Claude'}},
      prompt:`DATAS JÁ CADASTRADAS (não repita)\n${ex.join('\n')||'nenhuma'}\n\nTAREFA: sugira até 10 datas relevantes para o conteúdo desta marca no Brasil entre ${t} e ${end}: datas comemorativas, sazonalidades do nicho, prazos que afetam o público e eventos do setor. Inclua só datas que você conhece com segurança; se o dia exato muda a cada ano ou depende de anúncio oficial, escreva [confirmar] nas notas. Nas notas, diga em 1 frase como a marca pode aproveitar a data.\nResponda apenas com um array JSON: [{"title":"...","date":"AAAA-MM-DD","recurring":true,"type":"um de: ${DTYPES.join(', ')}","lead":14,"notes":"..."}]. Em lead, informe quantos dias antes vale começar a produzir.`});
  },
  'ai-date-ideas'(id){
    const d=state.data.dates.find(x=>x.id===id);if(!d)return;const o=nextOcc(d);
    ask({title:'Ideias para a data',sub:d.title,kind:'json',addLabel:'Salvar no mapa de ideias',card:ideaCard,onAdd:addIdea,norm:normIdea('Data: '+d.title),
      prompt:`DATA\nNome: ${d.title}\nQuando: ${o?iso(o):d.date}\nTipo: ${d.type||''}\nNotas: ${d.notes||''}\n\nTAREFA: sugira 5 ideias de conteúdo para aproveitar esta data de forma natural para a marca (sem forçar a relação), incluindo pelo menos uma para antes da data e uma para o dia.\n${IDEA_SHAPE}`});
  },
  'ai-ideas'(){
    const ex=state.data.ideas.map(i=>i.title);
    ask({title:'Novas ideias',sub:'Distribuídas pelos pilares da marca.',kind:'json',addLabel:'Salvar no mapa',card:ideaCard,onAdd:addIdea,norm:normIdea('Sugestão do Claude'),
      prompt:`IDEIAS QUE JÁ EXISTEM (não repita)\n${lines(ex,t=>'- '+t,60)||'nenhuma'}\n\nREFERÊNCIAS VIRAIS SALVAS\n${lines(state.data.refs,r=>`- ${r.hook||''} (${r.format||''})`,10)||'nenhuma'}\n\nTAREFA: sugira 8 ideias novas de conteúdo, distribuídas entre os pilares e os canais ativos. Varie os formatos.\n${IDEA_SHAPE}`});
  },
  'ai-idea-dev'(id){
    const i=state.data.ideas.find(x=>x.id===id);if(!i)return;
    ask({title:'Desenvolver ideia',sub:i.title,kind:'text',prompt:`IDEIA\nTítulo: ${i.title}\nPilar: ${i.pillar||''}\nCanais: ${(i.channels||[]).join(', ')}\nFormato: ${i.format||''}\nNotas: ${i.notes||''}\n\nTAREFA: desenvolva esta ideia para produção: 3 opções de gancho, estrutura em tópicos (telas, cenas ou seções, conforme o formato), CTA alinhado à marca, sugestão de visual e, se houver mais de um canal, como adaptar para cada um.`});
  },
  'ai-metrics'(){
    const cfg=kpiCfg();
    if(cfg){
      const all=kpiWeeks();if(!all.length)return toast('Lance algumas semanas primeiro.');
      const R=kpiRange(all), ws=R.sel.slice(-26);if(!ws.length)return toast('Nenhuma semana nesse período.');
      const tab=cfg.grupos.map(g=>`${g.nome}\n`+(g.metricas||[]).map(m=>`- ${m.l}: `+ws.map(w=>`${w.data} ${fmtK(kv(w,g.id,m.k),m.tipo,kAprox(w,g.id,m.k))}`).join(' | ')).join('\n')).join('\n\n');
      const pub=state.data.posts.filter(p=>p.status==='publicado'&&p.date>=ws[0].start&&p.date<=ws[ws.length-1].end);
      return ask({title:'Leitura das métricas',sub:`${ws.length} semanas, de ${wLabel(ws[0])} a ${wLabel(ws[ws.length-1])}`,kind:'text',
        prompt:`KPIs SEMANAIS DA MARCA (a data é o dia do preenchimento; os números são dos 7 dias anteriores; ~ = arredondado na origem; – = não lançado)\n${tab}\n\nPOSTS PUBLICADOS NO PERÍODO\n${lines(pub,p=>`- ${p.date} ${p.channel} ${p.format||''}: ${p.title}`,30)||'nenhum marcado como publicado'}\n\nTAREFA: faça uma leitura objetiva: 3 destaques, 3 pontos de atenção e 3 ações práticas de conteúdo para as próximas semanas, citando canal, métrica e semanas. Compare a última semana com as anteriores e aponte tendências. Use apenas os números fornecidos; não crie dados novos. Quando faltar dado, diga isso.`});
    }
    const all=metricRows();
    if(!all.length)return toast('Registre algumas métricas primeiro.');
    const R=mRange();
    const sum=CH.map(c=>{const rows=all.filter(r=>r.channel===c.id);if(!rows.length)return '';
      const f=k=>{const x=mSummary(rows,k,R);if(!x)return '-';
        if(x.kind==='stock')return `${Math.round(x.value)}${x.diff!=null?` (variação ${x.diff>=0?'+':''}${x.diff})`:''}`;
        if(x.kind==='rate')return `${x.value.toFixed(1)}%${x.diff!=null?` (anterior ${(x.value-x.diff).toFixed(1)}%)`:''}`;
        return `${x.value}${x.prev!=null?` (anterior ${Math.round(x.prev)})`:''}`};
      return `${c.label} | seguidores ${f('followers')} | alcance ${f('reach')} | engajamento ${f('engagement')} | cliques ${f('clicks')} | posts ${f('posts')}`}).filter(Boolean);
    const pub=state.data.posts.filter(p=>p.status==='publicado'&&p.date>=iso(R.a)&&p.date<=iso(R.b));
    ask({title:'Leitura das métricas',sub:`${fmtD(R.a)} a ${fmtD(R.b)}, comparado com ${fmtD(R.pa)} a ${fmtD(R.pb)}`,kind:'text',
      prompt:`PERÍODO ANALISADO: ${iso(R.a)} a ${iso(R.b)} (${R.len} dias). PERÍODO ANTERIOR PARA COMPARAR: ${iso(R.pa)} a ${iso(R.pb)}.\nRESUMO POR CANAL (valores do período; entre parênteses, o período anterior ou a variação)\n${sum.join('\n')}\n\nPOSTS PUBLICADOS NO PERÍODO\n${lines(pub,p=>`- ${p.date} ${p.channel} ${p.format||''}: ${p.title}`,30)||'nenhum marcado como publicado'}\n\nTAREFA: faça uma leitura objetiva deste período: 3 destaques, 3 pontos de atenção e 3 ações práticas de conteúdo para o próximo período. Use apenas os números fornecidos; não crie dados novos. Quando faltar dado de comparação, diga isso.`});
  },
  'ai-comps'(){
    const cs=state.data.competitors;if(!cs.length)return toast('Cadastre alguns concorrentes primeiro.');
    const since=iso(addDays(parseISO(TODAY()),-45));
    const cn=state.data.compnews.filter(n=>String(n.date||n.createdAt).slice(0,10)>=since);
    ask({title:'Lacunas e oportunidades',kind:'text',prompt:`CONCORRENTES\n${lines(cs,c=>`- ${c.name}: posicionamento: ${c.positioning||'-'} | resumo da pesquisa: ${c.autoSummary||'-'} | conteúdo: ${c.autoContent?[c.autoContent.topics,c.autoContent.formats,c.autoContent.whatWorks].filter(Boolean).join(' / '):'-'} | fortes: ${c.strengths||'-'} | brechas: ${c.weaknesses||'-'} | frequência: ${c.frequency||'-'} | notas: ${c.notes||'-'}`,20)}\n\nCONTEÚDOS E NOTÍCIAS RECENTES DOS CONCORRENTES\n${lines(cn,n=>`- [${kindOf(n)==='conteudo'?'conteúdo '+(n.channel||'')+' '+(n.format||''):'notícia'}] ${n.date||''} ${n.competitorName||''}: ${n.title}${n.signal?' | resultado: '+n.signal:''}${n.summary?' ('+n.summary+')':''}`,40)||'nenhum'}\n\nTAREFA: com base apenas nessas informações e no contexto da marca, aponte lacunas de conteúdo que os concorrentes não ocupam, movimentos recentes que pedem resposta, como a marca pode se diferenciar no tom e nos formatos, e termine com 5 pautas que explorem essas lacunas. Onde faltar informação, diga o que vale observar nos perfis.`});
  },
  'ai-comp-one'(id){
    const c=state.data.competitors.find(x=>x.id===id);if(!c)return;
    const ac=c.autoChannels||{};
    const cn=state.data.compnews.filter(n=>n.competitorId===id);
    ask({title:'Comparar com a marca',sub:c.name,kind:'text',prompt:`CONCORRENTE\nNome: ${c.name}\nPosicionamento: ${c.positioning||'-'}\nResumo da pesquisa: ${c.autoSummary||'-'}\nRevisão dos canais:\n${Object.entries(ac).map(([k,v])=>`- ${k}: ${(v&&v.notes)||'-'}`).join('\n')||'-'}\nPontos fortes: ${c.strengths||'-'}\nBrechas: ${c.weaknesses||'-'}\nFrequência: ${c.frequency||'-'}\nNotas: ${c.notes||'-'}\nConteúdo: ${c.autoContent?[c.autoContent.topics,c.autoContent.formats,c.autoContent.whatWorks].filter(Boolean).join(' / '):'-'}\nConteúdos e notícias recentes:\n${lines(cn,n=>`- [${kindOf(n)}] ${n.date||''} ${n.title}${n.signal?' ('+n.signal+')':''}`,15)||'-'}\n\nTAREFA: compare este concorrente com a marca: onde competem de frente, onde a marca pode se diferenciar, o que observar no perfil dele nas próximas semanas (checklist) e 3 pautas de resposta.`});
  },
  'ai-compnews-one'(id){
    const n=state.data.compnews.find(x=>x.id===id);if(!n)return;
    ask({title:'Como responder',sub:n.title,kind:'text',prompt:`MOVIMENTO DE UM CONCORRENTE\nConcorrente: ${n.competitorName||''}\nNotícia: ${n.title}\nFonte: ${n.source||''} ${n.date||''}\nResumo: ${n.summary||''}\n\nTAREFA: explique em 2 frases o que esse movimento significa para a marca e sugira 3 formas de responder com conteúdo (canal, formato e gancho), sem citar o concorrente de forma negativa. Se não houver motivo para reagir, diga isso.`});
  },
  'ai-compcontent-adapt'(id){
    const n=state.data.compnews.find(x=>x.id===id);if(!n)return;
    ask({title:'Adaptar para a marca',sub:n.title,kind:'json',addLabel:'Salvar no mapa de ideias',card:ideaCard,onAdd:addIdea,norm:normIdea('Concorrente: '+(n.competitorName||'')),
      prompt:`CONTEÚDO DE UM CONCORRENTE\nConcorrente: ${n.competitorName||''}\nCanal: ${n.channel||''}\nFormato: ${n.format||''}\nTítulo ou gancho: ${n.title}\nResultado visível: ${n.signal||'não informado'}\nO que disseram e por que chamou atenção: ${n.summary||''}\n\nTAREFA: crie 3 ideias para a marca que aproveitem o que fez esse conteúdo funcionar (tema, gancho ou formato), com ângulo e voz próprios, sem copiar nem citar o concorrente. Nas notas, escreva o gancho de abertura.\n${IDEA_SHAPE}`});
  },
  'ai-brand'(){
    ask({title:'Revisão do posicionamento',kind:'text',prompt:'TAREFA: revise as configurações acima e sugira melhorias concretas: (1) tom de voz com 3 frases de exemplo no estilo certo e 3 no estilo errado, (2) ajustes nos pilares com um exemplo de pauta para cada, (3) itens a acrescentar em "O que evitar", (4) o que falta descrever sobre o público.'});
  },
  'ai-hooks'(){
    const v=collect(SCHEMA.posts);
    ask({title:'Ganchos e títulos',sub:v.title,kind:'text',prompt:`CONTEÚDO\nTítulo: ${v.title}\nCanal: ${(CHM[v.channel]||{}).label||v.channel}\nFormato: ${v.format}\nPilar: ${v.pillar}\nRascunho: ${v.caption||'-'}\n\nTAREFA: sugira 8 ganchos ou títulos para este conteúdo, adequados ao canal, variando o tipo (pergunta, número, contraste, promessa, curiosidade). Uma linha cada, sem explicação.`});
  }
};

/* ---- caption drafting streamed into the editor ---- */
let capCtl=null;
async function draftCaption(){
  const b=$('#aiCapBtn'), ta=$('#f-caption');
  if(capCtl){capCtl.abort();return}
  if(!sample){toast('As sugestões do Claude funcionam quando a central é aberta no Claude.');return}
  const v=collect(SCHEMA.posts);
  if(!v.title){toast('Escreva o título ou tema do post primeiro.');return}
  const guide={instagram:'Legenda com gancho na primeira linha, corpo escaneável, CTA e até 5 hashtags. Se o formato for Reels ou vídeo, entregue antes o roteiro por cenas.',
    linkedin:'Post de 150 a 250 palavras, primeira linha forte, parágrafos curtos, pergunta no final.',
    blog:'Título otimizado para SEO, meta description (até 155 caracteres), intertítulos H2 com tópicos, CTA final e sugestão de imagem de capa.',
    youtube:'Título, roteiro com gancho nos primeiros 15 segundos, blocos com tempo aproximado, CTA e descrição do vídeo.',
    site:'Texto de página com título, subtítulo, seções curtas e CTA.'}[v.channel]||'';
  const prev=ta.value, ctl=capCtl=new AbortController();
  b.innerHTML=SPARK+'Parar';
  ta.value='Pensando...';
  try{
    const r=await sample(`${RULES}\n\n${brandCtx()}\n\nCONTEÚDO\nTítulo: ${v.title}\nCanal: ${(CHM[v.channel]||{}).label||v.channel}\nFormato: ${v.format}\nPilar: ${v.pillar}\nData: ${v.date}\n${prev?'Rascunho atual (melhore a partir dele):\n'+prev:''}\n\nTAREFA: escreva o texto pronto para este conteúdo. ${guide}\nResponda só com o texto, sem comentários antes ou depois.`,
      {signal:ctl.signal,cache:false,onText:({text})=>{ta.value=clean(text)}});
    ta.value=clean(r.text);
  }catch(e){
    if(e.code==='cancelled'){ if(!e.text)ta.value=prev; }
    else{ta.value=e.text?clean(e.text):prev;toast(aiErrMsg(e))}
  }finally{capCtl=null;if(b&&b.isConnected)b.innerHTML=SPARK+'Rascunhar texto'}
}

/* ================= events ================= */
const armed=new Set();
function arm(btnEl,key,label){
  if(armed.has(key)){armed.delete(key);return true}
  armed.add(key);btnEl.classList.add('armed');const old=btnEl.textContent;btnEl.textContent=label;
  setTimeout(()=>{armed.delete(key);if(btnEl.isConnected){btnEl.classList.remove('armed');btnEl.textContent=old}},4000);
  return false;
}
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  const a=el.dataset.act, id=el.dataset.id;
  if(el.tagName==='BUTTON'&&el.form)e.preventDefault();
  if(AI[a]){AI[a](id);return}
  switch(a){
    case 'tab':state.tab=el.dataset.tab;LS.set('cl.tab',state.tab);try{history.replaceState(null,'','#'+state.tab)}catch(_){}
      renderTabs();renderMain(true);window.scrollTo({top:0});break;
    case 'filter':{const fk=el.dataset.f;
      if(fk==='mPeriod'&&el.dataset.v==='custom'&&state.f.mPeriod!=='custom'){const R=mRange();state.f.mFrom=iso(R.a);state.f.mTo=iso(R.b);LS.set('cl.mFrom',state.f.mFrom);LS.set('cl.mTo',state.f.mTo)}
      if(fk==='kPer'&&el.dataset.v==='custom'&&state.f.kPer!=='custom'){const w=kpiWeeks();if(w.length){const R=kpiRange(w);state.f.kFrom=iso(R.a);state.f.kTo=iso(R.b);LS.set('cl.kFrom',state.f.kFrom);LS.set('cl.kTo',state.f.kTo)}}
      state.f[fk]=el.dataset.v;if(['newsPeriod','mPeriod','compPeriod','compKind','kGrupo','kPer'].includes(fk))LS.set('cl.'+fk,el.dataset.v);renderMain(true);break}
    case 'comp-news':{state.f.compFilter=el.dataset.v;renderMain(true);const t=document.getElementById('compNews');if(t)t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});break}
    case 'comp-import':{if(el.disabled)break;el.disabled=true;await requestImport();break}
    case 'comp-research':{const c=state.data.competitors.find(x=>x.id===id);if(!c||el.disabled)break;el.disabled=true;await requestResearch(c);break}
    case 'm-apply':{const a=$('#mFrom').value,b=$('#mTo').value;if(!a||!b){toast('Escolha as duas datas.');break}
      state.f.mFrom=a;state.f.mTo=b;LS.set('cl.mFrom',a);LS.set('cl.mTo',b);renderMain(true);break}
    case 'idea-all':state.f.ideaAll=!state.f.ideaAll;renderMain(true);break;
    case 'new':openEditor(el.dataset.col,null,defaults(el.dataset.col,el.dataset));break;
    case 'new-on':openEditor('posts',null,defaults('posts',{date:el.dataset.date}));break;
    case 'edit':{const it=state.data[el.dataset.col].find(x=>x.id===id);if(it)openEditor(el.dataset.col,it);break}
    case 'idea-schedule':{const i=state.data.ideas.find(x=>x.id===id);if(!i)break;
      const ch=(i.channels||[]).find(c=>activeCh().some(x=>x.id===c))||activeCh()[0].id;
      openEditor('posts',null,Object.assign(defaults('posts',{}),{title:i.title,pillar:i.pillar||'',channel:ch,format:i.format||'',notes:i.notes||''}),{ideaId:i.id});break}
    case 'ref-plan':{const r=state.data.refs.find(x=>x.id===id);if(!r)break;
      /* variação do Claude vira post no planejamento: canal pela plataforma, formato e pilar quando reconhecidos */
      const ch=activeCh().some(x=>x.id===r.platform)?r.platform:activeCh()[0].id;
      const fmt=String(r.format||'').split('·')[0].trim();
      const pil=pillars().find(p=>String(r.fit||'').includes(p))||'';
      const notes=[r.why&&'Por que deve funcionar: '+r.why,r.fit&&'Como a marca entra: '+r.fit,r.base&&'Inspirada em: '+r.base+(safeUrl(r.baseUrl)?' ('+safeUrl(r.baseUrl)+')':'')].filter(Boolean).join('\n');
      openEditor('posts',null,Object.assign(defaults('posts',{}),{title:r.hook||'Variação do Claude',channel:ch,format:FORMATS.includes(fmt)?fmt:'',pillar:pil,notes}),{refId:r.id});break}
    case 'date-post':{const d=state.data.dates.find(x=>x.id===id);if(!d)break;const o=nextOcc(d);
      openEditor('posts',null,Object.assign(defaults('posts',{}),{title:d.title,date:o?iso(o):d.date,notes:d.notes||''}));break}
    case 'cal-prev':{let {y,m}=state.cal;m--;if(m<0){m=11;y--}state.cal={y,m};renderMain(true);break}
    case 'cal-next':{let {y,m}=state.cal;m++;if(m>11){m=0;y++}state.cal={y,m};renderMain(true);break}
    case 'cal-today':{const d=new Date();state.cal={y:d.getFullYear(),m:d.getMonth()};renderMain(true);break}
    case 'modal-close':closeModal();break;
    case 'save-item':el.disabled=true;await saveItem();el.disabled=false;break;
    case 'del-item':if(arm(el,'del','Confirmar exclusão')){const {col,item}=modalCtx;try{await Store.remove(bpath(col),item.id);toast('Item excluído');
      if(col==='refs'&&assets&&validAsset(item.media))assets.delete(item.media).catch(()=>{});closeModal()}catch(_){}}break;
    case 'k-apply':{const x=$('#kFrom').value,y=$('#kTo').value;if(!x||!y){toast('Escolha as duas datas.');break}
      state.f.kFrom=x;state.f.kTo=y;LS.set('cl.kFrom',x);LS.set('cl.kTo',y);renderMain(true);break}
    case 'kpi-new':openKpiEditor(null);break;
    case 'kpi-edit':{const w=kpiWeeks().find(x=>x.id===id);if(w)openKpiEditor(w);break}
    case 'kpi-save':el.disabled=true;await saveKpi();el.disabled=false;break;
    case 'kpi-del':if(arm(el,'kdel','Confirmar exclusão')){const w=modalCtx&&modalCtx.item;if(w){try{await Store.remove(bpath('metrics'),w.id);toast('Semana excluída');closeModal()}catch(_){}}}break;
    case 'media-remove':{$('#f-media').value='';$('#f-mediaType').value='';if(modalCtx)modalCtx.file=null;$('#mediaBox').innerHTML=MEDIA_EMPTY;break}
    case 'ai-ref-fill':fillRefWithClaude(el);break;
    case 'ai-bussola':refreshBussola(el);break;
    case 'nov-ok':if(state.novidade)LS.set('cl.novidadeVista',state.novidade.chave||state.novidade.data);renderMain(true);break;
    case 'ai-caption':draftCaption();break;
    case 'new-brand':openEditor('__brand',null,{});break;
    case 'brand-save':{try{await Store.set('brands',state.brandId,readBrandForm());state.brandDirty=false;toast('Configurações salvas');renderTop()}catch(_){}break}
    case 'brand-backup':{const b=curBrand();if(!b)break;el.disabled=true;
      try{const out={app:LAB.slug||'content-lab',versao:1,exportadoEm:new Date().toISOString(),brand:b,data:{}};
        for(const c of COLS)out.data[c]=await Store.list(bpath(c));
        const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
        const fname=`${LAB.slug||'content-lab'}-${String(b.name||b.id).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${TODAY()}.json`;
        const total=COLS.reduce((n,c)=>n+out.data[c].length,0);
        if(downloads){await downloads.save({filename:fname,data:blob});toast(`Backup salvo com ${total} itens`)}
        else if(state.mode==='live'){toast('O download não está liberado nesta visualização.',4000)}
        else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;
          document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
          toast(`Backup gerado com ${total} itens`)}}
      catch(e){const c=e&&e.code;if(c!=='declined')toast(c==='rate_limited'?'Já há um download aguardando confirmação.':'Não consegui gerar o backup agora.')}
      el.disabled=false;break}
    case 'brand-examples':if(arm(el,'ex','Confirmar remoção')){el.disabled=true;let n=0;
      try{for(const c of COLS){for(const it of await Store.list(bpath(c))){if(it.exemplo){await Store.remove(bpath(c),it.id);n++}}}
        const b=curBrand();if(b&&b.exemplo)await Store.set('brands',b.id,Object.assign(strip(b),{exemplo:false}));
        toast(n?`${n} itens de exemplo removidos`:'Não há itens de exemplo nesta marca');}catch(_){}
      el.disabled=false}break;
    case 'brand-delete':if(!LAB.marca&&arm(el,'bd','Confirmar: excluir tudo')){el.disabled=true;const bid=state.brandId;
      try{for(const c of COLS){for(const it of await Store.list(`brands/${bid}/${c}`))await Store.remove(`brands/${bid}/${c}`,it.id)}
        await Store.remove('brands',bid);toast('Marca excluída')}catch(_){el.disabled=false}}break;
    case 'sheet-close':closeSheet();break;
    case 'ai-stop':aiCtl&&aiCtl.abort();break;
    case 'ai-again':aiLast&&ask(aiLast);break;
    case 'ai-add':{const it=aiItems[+el.dataset.i];if(!it||el.disabled)break;el.disabled=true;
      try{await aiLast.onAdd(it);el.textContent='Adicionado ✓'}catch(_){el.disabled=false}break}
    case 'ai-add-all':{el.disabled=true;let n=0;
      for(const b of document.querySelectorAll('#sheetBody [data-act="ai-add"]:not([disabled])')){const it=aiItems[+b.dataset.i];b.disabled=true;try{await aiLast.onAdd(it);b.textContent='Adicionado ✓';n++}catch(_){b.disabled=false}}
      toast(n?`${n} sugestões adicionadas`:'Tudo já foi adicionado');break}
    case 'ai-copy':{try{await navigator.clipboard.writeText(aiText);toast('Texto copiado')}catch(_){const r=document.createRange();r.selectNodeContents($('#aiOut'));const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Texto selecionado. Use copiar do seu aparelho.')}break}
  }
});
function defaults(col,ds){
  if(col==='posts')return {date:ds.date||TODAY(),channel:state.f.calCh||activeCh()[0].id,status:'ideia'};
  if(col==='ideas')return {pillar:ds.pillar||(state.f.ideaPilar!=='Sem pilar'&&state.f.ideaPilar)||'',status:'nova',channels:state.f.ideaCh?[state.f.ideaCh]:[]};
  if(col==='refs')return {platform:'instagram'};
  if(col==='compnews')return {kind:state.f.compKind||'conteudo',competitorId:state.f.compFilter||(state.data.competitors[0]||{}).id||''};
  if(col==='dates')return {type:'Data comemorativa',recurring:true,lead:14};
  if(col==='metrics'){const t=parseISO(TODAY());return {start:iso(addDays(t,-7)),end:iso(addDays(t,-1)),channel:activeCh()[0].id}}
  return {};
}
document.addEventListener('change',e=>{const fs=e.target&&e.target.dataset&&e.target.dataset.fsel;if(fs){state.f[fs]=e.target.value;LS.set('cl.'+fs,e.target.value);renderMain(true);return}
  if(e.target&&e.target.id==='f-mediafile'){const f=e.target.files&&e.target.files[0];e.target.value='';attachMedia(f)}});
document.addEventListener('paste',e=>{if(!modalCtx||modalCtx.col!=='refs')return;const it=[...(e.clipboardData&&e.clipboardData.items||[])].find(i=>i.kind==='file'&&/^image\//.test(i.type));if(it){e.preventDefault();attachMedia(it.getAsFile())}});
document.addEventListener('error',e=>{const t=e.target;if(t&&t.hasAttribute&&t.hasAttribute('data-media')){const d=document.createElement('div');d.className='media-empty';d.textContent='Prévia indisponível.';t.replaceWith(d)}},true);
document.addEventListener('toggle',e=>{const t=e.target;if(t&&t.classList&&t.classList.contains('cmore')){(state.compOpen||(state.compOpen={}))[t.dataset.id]=t.open}},true);
document.addEventListener('toggle',e=>{if(e.target&&e.target.classList&&e.target.classList.contains('bussola'))LS.set('cl.bussolaFechada',!e.target.open)},true);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(!$('#sheet').hidden)closeSheet();else if(!$('#modal').hidden)closeModal()}
  if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('cell')){e.preventDefault();e.target.click()}
});
$('#modal').addEventListener('mousedown',e=>{if(e.target.id==='modal')closeModal()});
$('#sheet').addEventListener('mousedown',e=>{if(e.target.id==='sheet')closeSheet()});
document.addEventListener('submit',e=>e.preventDefault());
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('#brandForm'))state.brandDirty=true});
$('#brandSel').addEventListener('change',e=>{
  const v=e.target.value;
  if(v==='__new'){openEditor('__brand',null,{});e.target.value=state.brandId||'__new';return}
  setBrand(v);
});
// chart tooltips
const tip=$('#tip');
document.addEventListener('pointerover',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.hidden=true;return}tip.textContent=t.dataset.tip;tip.hidden=false});
document.addEventListener('pointermove',e=>{if(!tip.hidden){tip.style.left=e.clientX+'px';tip.style.top=e.clientY+'px'}});
window.addEventListener('hashchange',()=>{const t=TABS.find(x=>x.id===location.hash.slice(1));if(t&&t.id!==state.tab){state.tab=t.id;renderTabs();renderMain(true)}});

/* ================= boot ================= */
subBrands();
(async()=>{
  const c=window.claude;
  if(!c||typeof c.use!=='function')return;
  const [d,s,m,a,dl]=await Promise.all([c.use('db').catch(()=>null),c.use('sample').catch(()=>null),c.use('mcp').catch(()=>null),c.use('assets').catch(()=>null),c.use('downloads').catch(()=>null)]);
  sample=s;mcp=m;assets=a;downloads=dl;
  if(d){
    db=d;state.mode='live';state.loading=true;state.brands=[];state.brandId=null;
    unsubCols.forEach(u=>u());unsubCols=[];
    render();subBrands();
  }
})();
})();
