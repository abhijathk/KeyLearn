import { readFileSync } from "node:fs";
const b = readFileSync(process.argv[2]);
let o=12,g=null,bin=null;
while(o+8<=b.length){const l=b.readUInt32LE(o),t=b.readUInt32LE(o+4);const d=b.subarray(o+8,o+8+l);if(t===0x4e4f534a)g=JSON.parse(d.toString("utf8"));if(t===0x004e4942)bin=d;o+=8+l;}
const acc=g.accessors;const rd=(i)=>{const a=acc[i],v=g.bufferViews[a.bufferView];const n={SCALAR:1,VEC3:3,VEC4:4}[a.type];const st=v.byteStride||n*4,base=(v.byteOffset??0)+(a.byteOffset??0);const out=[];for(let k=0;k<a.count;k++){const r=[];for(let c=0;c<n;c++)r.push(bin.readFloatLE(base+k*st+c*4));out.push(n===1?r[0]:r);}return out;};
const qmul=(a,c)=>[a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1],a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0],a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3],a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qrot=(q,v)=>{const u=[q[0],q[1],q[2]],s=q[3];const uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]];return [v[0]+2*(s*uv[0]+uuv[0]),v[1]+2*(s*uv[1]+uuv[1]),v[2]+2*(s*uv[2]+uuv[2])];};
const slerp=(a,c,t)=>{let d=a[0]*c[0]+a[1]*c[1]+a[2]*c[2]+a[3]*c[3];let cc=c;if(d<0){d=-d;cc=c.map(x=>-x);}if(d>0.9995){const r=a.map((x,i)=>x+t*(cc[i]-x));const L=Math.hypot(...r);return r.map(x=>x/L);}const th=Math.acos(d),s=Math.sin(th);return a.map((x,i)=>Math.sin((1-t)*th)/s*x+Math.sin(t*th)/s*cc[i]);};
const joints=g.skins[0].joints;const nm=(i)=>g.nodes[i].name;const byName=Object.fromEntries(joints.map(j=>[nm(j),j]));
const parent=new Map();g.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parent.set(c,i)));
const restT=(i)=>g.nodes[i].translation??[0,0,0],restR=(i)=>g.nodes[i].rotation??[0,0,0,1];
const ARM=parent.get(byName.Hips),AR=restR(ARM),AT=restT(ARM);
function sample(anim){const dur=Math.max(...anim.samplers.map(s=>acc[s.input].max[0]));const N=Math.round(dur*30)+1;const tr=new Map();for(const ch of anim.channels){if(ch.target.path==="scale")continue;const s=anim.samplers[ch.sampler],ti=rd(s.input),va=rd(s.output);const pf=[];for(let f=0;f<N;f++){const tt=Math.min(dur,f/30);let k=0;while(k<ti.length-1&&ti[k+1]<=tt)k++;const k2=Math.min(ti.length-1,k+1);const u=ti[k2]===ti[k]?0:(tt-ti[k])/(ti[k2]-ti[k]);pf.push(ch.target.path==="rotation"?slerp(va[k],va[k2],u):va[k].map((x,i)=>x+u*(va[k2][i]-x)));}const e=tr.get(ch.target.node)??{};e[ch.target.path==="rotation"?"r":"t"]=pf;tr.set(ch.target.node,e);}
  const frames=[];for(let f=0;f<N;f++){const pos=new Map(),rot=new Map();const solve=(i)=>{if(pos.has(i))return;const lt=tr.get(i)?.t?.[f]??restT(i),lr=tr.get(i)?.r?.[f]??restR(i);const p=parent.get(i);if(p==null||!joints.includes(p)){pos.set(i,[AT[0]+qrot(AR,lt)[0],AT[1]+qrot(AR,lt)[1],AT[2]+qrot(AR,lt)[2]]);rot.set(i,qmul(AR,lr));return;}solve(p);const w=qrot(rot.get(p),lt);pos.set(i,[pos.get(p)[0]+w[0],pos.get(p)[1]+w[1],pos.get(p)[2]+w[2]]);rot.set(i,qmul(rot.get(p),lr));};for(const j of joints)solve(j);frames.push(pos);}
  return {N,dur,frames};}
