/**
 * Graze behaviour QA: when the muzzle reaches grazing height, how long it
 * stays there, what fraction of the clip is genuinely feeding, and whether the
 * head-down grazing section loops.
 *   node scripts/buffalo-graze-qa.mjs <glb>
 */
import { readFileSync } from "node:fs";
const b=readFileSync(process.argv[2]);let o=12,json,bin;
while(o<b.length){const l=b.readUInt32LE(o),t=b.readUInt32LE(o+4);const d=b.subarray(o+8,o+8+l);
 if(t===0x4e4f534a)json=JSON.parse(d.toString("utf8"));else if(t===0x004e4942)bin=d;o+=8+l;}
const acc=json.accessors,NUM={SCALAR:1,VEC3:3,VEC4:4};
const rd=i=>{const a=acc[i],v=json.bufferViews[a.bufferView];const n=NUM[a.type];const st=v.byteStride||n*4;const base=(v.byteOffset??0)+(a.byteOffset??0);const out=[];for(let k=0;k<a.count;k++){const r=[];for(let c=0;c<n;c++)r.push(bin.readFloatLE(base+k*st+c*4));out.push(n===1?r[0]:r);}return out;};
const qmul=(a,c)=>[a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1],a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0],a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3],a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qrot=(q,v)=>{const u=[q[0],q[1],q[2]],s=q[3];const uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]];return [v[0]+2*(s*uv[0]+uuv[0]),v[1]+2*(s*uv[1]+uuv[1]),v[2]+2*(s*uv[2]+uuv[2])];};
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const joints=json.skins[0].joints,nm=i=>json.nodes[i].name,idBy=Object.fromEntries(joints.map(j=>[nm(j),j]));
const parent=new Map();json.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parent.set(c,i)));
const restT=i=>json.nodes[i].translation??[0,0,0],restR=i=>json.nodes[i].rotation??[0,0,0,1];
const ARM=parent.get(idBy.Hips),ARM_R=restR(ARM),ARM_T=restT(ARM);
function fk(local){const pos=new Map(),rot=new Map();const solve=i=>{if(pos.has(i))return;const lt=local.get(i)?.t??restT(i),lr=local.get(i)?.r??restR(i);const p=parent.get(i);if(p==null||!joints.includes(p)){pos.set(i,vadd(ARM_T,qrot(ARM_R,lt)));rot.set(i,qmul(ARM_R,lr));return;}solve(p);pos.set(i,vadd(pos.get(p),qrot(rot.get(p),lt)));rot.set(i,qmul(rot.get(p),lr));};for(const x of joints)solve(x);return {pos,rot};}
const w=json.animations.find(a=>a.name==="Walk"),w0=new Map();
for(const ch of w.channels){const s=w.samplers[ch.sampler];const v=rd(s.output);const e=w0.get(ch.target.node)??{};if(ch.target.path==="rotation")e.r=v[0];if(ch.target.path==="translation")e.t=v[0];w0.set(ch.target.node,e);}
const sp=fk(new Map(joints.map(j=>[j,{r:w0.get(j)?.r??restR(j),t:w0.get(j)?.t??restT(j)}]))).pos;
const G=Math.min(sp.get(idBy.frontleg2)[1],sp.get(idBy.R_frontleg2)[1],sp.get(idBy.backleg2)[1],sp.get(idBy.R_backleg2)[1]);
const H=sp.get(idBy.Hips)[1]-G;
const clip=json.animations.find(a=>a.name==="Graze");
const chans={};for(const ch of clip.channels){(chans[ch.target.node]??={})[ch.target.path]=rd(clip.samplers[ch.sampler].output);}
const F=Math.max(...Object.values(chans).map(c=>(c.rotation?.length??c.translation?.length??1)));
const FPS=30, dur=(F-1)/FPS;
const poseAt=f=>new Map(joints.map(j=>{const c=chans[j];return [j,{r:c?.rotation?.[Math.min(f,(c.rotation?.length??1)-1)]??restR(j),t:c?.translation?.[Math.min(f,(c.translation?.length??1)-1)]??restT(j)}];}));
const mz=[];for(let f=0;f<F;f++) mz.push((fk(poseAt(f)).pos.get(idBy.headend)[1]-G)/H);
const GRAZE_H=0.12;                      // muzzle at/below 12% of hip height = at the grass
let firstDown=-1; for(let f=0;f<F;f++) if(mz[f]<=GRAZE_H){firstDown=f;break;}
let downCount=mz.filter(v=>v<=GRAZE_H).length;
// longest continuous run at grazing height
let best=0,cur=0; for(const v of mz){ if(v<=GRAZE_H){cur++;best=Math.max(best,cur);} else cur=0; }
console.log(`Graze: ${F} frames, ${dur.toFixed(2)}s @${FPS}fps  (0% = ground, standing muzzle = 25%)`);
console.log(`  muzzle reaches grazing height (<=${(GRAZE_H*100)|0}%) at: ${(firstDown/FPS).toFixed(2)}s (frame ${firstDown})`);
console.log(`  longest continuous head-down run: ${(best/FPS).toFixed(2)}s`);
console.log(`  frames at grazing height: ${downCount}/${F} = ${(100*downCount/F).toFixed(1)}% of clip`);
console.log(`  muzzle ever back above 50% of hip height: ${mz.some(v=>v>0.5)?"YES":"NO"}`);
console.log(`\n  sampled every 0.25s (muzzle %):`);
let row=[];for(let s2=0;s2<=dur+1e-9;s2+=0.25){const f=Math.min(F-1,Math.round(s2*FPS));row.push(`${s2.toFixed(2)}s:${(mz[f]*100).toFixed(0)}%`);}
console.log("   "+row.join("  "));
// sub-loop continuity over [1.2s, 6.0s]
const a=Math.round(1.2*FPS), z=F-1;
const ang=(p,q)=>{let d=Math.abs(p[0]*q[0]+p[1]*q[1]+p[2]*q[2]+p[3]*q[3]);d=Math.min(1,d);return 2*Math.acos(d)*180/Math.PI;};
const Pa=poseAt(a), Pz=poseAt(z), Pa1=poseAt(a+1), Pz1=poseAt(z-1);
let poseGap=0, velGap=0;
for(const j of joints){ poseGap=Math.max(poseGap, ang(Pa.get(j).r, Pz.get(j).r));
  velGap=Math.max(velGap, Math.abs(ang(Pz1.get(j).r,Pz.get(j).r) - ang(Pa.get(j).r,Pa1.get(j).r))); }
console.log(`\n  SUB-LOOP [1.20s..${dur.toFixed(2)}s]: pose gap ${poseGap.toFixed(2)}deg, velocity gap ${velGap.toFixed(2)}deg/frame  -> ${poseGap<1.5&&velGap<5?"PASS":"CHECK"}`);
console.log(`  final pose is head-down: ${mz[F-1]<=GRAZE_H?"YES":"NO"} (muzzle ${(mz[F-1]*100).toFixed(0)}%)`);
