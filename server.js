const http=require('http'),fs=require('fs'),crypto=require('crypto'),path=require('path');
const PORT=process.env.PORT||3000,KEY=process.env.ADMIN_KEY||crypto.randomBytes(6).toString('hex'),FILE=path.join(__dirname,'state.json'),B=10000,N=60;
const bk=()=>Math.floor(Date.now()/B)*B;
function mk(price){let p=price,c=[];const t=bk();for(let i=0;i<N;i++){const cl=p,o=+(cl/(1+(Math.random()-.5)*.012)).toFixed(2);c.unshift({t:t-i*B,o,h:+(Math.max(o,cl)*(1+Math.random()*.004)).toFixed(2),l:+(Math.min(o,cl)*(1-Math.random()*.004)).toFixed(2),c:cl,v:Math.round(20+Math.random()*80)});p=o}return{price,trend:0,c}}
let S={assets:{ACME:mk(100),MOON:mk(42),BYTE:mk(250)},players:{},auto:false};
try{S=JSON.parse(fs.readFileSync(FILE))}catch(e){}
for(const k in S.assets){const a=S.assets[k];if(!a.c)a.c=mk(a.price).c;a.trend=a.trend||0;delete a.hist}
const save=()=>{try{fs.writeFileSync(FILE,JSON.stringify(S))}catch(e){}};
const push=(k,p,v=0)=>{const a=S.assets[k],t=bk(),l=a.c[a.c.length-1];p=+p.toFixed(2);const o=l?l.c:p;
 if(l&&l.t===t){l.h=Math.max(l.h,p);l.l=Math.min(l.l,p);l.c=p;l.v+=v}else a.c.push({t,o,h:Math.max(o,p),l:Math.min(o,p),c:p,v});
 a.c=a.c.slice(-N);a.price=p};
setInterval(()=>{for(const k in S.assets){const a=S.assets[k],live=a.trend||S.auto;push(k,Math.max(.01,a.price*(1+a.trend/100+(live?(Math.random()-.5)*.008:0))),live?Math.round(Math.random()*10):0)}save()},2000);
const pub=()=>({assets:S.assets,auto:S.auto,players:Object.fromEntries(Object.entries(S.players).map(([i,p])=>[i,{name:p.name,cash:p.cash,pos:p.pos}]))});
const send=(res,o,c=200)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(o))};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url.split('?')[0]==='/'){res.writeHead(200,{'content-type':'text/html'});return fs.createReadStream(path.join(__dirname,'index.html')).pipe(res)}
 if(req.method==='GET'&&req.url==='/api/state')return send(res,{...pub(),admin:req.headers['x-admin']===KEY});
 if(req.method!=='POST')return send(res,{error:'not found'},404);
 let raw='';req.on('data',d=>{raw+=d;if(raw.length>1e4)req.destroy()});
 req.on('end',()=>{let b={};try{b=JSON.parse(raw||'{}')}catch(e){}
  const r=req.url.replace('/api/',''),adm=req.headers['x-admin']===KEY,a=S.assets[b.sym];
  if(r==='join'){const name=String(b.name||'').trim().slice(0,20);if(!name)return send(res,{error:'Name needed'},400);
   const id=crypto.randomBytes(5).toString('hex'),t=crypto.randomBytes(12).toString('hex');S.players[id]={name,cash:10000,pos:{},t};save();return send(res,{id,token:t})}
  if(r==='trade'){const p=S.players[b.id],n=Math.floor(+b.qty);
   if(!p||p.t!==b.token)return send(res,{error:'Rejoin the room'},403);if(!a||!(n>0))return send(res,{error:'Bad order'},400);
   const cost=n*a.price;
   if(b.side==='buy'){if(cost>p.cash)return send(res,{error:'Not enough cash'});p.cash=+(p.cash-cost).toFixed(2);p.pos[b.sym]=(p.pos[b.sym]||0)+n}
   else{if((p.pos[b.sym]||0)<n)return send(res,{error:'You don’t hold that many'});p.cash=+(p.cash+cost).toFixed(2);p.pos[b.sym]-=n;if(!p.pos[b.sym])delete p.pos[b.sym]}
   a.c[a.c.length-1].v+=n;save();return send(res,{ok:1})}
  if(!adm)return send(res,{error:'Host only'},403);
  if(r==='price'&&a&&+b.price>0)push(b.sym,+b.price);
  else if(r==='nudge'&&a)push(b.sym,Math.max(.01,a.price*(1+b.pct/100)),30);
  else if(r==='trend'&&a)a.trend=+b.pct||0;
  else if(r==='add'){const k=String(b.sym||'').toUpperCase().slice(0,6);if(k&&+b.price>0&&!S.assets[k])S.assets[k]=mk(+b.price)}
  else if(r==='del'&&a&&Object.keys(S.assets).length>1)delete S.assets[b.sym];
  else if(r==='cash'&&S.players[b.id])S.players[b.id].cash=+b.cash||0;
  else if(r==='clear'&&S.players[b.id])S.players[b.id].pos={};
  else if(r==='kick')delete S.players[b.id];
  else if(r==='auto')S.auto=!!b.on;
  save();send(res,{ok:1})})
}).listen(PORT,()=>console.log('Trading Room on port '+PORT));
