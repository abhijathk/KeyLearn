/**
 * Pelvis-trajectory and hind-support audit for Supernatural_Rear_Stomp.
 *   node scripts/buffalo-rear-trajectory.mjs <glb> [clip]
 * Heights in body units (1.00 = standing hip height); +Z is forward.
 */
import { readFileSync } from "node:fs";
const b=readFileSync(process.argv[2]); let o=12,json,bin;
while(o<b.length){const l=b.readUInt32LE(o),t=b.readUInt32LE(o+4);const d=b.subarray(o+8,o+8+l);
 if(t===0x4e4f534a)json=JSON.parse(d.toString("utf8"));else if(t===0x004e4942)bin=d;o+=8+l;}
const acc=json.accessors,bvs=json.bufferViews,NUM={SCALAR:1,VEC3:3,VEC4:4};
const rd=i=>{const a=acc[i],v=bvs[a.bufferView];const n=NUM[a.type];const st=v.byteStride||n*4;
 const base=(v.byteOffset??0)+(a.byteOffset??0);const out=[];
 for(let k=0;k<a.count;k++){const r=[];for(let c=0;c<n;c++)r.push(bin.readFloatLE(base+k*st+c*4));out.push(n===1?r[0]:r);}return out;};
const qmul=(a,c)=>[a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1],a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0],a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3],a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qrot=(q,v)=>{const u=[q[0],q[1],q[2]],s=q[3];const uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]];return [v[0]+2*(s*uv[0]+uuv[0]),v[1]+2*(s*uv[1]+uuv[1]),v[2]+2*(s*uv[2]+uuv[2])];};
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],vlen=a=>Math.hypot(...a);
const joints=json.skins[0].joints,nm=i=>json.nodes[i].name;
const idByName=Object.fromEntries(joints.map(j=>[nm(j),j]));
const parent=new Map();json.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parent.set(c,i)));
const restT=i=>json.nodes[i].translation??[0,0,0],restR=i=>json.nodes[i].rotation??[0,0,0,1];
const ARM=parent.get(idByName.Hips),ARM_R=ARM!=null?restR(ARM):[0,0,0,1],ARM_T=ARM!=null?restT(ARM):[0,0,0];
function fk(local){const pos=new Map(),rot=new Map();const solve=i=>{if(pos.has(i))return;
 const lt=local.get(i)?.t??restT(i),lr=local.get(i)?.r??restR(i);const p=parent.get(i);
 if(p==null||!joints.includes(p)){pos.set(i,vadd(ARM_T,qrot(ARM_R,lt)));rot.set(i,qmul(ARM_R,lr));return;}
 solve(p);pos.set(i,vadd(pos.get(p),qrot(rot.get(p),lt)));rot.set(i,qmul(rot.get(p),lr));};
 for(const j of joints)solve(j);return pos;}
const walk=json.animations.find(a=>a.name==="Walk"),w0=new Map();
for(const ch of walk.channels){const s=walk.samplers[ch.sampler];const v=rd(s.output);const e=w0.get(ch.target.node)??{};
 if(ch.target.path==="rotation")e.r=v[0];if(ch.target.path==="translation")e.t=v[0];w0.set(ch.target.node,e);}
const sp=fk(new Map(joints.map(j=>[j,{r:w0.get(j)?.r??restR(j),t:w0.get(j)?.t??restT(j)}])));
const HOOF={LF:"frontleg2",RF:"R_frontleg2",LB:"backleg2",RB:"R_backleg2"};
const G=Math.min(...Object.values(HOOF).map(n=>sp.get(idByName[n])[1]));
const H=sp.get(idByName.Hips)[1]-G;
const Z0=sp.get(idByName.Hips)[2];
const REACH={};for(const k in HOOF){const ch=({LF:["frontleg","frontleg0","frontleg1","frontleg2"],RF:["R_frontleg","R_frontleg0","R_frontleg1","R_frontleg2"],LB:["backleg","backleg0","backleg1","backleg2"],RB:["R_backleg","R_backleg0","R_backleg1","R_backleg2"]})[k].map(n=>idByName[n]);
 let r=0;for(let i=0;i<3;i++)r+=vlen(vsub(sp.get(ch[i+1]),sp.get(ch[i])));REACH[k]=r;}