const walk=sample(g.animations.find(a=>a.name==="Walk"));
const hooves=["frontleg2","R_frontleg2","backleg2","R_backleg2"];
let ground=Infinity;for(const p of walk.frames)for(const h of hooves)ground=Math.min(ground,p.get(byName[h])[1]);
const walkLift=(()=>{let mx=-Infinity;for(const p of walk.frames)for(const h of hooves)mx=Math.max(mx,p.get(byName[h])[1]);return mx-ground;})();
const rs=sample(g.animations.find(a=>a.name==="Supernatural_Rear_Stomp"));
const bh=(()=>{let lo=Infinity,hi=-Infinity;const p=walk.frames[0];for(const j of joints){const y=p.get(j)[1];lo=Math.min(lo,y);hi=Math.max(hi,y);}return hi-lo;})();
console.log(`ground ${ground.toFixed(4)}  walkLift ${walkLift.toFixed(4)}  bodyHeight ${bh.toFixed(4)}`);
const front=["frontleg2","R_frontleg2"], hind=["backleg2","R_backleg2"];
const fmt=(f)=>`${(f/30).toFixed(2)}s(f${f})`;
let firstFrontOff=-1, apex=0, apexF=0, impactF=-1, prevAllDown=true;
for(let f=0;f<rs.N;f++){const p=rs.frames[f];
  const fy=front.map(h=>p.get(byName[h])[1]-ground), hy=hind.map(h=>p.get(byName[h])[1]-ground);
  const frontOff=Math.min(...fy)>0.4*walkLift;
  if(frontOff&&firstFrontOff<0)firstFrontOff=f;
  const meanFront=(fy[0]+fy[1])/2; if(meanFront>apex){apex=meanFront;apexF=f;}
}
// impact: after apex, first frame both front hooves return to near ground
for(let f=apexF;f<rs.N;f++){const p=rs.frames[f];const fy=front.map(h=>p.get(byName[h])[1]-ground);if(Math.max(...fy)<0.3*walkLift){impactF=f;break;}}
// penetration frames
const PEN=0.25*walkLift; const pen=[];
for(let f=0;f<rs.N;f++){const p=rs.frames[f];for(const h of hooves){const y=p.get(byName[h])[1];if(y<ground-PEN)pen.push([f,h,(ground-y).toFixed(4)]);}}
// hind slide during rear
let hindSlide=0;for(let f=1;f<rs.N;f++){for(const h of hind){const a=rs.frames[f-1].get(byName[h]),c=rs.frames[f].get(byName[h]);if(a[1]<ground+0.12*walkLift&&c[1]<ground+0.12*walkLift&&Math.hypot(c[0]-a[0],c[2]-a[2])>walkLift*0.06)hindSlide++;}}
console.log(`\nfront hooves leave ground:   ${firstFrontOff<0?"NEVER":fmt(firstFrontOff)}`);
console.log(`max front-hoof height:       ${apex.toFixed(4)} (${(apex/bh*100).toFixed(0)}% of body height) at ${fmt(apexF)}`);
console.log(`double-hoof impact (return): ${impactF<0?"?":fmt(impactF)}  normalized ${impactF<0?"?":(impactF/(rs.N-1)).toFixed(3)}`);
console.log(`hind-hoof slide frames:      ${hindSlide}`);
console.log(`ground penetration:          ${pen.length?JSON.stringify(pen):"none"}`);
// front hoof simultaneity at impact
if(impactF>0){const p=rs.frames[impactF];const l=p.get(byName.frontleg2)[1]-ground,r=p.get(byName.R_frontleg2)[1]-ground;console.log(`front hooves at impact: L=${l.toFixed(4)} R=${r.toFixed(4)} (near-simultaneous if close)`);}
