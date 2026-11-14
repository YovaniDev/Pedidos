// Servidor local de pedidos. Sin dependencias: solo Node.js.
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const PORT=process.env.PORT||3000, FILE=path.join(__dirname,'datos.json');
let S={menu:[
 {n:'Agua',t:'bebida'},{n:'Gaseosa',t:'bebida'},{n:'Limonada',t:'bebida'},{n:'Café',t:'bebida'},{n:'Cerveza',t:'bebida'},
 {n:'Ceviche',t:'plato'},{n:'Lomo saltado',t:'plato'},{n:'Ají de gallina',t:'plato'},{n:'Arroz con pollo',t:'plato'},{n:'Sopa del día',t:'plato'}
],orders:[],seq:1};
try{S=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){}
const save=()=>fs.writeFile(FILE,JSON.stringify(S),()=>{});
const pend=o=>['bebida','plato'].some(t=>o.items.some(i=>i.t===t)&&!o.done[t]);
const T=t=>t==='bebida'?'bebida':'plato';
const actions={
 '/api/order':b=>{
  const items=(Array.isArray(b.items)?b.items:[]).map(i=>({n:String(i.n).slice(0,80),t:T(i.t),q:Math.max(1,parseInt(i.q)||1)}));
  if(!items.length)return;
  S.orders.push({id:S.seq++,mesa:String(b.mesa||'Sin nombre').slice(0,60),ts:Date.now(),items,note:String(b.note||'').slice(0,300),done:{bebida:false,plato:false}});
 },
 '/api/edit':b=>{
  const o=S.orders.find(x=>x.id===b.id);if(!o)return;
  const items=(Array.isArray(b.items)?b.items:[]).map(i=>({n:String(i.n).slice(0,80),t:T(i.t),q:Math.max(1,parseInt(i.q)||1)}));
  if(!items.length)return;
  for(const t of ['bebida','plato']){
    const f=l=>JSON.stringify(l.filter(i=>i.t===t).map(i=>[i.n,i.q]).sort());
    if(f(o.items)!==f(items))o.done[t]=false;
  }
  o.items=items;o.mesa=String(b.mesa||o.mesa).slice(0,60);o.note=String(b.note||'').slice(0,300);o.editTs=Date.now();
  if(pend(o))delete o.doneTs;else if(!o.doneTs)o.doneTs=Date.now();
 },
 '/api/done':b=>{const o=S.orders.find(x=>x.id===b.id);if(o){o.done[T(b.t)]=true;if(!pend(o))o.doneTs=Date.now()}},
 '/api/menu/add':b=>{const n=String(b.n||'').trim().slice(0,60);if(n&&!S.menu.some(m=>m.n.toLowerCase()===n.toLowerCase()))S.menu.push({n,t:T(b.t)})},
 '/api/menu/del':b=>{S.menu=S.menu.filter(m=>m.n!==b.n)},
 '/api/clear':()=>{S.orders=S.orders.filter(pend)},
 '/api/close':()=>{S.orders=[];S.seq=1}
};
http.createServer((req,res)=>{
  const json=o=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
  if(req.method==='GET'&&req.url==='/api/state')return json(S);
  if(req.method==='POST'&&actions[req.url]){
    let d='';req.on('data',c=>{d+=c;if(d.length>1e5)req.destroy()});
    req.on('end',()=>{let b={};try{b=JSON.parse(d||'{}')}catch(e){}actions[req.url](b);save();json(S)});
    return;
  }
  if(req.method==='GET'&&(req.url==='/'||req.url.startsWith('/?'))){
    return fs.readFile(path.join(__dirname,'index.html'),(e,h)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(h)});
  }
  res.writeHead(404);res.end();
}).listen(PORT,'0.0.0.0',()=>{
  console.log('\nApp de pedidos lista. Abre en cada celular (misma red WiFi):');
  for(const l of Object.values(os.networkInterfaces()))for(const i of l)if(i.family==='IPv4'&&!i.internal)console.log('  http://'+i.address+':'+PORT);
  console.log('\nCtrl+C para detener.\n');
});
