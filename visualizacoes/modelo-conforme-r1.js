'use strict';
const $ = id => document.getElementById(id);
const canvas = $('scene'), ctx = canvas.getContext('2d');
const state = {a:-0.5, x:1, limit:2, yaw:-0.65, pitch:0.35, zoom:1, cone:true, plane:true, guides:true, lower:false, product:false};
let width=1, height=1, scale=1, frame=0, centreU=0, centreV=0;
const pointers = new Map();
let previous=null, pinch=0, dragged=false, down=null;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const format = n => (Math.abs(n)<0.00005?0:n).toLocaleString('pt-BR',{maximumFractionDigits:4});
// Coordenadas internas sempre na base principal (e1,e0,e_infinito).
const conformal = x => [x,1,x*x/2];
const toDiagonal = p => [p[0],p[2]-p[1]/2,p[2]+p[1]/2];
const fromDiagonal = p => [p[0],p[2]-p[1],(p[2]+p[1])/2];
const displayCoordinates = p => toDiagonal(p);
const axisPoint = p => fromDiagonal(p);
const inner = (u,v) => u[0]*v[0]-u[1]*v[2]-u[2]*v[1];
function geometry(){
 const a=state.a,b=state.x,A=conformal(a),B=conformal(b),Q=[b,1,a*b-a*a/2];
 const tangent=s=>[s,1,a*s-a*a/2];
 return {a,b,A,B,Q,tangent,gap:(b-a)*(b-a)/2};
}
// Informational text may be removed from the HTML without disabling the scene.
function setReadout(id,text){
 const element=$(id);
 if(element)element.textContent=text;
}
function updateReadout(){
 const {a,b,A,B,Q,gap}=geometry();
 const xhat=B;
 $("number-basic").value=b;
 setReadout('diagonal',"("+toDiagonal(xhat).map(format).join("; ")+")");
 setReadout('null',"("+xhat.map(format).join("; ")+")");
 setReadout('null-check',format(inner(B,B)));
 setReadout('plane-check',format(B[1]));
 $('parameter').value=b;$('parameter-a').value=a;
 if(document.activeElement!==$('number'))$('number').value=b;
 if(document.activeElement!==$('number-a'))$('number-a').value=a;
 setReadout('distance',format(Math.abs(b-a)));
 const product=-gap;
 setReadout('product',format(product));setReadout('gap',format(gap));
 setReadout('distance-calculation','√(2 × '+format(-product)+')');
 setReadout('distance-product',format(Math.sqrt(Math.max(0,-2*product))));
 setReadout('coincident-note',a===b?'A = B = Q: o segmento desaparece e o produto é zero.':'O segmento rosa cresce com o quadrado da distância na reta.');
 schedule();
}
function selectX(value){if(!Number.isFinite(value))return;state.x=Math.round(clamp(value,-state.limit,state.limit)*100)/100;updateReadout();}
function selectA(value){if(!Number.isFinite(value))return;state.a=Math.round(clamp(value,-state.limit,state.limit)*100)/100;updateReadout();}
function camera(p) {
 p=displayCoordinates(p);
 const c=Math.cos(state.yaw),s=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
 const z=p[2]-0.5;
 return {u:c*p[0]+s*p[1],v:-s*sp*p[0]+c*sp*p[1]+cp*z,d:s*cp*p[0]-c*cp*p[1]+sp*z};
}
function project(p) {const t=camera(p);return {x:width/2+scale*(t.u-centreU),y:height/2-scale*(t.v-centreV),d:t.d};}
function schedule(){if(!frame) frame=requestAnimationFrame(()=>{frame=0;draw();});}
function resize(){const box=canvas.getBoundingClientRect();width=box.width;height=box.height;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);schedule();}
function stroke(points,color,lw=1,dash=[]){ctx.beginPath();for(let i=0;i<points.length;i++){const p=project(points[i]);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
function label(p,text,color='#65717c',dx=8,dy=-8){
 const q=project(p);let x=q.x+dx;const y=q.y+dy;
 ctx.font='13px Georgia';ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineWidth=4;ctx.strokeStyle='#fcfcf9';ctx.fillStyle=color;
 const letters=Array.from(text.normalize('NFD'));
 for(let i=0;i<letters.length;i++){
  const letter=letters[i],hat=letters[i+1]==='\u0302'&&['a','b','x'].includes(letter)&&!/[\p{L}\p{N}]/u.test(letters[i-1]||'')&&!/[\p{L}\p{N}]/u.test(letters[i+2]||'');if(hat)i++;
  ctx.strokeText(letter,x,y);ctx.fillText(letter,x,y);
  const w=ctx.measureText(letter).width;
  if(hat){
   const cx=x+w/2,cy=y-7;
   ctx.beginPath();ctx.moveTo(cx-3,cy);ctx.lineTo(cx,cy-3);ctx.lineTo(cx+3,cy);
   ctx.lineWidth=3.5;ctx.strokeStyle='#fcfcf9';ctx.stroke();
   ctx.lineWidth=1;ctx.strokeStyle=color;ctx.stroke();
   ctx.lineWidth=4;ctx.strokeStyle='#fcfcf9';
  }
  x+=w;
 }
}
function dot(p,color,r=5){const q=project(p);ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
function arrow(a,b,color){
 stroke([a,b],color,2.5,[6,5]);
 const p=project(a),q=project(b),length=Math.hypot(q.x-p.x,q.y-p.y);
 if(length<1)return;
 const ux=(q.x-p.x)/length,uy=(q.y-p.y)/length,size=Math.min(10,length*.35);
 ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-size*ux+size*.45*uy,q.y-size*uy-size*.45*ux);ctx.lineTo(q.x-size*ux-size*.45*uy,q.y-size*uy+size*.45*ux);ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function draw(){
 ctx.clearRect(0,0,width,height);
 const L=state.limit,H=Math.max(2,(L*L+1)/2+.25);
 const g=geometry(),left=Math.min(g.a,g.b)-.3,right=Math.max(g.a,g.b)+.3;
 const tangentEnds=[g.tangent(left),g.tangent(right)];
 const bottom=state.product?Math.min(-.2,g.Q[2]-.2):-.2,top=state.product?Math.max(H-.5,g.A[2]+.2,g.B[2]+.2):H-.5;
 const corner=[[-L-.3,1,bottom],[L+.3,1,bottom],[L+.3,1,top],[-L-.3,1,top]];
 const bounds=[...(state.product?[...tangentEnds,g.Q,g.A,g.B]:[]),[0,0,0],[-L-.25,0,0],[L+.25,0,0],...corner,axisPoint([0,-H,0]),axisPoint([0,H,0]),axisPoint([0,0,-.4]),axisPoint([0,0,H])];
 for(const sign of state.lower?[1,-1]:[1])for(let j=0;j<80;j++){const a=j*Math.PI/40;bounds.push(fromDiagonal([H*Math.cos(a),H*Math.sin(a),sign*H]));}
 const views=bounds.map(camera),us=views.map(p=>p.u),vs=views.map(p=>p.v);
 const minU=Math.min(...us),maxU=Math.max(...us),minV=Math.min(...vs),maxV=Math.max(...vs);
 centreU=(minU+maxU)/2;centreV=(minV+maxV)/2;
 scale=Math.min(Math.max(100,width-90)/(maxU-minU),Math.max(100,height-90)/(maxV-minV))*state.zoom;
 const objects=[];
 function line(a,b,color,lw=1){objects.push({points:[a,b],color,lw,depth:(camera(a).d+camera(b).d)/2});}
 if(state.cone){
  for(const sign of state.lower?[1,-1]:[1]){
   for(let i=1;i<=8;i++){const r=H*i/8;for(let j=0;j<80;j++){const a=j*Math.PI/40,b=(j+1)*Math.PI/40;line(fromDiagonal([r*Math.cos(a),r*Math.sin(a),sign*r]),fromDiagonal([r*Math.cos(b),r*Math.sin(b),sign*r]),'#8197b03b');}}
   for(let j=0;j<20;j++){const a=j*Math.PI/10;line([0,0,0],fromDiagonal([H*Math.cos(a),H*Math.sin(a),sign*H]),'#8197b047');}
  }
 }
 if(state.plane){objects.push({points:corner,fill:'#e7b75621',color:'#bf88335c',lw:1,depth:corner.reduce((s,p)=>s+camera(p).d,0)/4});}
 for(let i=0;i<220;i++){const a=-L+2*L*i/220,b=-L+2*L*(i+1)/220;line(conformal(a),conformal(b),'#007e79',3);}
 objects.sort((a,b)=>a.depth-b.depth);
 for(const item of objects){if(item.fill){ctx.beginPath();item.points.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.fillStyle=item.fill;ctx.fill();ctx.strokeStyle=item.color;ctx.lineWidth=1;ctx.stroke();}else stroke(item.points,item.color,item.lw);}
 stroke([axisPoint([0,-H,0]),axisPoint([0,H,0])],'#9aa3a984');stroke([axisPoint([0,0,state.lower?-H:-.4]),axisPoint([0,0,H])],'#9aa3a984');
 stroke([[-L-.25,0,0],[L+.25,0,0]],'#335da9',2);
 label([L+.25,0,0],'x₁','#335da9',7,5);label(axisPoint([0,H,0]),'x₄');label(axisPoint([0,0,H]),'x₅');
 for(let k=-L;k<=L;k++){const p=project([k,0,0]);ctx.beginPath();ctx.moveTo(p.x,p.y-4);ctx.lineTo(p.x,p.y+4);ctx.strokeStyle='#335da9';ctx.lineWidth=1;ctx.stroke();label([k,0,0],String(k),'#647992',-3,16);}
 if(state.product){
 const {a,b,A,B,Q,gap}=g,baseA=[a,0,0],baseB=[b,0,0];
 if(state.guides){
  for(const [s,p,color] of [[a,A,'#c47b2070'],[b,B,'#007e7970']]){
   stroke([[s,0,0],[s,1,0],p],color,1.2,[4,5]);
  }
 }
 stroke([baseA,baseB],'#335da9',5);
 dot(baseA,'#c47b20',4);dot(baseB,'#007e79',4);
 label(baseA,'a = '+format(a),'#b46a12',-55,30);label(baseB,'b = '+format(b),'#007e79',8,44);
 label([(a+b)/2,0,0],'|b − a| = '+format(Math.abs(b-a)),'#335da9',-35,65);
 arrow([0,0,0],[0,0,1],'#8454a3');label([0,0,1],'e∞','#8454a3',10,-12);
 stroke(tangentEnds,'#c47b20',2);
 label(tangentEnds[0],'Tangente em A','#b46a12',8,16);
 stroke([Q,B],'#ad3d75',4);
 dot(Q,'#ad3d75',4);dot(A,'#c47b20',6);dot(B,'#007e79',6);
 if(a===b){label(A,'A = B = Q','#007e79',10,-18);}
 else{
  label(A,'A = â','#b46a12',-55,-16);label(B,'B = b̂','#007e79',10,-16);
  label(Q,'Q','#ad3d75',10,16);
  label([b,1,(Q[2]+B[2])/2],'Δ = −â · b̂ = '+format(gap),'#ad3d75',13,0);
 }
 }else{
 const x=state.x,base=[x,0,0],shift=[x,1,0],xhat=conformal(x);
 if(state.guides){stroke([base,shift],'#335da9aa',1.5,[5,5]);stroke([shift,xhat],'#007e79aa',1.5,[5,5]);dot(shift,'#849491',3);}
 dot([0,1,0],'#263e45',4);label([0,1,0],'e₀ = 0̂','#263e45',-30,15);
 // e infinito = (0,0,1) na base conforme e (0,1,1) na base da cena.
 arrow([0,0,0],[0,0,1],'#8454a3');label([0,0,1],'e∞ = e₄ + e₅','#8454a3',10,-12);
 dot(base,'#335da9',6);dot(xhat,'#007e79',7);
 label(base,'x = '+format(x)+' e₁','#335da9',10,-17);label(xhat,'x̂','#007e79',10,-13);
 }
 ctx.font='11px system-ui';ctx.fillStyle='#899098';ctx.textAlign='right';ctx.fillText('zoom '+Math.round(state.zoom*100)+'%',width-14,height-14);
}
function axisHover(px,py){
 const a=project([-state.limit,0,0]),b=project([state.limit,0,0]);
 const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy;
 if(n<500)return false;
 const t=((px-a.x)*dx+(py-a.y)*dy)/n;
 if(t<0||t>1)return false;
 const distance=Math.hypot(px-a.x-t*dx,py-a.y-t*dy);
 if(distance>20)return false;
 selectX((2*t-1)*state.limit,'axis');
 $('status').textContent='b = '+format(state.x)+' · distância |b − a| = '+format(Math.abs(state.x-state.a))+'.';
 return true;
}
function position(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function setZoom(value){state.zoom=clamp(value,.35,4);schedule();}
function reset(){state.yaw=-.65;state.pitch=.35;state.zoom=1;state.cone=true;state.plane=true;$('cone').checked=true;$('plane').checked=true;schedule();}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=position(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);previous=p;down=p;dragged=false;if(pointers.size===2){const v=[...pointers.values()];pinch=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);}axisHover(p.x,p.y);});
canvas.addEventListener('pointermove',e=>{
 const p=position(e);
 if(pointers.has(e.pointerId)){
  pointers.set(e.pointerId,p);
  if(pointers.size===2){const v=[...pointers.values()],d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);if(pinch>0)setZoom(state.zoom*d/pinch);pinch=d;dragged=true;return;}
  if(down&&Math.hypot(p.x-down.x,p.y-down.y)>4)dragged=true;
  if(dragged&&previous){state.yaw+=(p.x-previous.x)*.008;state.pitch=clamp(state.pitch+(p.y-previous.y)*.008,-1.45,1.45);canvas.classList.add('dragging');canvas.classList.remove('selecting');schedule();}
  previous=p;
 }else{canvas.classList.toggle('selecting',axisHover(p.x,p.y));}
});
function release(e){pointers.delete(e.pointerId);pinch=0;previous=pointers.size?[...pointers.values()][0]:null;down=previous;canvas.classList.remove('dragging');}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))release(e);});
canvas.addEventListener('pointerleave',()=>canvas.classList.remove('selecting'));
canvas.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);setZoom(state.zoom*Math.exp(-delta*.001));},{passive:false});
canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')state.yaw-=.12;if(e.key==='ArrowRight')state.yaw+=.12;if(e.key==='ArrowUp')state.pitch=clamp(state.pitch+.1,-1.45,1.45);if(e.key==='ArrowDown')state.pitch=clamp(state.pitch-.1,-1.45,1.45);if(e.key==='+'||e.key==='=')setZoom(state.zoom*1.2);if(e.key==='-')setZoom(state.zoom/1.2);if(e.key==='Home')reset();schedule();}});
$('parameter').addEventListener('input',e=>selectX(Number(e.target.value)));
$('parameter').addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const r=e.target.getBoundingClientRect(),t=clamp((e.clientX-r.left-8)/(r.width-16),0,1);selectX((2*t-1)*state.limit);});
$('number').addEventListener('input',e=>{if(e.target.value!=='')selectX(e.target.valueAsNumber,'number');});
$('number').addEventListener('blur',()=>{$('number').value=state.x;});
$('extent').addEventListener('change',e=>{state.limit=Number(e.target.value);for(const id of ['parameter','number','parameter-a','number-a']){$(id).min=-state.limit;$(id).max=state.limit;}$('tick-left').textContent='−'+state.limit;$('tick-right').textContent=state.limit;state.a=clamp(state.a,-state.limit,state.limit);selectX(state.x);$('number').value=state.x;$('number-a').value=state.a;});
for(const id of ['cone','plane','guides','lower'])$(id).addEventListener('change',e=>{state[id]=e.target.checked;schedule();});
$('zoom-in').addEventListener('click',()=>setZoom(state.zoom*1.2));$('zoom-out').addEventListener('click',()=>setZoom(state.zoom/1.2));$('reset').addEventListener('click',reset);
$('parameter-a').addEventListener('input',e=>selectA(Number(e.target.value)));
$('number-a').addEventListener('input',e=>{if(e.target.value!=='')selectA(e.target.valueAsNumber);});
$('number-a').addEventListener('blur',()=>{$('number-a').value=state.a;});
$('swap').addEventListener('click',()=>{[state.a,state.x]=[state.x,state.a];updateReadout();});
$('coincide').addEventListener('click',()=>selectX(state.a));
$('front').addEventListener('click',()=>{state.yaw=0;state.pitch=Math.PI/4;state.zoom=1;state.cone=false;state.plane=false;$('cone').checked=false;$('plane').checked=false;schedule();});
function setProduct(enabled){
 state.product=enabled;
 $('basic-panel').hidden=enabled;$('product-panel').hidden=!enabled;
 $('basic-legend').hidden=enabled;$('product-legend').hidden=!enabled;
 $('parameter').setAttribute('aria-label',enabled?'Coordenada b na reta':'Coordenada x1 na reta');
 document.querySelector('.ruler-title strong').textContent=enabled?'Mova b na reta original':'Reta original · x₁';
 $('status').textContent=enabled?'A régua e o eixo azul movem b. Ajuste a no painel ao lado.':'Passe o mouse sobre a régua ou sobre o eixo azul da cena.';
 schedule();
}
$('show-product').addEventListener('change',e=>setProduct(e.target.checked));
$('number-basic').addEventListener('input',e=>{if(e.target.value!=='')selectX(e.target.valueAsNumber);});
$('number-basic').addEventListener('blur',()=>{$('number-basic').value=state.x;});
$('extent').addEventListener('change',()=>{$('number-basic').min=-state.limit;$('number-basic').max=state.limit;});
setProduct(false);
new ResizeObserver(resize).observe(canvas);updateReadout();resize();