const clip=json.animations.find(a=>a.name===(process.argv[3]||"Supernatural_Rear_Stomp"));
const chans={};for(const ch of clip.channels){(chans[ch.target.node]??={})[ch.target.path]=rd(clip.samplers[ch.sampler].output);}
const F=Math.max(...Object.values(chans).map(c=>(c.rotation?.length??c.translation?.length??1)));
const P=[];for(let f=0;f<F;f++)P.push(fk(new Map(joints.map(j=>{const c=chans[j];
 return [j,{r:c?.rotation?.[Math.min(f,(c.rotation?.length??1)-1)]??restR(j),t:c?.translation?.[Math.min(f,(c.translation?.length??1)-1)]??restT(j)}];}))));
const hipY=P.map(p=>(p.get(idByName.Hips)[1]-G)/H);
const hipZ=P.map(p=>(p.get(idByName.Hips)[2]-Z0)/H);
const hoofY=k=>P.map(p=>(p.get(idByName[HOOF[k]])[1]-G)/H);
const ext=k=>P.map(p=>{const c=({LB:["backleg","backleg2"],RB:["R_backleg","R_backleg2"]})[k].map(n=>idByName[n]);
 return vlen(vsub(p.get(c[1]),p.get(c[0])))/REACH[k];});
const pk=(a,fn)=>a.reduce((b,v,i)=>fn(v,a[b])?i:b,0);
const maxF=pk(hipY,(v,b)=>v>b), minF=pk(hipY,(v,b)=>v<b);
const airF=hoofY("LF").map((v,i)=>Math.min(v,hoofY("RF")[i]));
const topAir=pk(airF,(v,b)=>v>b);
console.log(`${clip.name}  frames=${F}  (values in body units; hip height 1.00 = standing)`);
console.log(`\n  pelvis: start ${hipY[0].toFixed(2)}  min ${hipY[minF].toFixed(2)}@f${minF}  MAX ${hipY[maxF].toFixed(2)}@f${maxF}  end ${hipY[F-1].toFixed(2)}`);
console.log(`  pelvis rise above standing: ${((hipY[maxF]-1)*100).toFixed(0)}%   preload dip: ${((1-hipY[minF])*100).toFixed(0)}%`);
console.log(`  pelvis Z (fwd+) at max rear: ${hipZ[maxF].toFixed(2)}   (negative = moved BACK)`);
console.log(`\n  timeline  f: hipY hipZ | LF  RF  | LB  RB | extLB extRB`);
for(let f=0;f<F;f+=10){
  console.log(`  f${String(f).padStart(3)}: ${hipY[f].toFixed(2)} ${hipZ[f].toFixed(2).padStart(5)} | ${hoofY("LF")[f].toFixed(2).padStart(5)} ${hoofY("RF")[f].toFixed(2).padStart(5)} | ${hoofY("LB")[f].toFixed(2).padStart(5)} ${hoofY("RB")[f].toFixed(2).padStart(5)} | ${ext("LB")[f].toFixed(2)}  ${ext("RB")[f].toFixed(2)}`);
}
// high-hold window = frames where both front hooves are above 1.0
const hold=[];for(let f=0;f<F;f++) if(hoofY("LF")[f]>1.0&&hoofY("RF")[f]>1.0) hold.push(f);
if(hold.length){const a=hold[0],b=hold[hold.length-1];
  const disp=k=>{const xs=hold.map(f=>P[f].get(idByName[HOOF[k]]));
    let mn=[1e9,1e9],mx=[-1e9,-1e9];for(const q of xs){mn[0]=Math.min(mn[0],q[0]);mx[0]=Math.max(mx[0],q[0]);mn[1]=Math.min(mn[1],q[2]);mx[1]=Math.max(mx[1],q[2]);}
    return Math.hypot(mx[0]-mn[0],mx[1]-mn[1])/H;};
  const yr=k=>{const v=hold.map(f=>hoofY(k)[f]);return [Math.min(...v),Math.max(...v)];};
  console.log(`\n  HIGH HOLD (both front hooves >1.0): f${a}..f${b} (${hold.length} frames)`);
  console.log(`    LB hoof ground displacement: ${(disp("LB")*100).toFixed(0)}%  height range ${yr("LB").map(x=>x.toFixed(2)).join("..")}`);
  console.log(`    RB hoof ground displacement: ${(disp("RB")*100).toFixed(0)}%  height range ${yr("RB").map(x=>x.toFixed(2)).join("..")}`);
  console.log(`    hind extension at max rear: LB ${ext("LB")[maxF].toFixed(2)}  RB ${ext("RB")[maxF].toFixed(2)}  (1.00 = straight)`);
}
