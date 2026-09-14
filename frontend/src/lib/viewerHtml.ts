export type ViewerLayers = {
  buildings: boolean;
  roads: boolean;
  terrain: boolean;
  vegetation: boolean;
  dynamic: boolean;
};

export function buildViewerHtml(opts: { title: string; scene: string; layers: ViewerLayers }) {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
html,body,#c{margin:0;height:100%;background:#081210;overflow:hidden;touch-action:none}
#hud,#stat{position:fixed;top:10px;padding:7px 10px;border-radius:10px;border:1px solid #2E463D;background:rgba(18,32,28,.82);color:#E7F2EC;font:12px system-ui}
#hud{left:10px}#stat{right:10px;color:#2AD4A1}
</style></head><body>
<div id="hud">${opts.title}</div><div id="stat">Orbit · tap to measure</div>
<canvas id="c"></canvas>
<script>
const S=${JSON.stringify(opts.scene)};
const L=${JSON.stringify(opts.layers)};
let mode='textured', nav='orbit', measure='distance';
let ang=0.72, pit=0.55, sc=1, ox=0, oy=0;
let picks=[];
const c=document.getElementById('c'), x=c.getContext('2d');
function resize(){c.width=innerWidth*devicePixelRatio;c.height=innerHeight*devicePixelRatio;c.style.width=innerWidth+'px';c.style.height=innerHeight+'px';draw()}
function iso(X,Y,Z){
  const cx=c.width/2+ox, cy=c.height*0.62+oy, s=10*devicePixelRatio*sc;
  const ca=Math.cos(ang), sa=Math.sin(ang);
  return [cx+(X*ca-Z*sa)*s, cy+(X*sa+Z*ca)*s*pit - Y*s];
}
function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
function fillPoly(pts,col){x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();x.fillStyle=col;x.fill(); if(mode==='wireframe'){x.strokeStyle='#93c5fd';x.lineWidth=1;x.stroke()}}
function box(X,Y,Z,w,h,d,col){
  const p=(xx,yy,zz)=>iso(xx,yy,zz);
  const t=[p(X,Y+h,Z),p(X+w,Y+h,Z),p(X+w,Y+h,Z+d),p(X,Y+h,Z+d)];
  const r=[p(X+w,Y+h,Z),p(X+w,Y,Z),p(X+w,Y,Z+d),p(X+w,Y+h,Z+d)];
  const f=[p(X,Y+h,Z+d),p(X+w,Y+h,Z+d),p(X+w,Y,Z+d),p(X,Y,Z+d)];
  if(mode==='points'){
    x.fillStyle=col; [t[0],t[1],t[2],r[1],f[3]].forEach(q=>{x.beginPath();x.arc(q[0],q[1],2.2*devicePixelRatio,0,6.28);x.fill()});
    return;
  }
  const solid=mode==='solid';
  fillPoly(t, solid?'#64748b':col);
  fillPoly(r, solid?'#475569':'rgba(0,0,0,.22)');
  fillPoly(f, solid?'#334155':'rgba(0,0,0,.16)');
}
function draw(){
  x.fillStyle='#081210'; x.fillRect(0,0,c.width,c.height);
  if(L.terrain){
    x.beginPath(); const g=iso(0,0,0);
    x.ellipse(g[0],g[1],240*devicePixelRatio*sc,95*devicePixelRatio*sc,0,0,6.28);
    x.fillStyle=S==='disaster'?'#3f3a2e':(mode==='solid'?'#1A2C27':'#16382C'); x.fill();
  }
  if(L.roads){
    box(-1.2,0,-14,2.4,0.12,28,'#2a2f3a');
    box(-12,0,4,24,0.1,2.2,'#2a2f3a');
  }
  if(L.buildings){
    if(S!=='highway'){ box(-9,0,-7,5.5,9,5,'#64748b'); box(-2,0,-12,4,14,4,'#94a3b8'); box(8,0,-8,7,6,5,'#7c8aa0'); box(7,0,10,5,11,5,'#5b6b82'); box(-14,0,8,6,4.5,8,'#6b7280'); }
    else { box(-12,0,-8,3,2.4,3,'#64748b'); box(10,0,-14,2.6,1.8,2.6,'#78716c'); }
    if(S==='campus') box(-6,0,-20,14,3.6,7,'#93c5fd');
  }
  if(L.vegetation){
    for(let i=0;i<10;i++) box((i%2?1:-1)*(9+(i%4)*2),0,-18+i*3.2,1.1,2.8+(i%3)*0.4,1.1,'#166534');
  }
  if(L.dynamic){
    box(-3,0.12,2,1.8,0.7,1,'#ef4444'); box(4,0.12,-3,1.6,0.65,0.9,'#f59e0b');
  }
  picks.forEach(p=>{x.fillStyle='#22c55e';x.beginPath();x.arc(p[0],p[1],5*devicePixelRatio,0,6.28);x.fill()});
}
function setStat(t){document.getElementById('stat').textContent=t}
function onTap(px,py){
  picks.push([px*devicePixelRatio, py*devicePixelRatio]);
  if(measure==='coord'){
    const m={type:'coord',x:+(px/innerWidth*80-40).toFixed(1),y:0,z:+(py/innerHeight*80-40).toFixed(1)};
    setStat(m.x+', 0, '+m.z); post(m); picks=[];
  } else if(measure==='distance' && picks.length===2){
    const d=Math.hypot(picks[0][0]-picks[1][0],picks[0][1]-picks[1][1])/(devicePixelRatio*8);
    const meters=+d.toFixed(1); setStat(meters+' m'); post({type:'distance',meters}); picks=[];
  } else if(measure==='height' && picks.length===2){
    const h=Math.abs(picks[0][1]-picks[1][1])/(devicePixelRatio*10);
    const meters=+h.toFixed(1); setStat('H '+meters+' m'); post({type:'height',meters}); picks=[];
  } else if(measure==='area' && picks.length===3){
    const a=picks; const area=+(Math.abs((a[0][0]*(a[1][1]-a[2][1])+a[1][0]*(a[2][1]-a[0][1])+a[2][0]*(a[0][1]-a[1][1]))/2)/(devicePixelRatio*devicePixelRatio*70)).toFixed(1);
    setStat(area+' m²'); post({type:'area',meters:area}); picks=[];
  }
  draw();
}
let lx=0,ly=0,drag=false,pinch=0,base=1;
c.addEventListener('touchstart',e=>{
  if(e.touches.length===1){drag=true;lx=e.touches[0].clientX;ly=e.touches[0].clientY;c._t=Date.now();c._sx=lx;c._sy=ly}
  if(e.touches.length===2){pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);base=sc}
},{passive:true});
c.addEventListener('touchmove',e=>{
  if(e.touches.length===2 && pinch){ const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); sc=Math.min(2.4,Math.max(0.55,base*(d/pinch))); draw(); return; }
  if(!drag) return;
  const tx=e.touches[0].clientX, ty=e.touches[0].clientY;
  if(nav==='pan'){ ox+=(tx-lx)*devicePixelRatio; oy+=(ty-ly)*devicePixelRatio; }
  else { ang+=(tx-lx)*0.01; pit=Math.min(1.1,Math.max(0.22,pit+(ty-ly)*0.004)); }
  lx=tx; ly=ty; draw();
},{passive:true});
c.addEventListener('touchend',e=>{
  if(!e.touches.length){
    if(Date.now()-(c._t||0)<200 && Math.hypot((e.changedTouches[0].clientX-(c._sx||0)),(e.changedTouches[0].clientY-(c._sy||0)))<8){
      onTap(e.changedTouches[0].clientX,e.changedTouches[0].clientY);
    }
    drag=false; pinch=0;
  }
},{passive:true});
window.setLayers=function(n){Object.assign(L,n);draw()};
window.setMode=function(m){mode=m;draw()};
window.setNav=function(n){nav=n;setStat((n==='pan'?'Pan':'Orbit')+' · '+measure)};
window.setMeasure=function(m){measure=m;picks=[];setStat('Measure: '+m)};
window.setView=function(v){
  if(v==='reset'){ang=0.72;pit=0.55;sc=1;ox=0;oy=0}
  if(v==='top'){ang=0;pit=0.12;sc=1.15;ox=0;oy=20}
  if(v==='side'){ang=0;pit=0.95;sc=1.05;ox=0;oy=0}
  draw();
};
addEventListener('resize',resize); resize();
</script></body></html>`;
}
