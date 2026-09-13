/**
 * Biomechanical QA for the buffalo clips — the measurements the correction
 * brief asks for, taken by forward kinematics on every frame.
 *
 *   node scripts/buffalo-biomech-qa.mjs <glb>
 *
 * Reports, per clip: body vertical excursion (bounce), head carriage relative
 * to the withers, peak hoof lift per leg, tail elevation, and for one-shots
 * whether the clip ends where it should.
 */
import { readFileSync } from "node:fs";
const b = readFileSync(process.argv[2]);
let o = 12, json, bin;
while (o < b.length) { const l = b.readUInt32LE(o), t = b.readUInt32LE(o + 4); const d = b.subarray(o + 8, o + 8 + l); if (t === 0x4e4f534a) json = JSON.parse(d.toString("utf8")); else if (t === 0x004e4942) bin = d; o += 8 + l; }
const acc = json.accessors;
const rd = (i) => { const a = acc[i], v = json.bufferViews[a.bufferView]; const n = { SCALAR:1, VEC3:3, VEC4:4 }[a.type]; const st = v.byteStride || n*4, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0); const out = []; for (let k = 0; k < a.count; k++) { const r = []; for (let c = 0; c < n; c++) r.push(bin.readFloatLE(base + k*st + c*4)); out.push(n === 1 ? r[0] : r); } return out; };
const qmul=(a,c)=>[a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1],a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0],a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3],a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qrot=(q,v)=>{const u=[q[0],q[1],q[2]],s=q[3];const uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]];return [v[0]+2*(s*uv[0]+uuv[0]),v[1]+2*(s*uv[1]+uuv[1]),v[2]+2*(s*uv[2]+uuv[2])];};
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], vlen=(a)=>Math.hypot(...a);
const joints = json.skins[0].joints;
const nm = (i) => json.nodes[i].name;
const idByName = Object.fromEntries(joints.map((j) => [nm(j), j]));
const parent = new Map(); json.nodes.forEach((n,i) => (n.children ?? []).forEach((c) => parent.set(c,i)));
const restT=(i)=>json.nodes[i].translation??[0,0,0], restR=(i)=>json.nodes[i].rotation??[0,0,0,1];
const ARM = parent.get(idByName.Hips), ARM_R = ARM!=null?restR(ARM):[0,0,0,1], ARM_T = ARM!=null?restT(ARM):[0,0,0];
function fk(local){const pos=new Map(),rot=new Map();const solve=(i)=>{if(pos.has(i))return;const lt=local.get(i)?.t??restT(i),lr=local.get(i)?.r??restR(i);const p=parent.get(i);if(p==null||!joints.includes(p)){pos.set(i,vadd(ARM_T,qrot(ARM_R,lt)));rot.set(i,qmul(ARM_R,lr));return;}solve(p);pos.set(i,vadd(pos.get(p),qrot(rot.get(p),lt)));rot.set(i,qmul(rot.get(p),lr));};for(const j of joints)solve(j);return pos;}
const HOOF={LF:"frontleg2",RF:"R_frontleg2",LB:"backleg2",RB:"R_backleg2"};
// reference stand from the source Walk frame 0
const walk=json.animations[0]; const w0=new Map();
for(const ch of walk.channels){const s=walk.samplers[ch.sampler];const vals=rd(s.output);const e=w0.get(ch.target.node)??{};if(ch.target.path==="rotation")e.r=vals[0];if(ch.target.path==="translation")e.t=vals[0];w0.set(ch.target.node,e);}
const sp=fk(new Map(joints.map(j=>[j,{r:w0.get(j)?.r??restR(j),t:w0.get(j)?.t??restT(j)}])));
const GROUND=Math.min(...Object.values(HOOF).map(n=>sp.get(idByName[n])[1]));
const HIPH=sp.get(idByName.Hips)[1]-GROUND;             // standing hip height = the body unit
const STAND_HEAD=(sp.get(idByName.head)[1]-GROUND)/HIPH;
const pct=(v)=>(v*100).toFixed(0)+"%";
function framesOf(clip){const chans={};for(const ch of clip.channels){(chans[ch.target.node]??={})[ch.target.path]=rd(clip.samplers[ch.sampler].output);}
  const F=Math.max(...Object.values(chans).map(c=>(c.rotation?.length??c.translation?.length??1)));
  const out=[];for(let f=0;f<F;f++){out.push(fk(new Map(joints.map(j=>{const c=chans[j];return [j,{r:c?.rotation?.[Math.min(f,(c.rotation?.length??1)-1)]??restR(j),t:c?.translation?.[Math.min(f,(c.translation?.length??1)-1)]??restT(j)}];}))));}
  return out;}
console.log(`reference: hipHeight=${HIPH.toFixed(4)} (=1 body unit), ground=${GROUND.toFixed(4)}, standing head=${pct(STAND_HEAD)} of hip height\n`);
console.log("clip                      bounce  muzzle(min)  head(min..max)  peak hoof lift LF/RF/LB/RB   hoof-travel  end-hip");
for (const clip of json.animations) {
  const P=framesOf(clip);
  const hipY=P.map(p=>(p.get(idByName.Hips)[1]-GROUND)/HIPH);
  const headY=P.map(p=>(p.get(idByName.head)[1]-GROUND)/HIPH);
  const bounce=Math.max(...hipY)-Math.min(...hipY);
  const lifts={};for(const k in HOOF){lifts[k]=Math.max(...P.map(p=>(p.get(idByName[HOOF[k]])[1]-GROUND)/HIPH));}
  const tail=Math.max(...P.map(p=>(p.get(idByName.tail3)[1]-p.get(idByName.Hips)[1])/HIPH));
  const muzzle=Math.min(...P.map(p=>(p.get(idByName.headend)[1]-GROUND)/HIPH));
  // how far each hoof actually relocates on the ground plane over the clip
  let travel=0; for(const k in HOOF){const id=idByName[HOOF[k]];let mn=[1e9,1e9],mx=[-1e9,-1e9];
    for(const p of P){const q=p.get(id);mn[0]=Math.min(mn[0],q[0]);mx[0]=Math.max(mx[0],q[0]);mn[1]=Math.min(mn[1],q[2]);mx[1]=Math.max(mx[1],q[2]);}
    travel=Math.max(travel,Math.hypot(mx[0]-mn[0],mx[1]-mn[1])/HIPH);}
  console.log(
    clip.name.padEnd(25),
    pct(bounce).padStart(6),
    pct(muzzle).padStart(11),
    `${pct(Math.min(...headY))}..${pct(Math.max(...headY))}`.padStart(15),
    `  ${pct(lifts.LF)}/${pct(lifts.RF)}/${pct(lifts.LB)}/${pct(lifts.RB)}`.padEnd(28),
    pct(travel).padStart(11),
    pct(hipY[hipY.length-1]).padStart(8),
  );
}
