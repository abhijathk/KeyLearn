/**
 * Anatomical fold-direction QA for every leg on every frame of every clip.
 *
 * A quadruped's legs bend one way only:
 *   FORELEG  — elbow and carpus close BACKWARD (behind the shoulder->hoof line)
 *   HIND LEG — stifle and hock close FORWARD  (ahead of the hip->hoof line)
 *
 * The correct sign per leg is not assumed: it is measured from the source Walk,
 * which is the approved reference. Any frame in any clip whose joint crosses to
 * the wrong side of that line is a joint bending the way the animal cannot.
 *
 *   node scripts/buffalo-anatomy-qa.mjs <glb>
 */
import { readFileSync } from "node:fs";
const b = readFileSync(process.argv[2]);
let o = 12, json, bin;
while (o < b.length) { const l=b.readUInt32LE(o), t=b.readUInt32LE(o+4); const d=b.subarray(o+8,o+8+l);
  if (t===0x4e4f534a) json=JSON.parse(d.toString("utf8")); else if (t===0x004e4942) bin=d; o+=8+l; }
const acc=json.accessors, NUM={SCALAR:1,VEC3:3,VEC4:4};
const rd=i=>{const a=acc[i],v=json.bufferViews[a.bufferView];const n=NUM[a.type];const st=v.byteStride||n*4;
  const base=(v.byteOffset??0)+(a.byteOffset??0);const out=[];
  for(let k=0;k<a.count;k++){const r=[];for(let c=0;c<n;c++)r.push(bin.readFloatLE(base+k*st+c*4));out.push(n===1?r[0]:r);}return out;};
const qmul=(a,c)=>[a[3]*c[0]+a[0]*c[3]+a[1]*c[2]-a[2]*c[1],a[3]*c[1]-a[0]*c[2]+a[1]*c[3]+a[2]*c[0],a[3]*c[2]+a[0]*c[1]-a[1]*c[0]+a[2]*c[3],a[3]*c[3]-a[0]*c[0]-a[1]*c[1]-a[2]*c[2]];
const qrot=(q,v)=>{const u=[q[0],q[1],q[2]],s=q[3];const uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]];return [v[0]+2*(s*uv[0]+uuv[0]),v[1]+2*(s*uv[1]+uuv[1]),v[2]+2*(s*uv[2]+uuv[2])];};
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vlen=a=>Math.hypot(...a), vdot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const vscale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s], vnorm=a=>{const l=vlen(a)||1;return[a[0]/l,a[1]/l,a[2]/l];};
const joints=json.skins[0].joints, nm=i=>json.nodes[i].name;
const idBy=Object.fromEntries(joints.map(j=>[nm(j),j]));
const parent=new Map(); json.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parent.set(c,i)));
const restT=i=>json.nodes[i].translation??[0,0,0], restR=i=>json.nodes[i].rotation??[0,0,0,1];
const ARM=parent.get(idBy.Hips), ARM_R=ARM!=null?restR(ARM):[0,0,0,1], ARM_T=ARM!=null?restT(ARM):[0,0,0];
function fk(local){const pos=new Map(),rot=new Map();const solve=i=>{if(pos.has(i))return;
  const lt=local.get(i)?.t??restT(i), lr=local.get(i)?.r??restR(i); const p=parent.get(i);
  if(p==null||!joints.includes(p)){pos.set(i,vadd(ARM_T,qrot(ARM_R,lt)));rot.set(i,qmul(ARM_R,lr));return;}
  solve(p);pos.set(i,vadd(pos.get(p),qrot(rot.get(p),lt)));rot.set(i,qmul(rot.get(p),lr));};
  for(const j of joints)solve(j);return pos;}
const LEGS={LF:["frontleg","frontleg0","frontleg1","frontleg2"],RF:["R_frontleg","R_frontleg0","R_frontleg1","R_frontleg2"],
            LB:["backleg","backleg0","backleg1","backleg2"],RB:["R_backleg","R_backleg0","R_backleg1","R_backleg2"]};
const walk=json.animations.find(a=>a.name==="Walk")??json.animations[0];
function framesOf(clip){const ch={};for(const c of clip.channels){(ch[c.target.node]??={})[c.target.path]=rd(clip.samplers[c.sampler].output);}
  const F=Math.max(...Object.values(ch).map(x=>(x.rotation?.length??x.translation?.length??1)));
  const out=[];for(let f=0;f<F;f++)out.push(fk(new Map(joints.map(j=>{const c=ch[j];
    return [j,{r:c?.rotation?.[Math.min(f,(c.rotation?.length??1)-1)]??restR(j),
               t:c?.translation?.[Math.min(f,(c.translation?.length??1)-1)]??restT(j)}];}))));
  return out;}
const W=framesOf(walk);
// body frame from the walk's first pose
const p0=W[0];
const feet0=vscale(["frontleg2","R_frontleg2","backleg2","R_backleg2"].map(n=>p0.get(idBy[n]))
  .reduce((a,c)=>vadd(a,c),[0,0,0]),0.25);
const UP=vnorm(vsub(p0.get(idBy.Hips),feet0));
let FWD=vsub(p0.get(idBy.head),p0.get(idBy.Hips)); FWD=vnorm(vsub(FWD,vscale(UP,vdot(FWD,UP))));
// signed perpendicular offset of a joint from the root->hoof line, along FWD
function offs(P,k){const ch=LEGS[k].map(n=>idBy[n]);
  const root=P.get(ch[0]),hoof=P.get(ch[3]);const d=vnorm(vsub(hoof,root));
  return [1,2].map(i=>{const v=vsub(P.get(ch[i]),root);const perp=vsub(v,vscale(d,vdot(v,d)));return vdot(perp,FWD)*1000;});}
// reference sign per leg, from the walk frames where the leg is most bent
const SIGN={};
for(const k in LEGS){const ch=LEGS[k].map(n=>idBy[n]);
  let sum=[0,0],n=0;
  for(const P of W){const root=P.get(ch[0]),hoof=P.get(ch[3]);
    let tot=0;for(let i=0;i<3;i++)tot+=vlen(vsub(P.get(ch[i+1]),P.get(ch[i])));
    if(vlen(vsub(hoof,root))/tot>0.93)continue;           // nearly straight: sign is noise
    const e=offs(P,k);sum[0]+=e[0];sum[1]+=e[1];n++;}
  SIGN[k]=[Math.sign(sum[0]/(n||1)),Math.sign(sum[1]/(n||1))];}
console.log("fold direction learned from the source Walk (+ = forward, - = backward):");
for(const k in SIGN)console.log(`  ${k}: joint1 ${SIGN[k][0]>0?"FORWARD":"BACKWARD"}   joint2 ${SIGN[k][1]>0?"FORWARD":"BACKWARD"}`);
const TOL=0.02;   // mm of wrong-side offset tolerated before it counts
console.log("\nclip                      wrong-way frames (leg:joint)                       worst");
let bad=0;
for(const clip of json.animations){
  const P=framesOf(clip); const hits={}; let worst=0, worstAt="";
  for(let f=0;f<P.length;f++){
    for(const k in LEGS){
      const ch=LEGS[k].map(n=>idBy[n]);
      const root=P[f].get(ch[0]),hoof=P[f].get(ch[3]);
      let tot=0;for(let i=0;i<3;i++)tot+=vlen(vsub(P[f].get(ch[i+1]),P[f].get(ch[i])));
      if(vlen(vsub(hoof,root))/tot>0.93)continue;        // straight leg: no meaningful fold side
      const e=offs(P[f],k);
      for(let j=0;j<2;j++){
        const wrong=-SIGN[k][j]*e[j];                     // >0 means on the forbidden side
        if(wrong>TOL){const key=`${k}:j${j+1}`;hits[key]=(hits[key]||0)+1;
          if(wrong>worst){worst=wrong;worstAt=`${key}@f${f}`;}}}}}
  const list=Object.entries(hits).map(([k,v])=>`${k}x${v}`).join(" ");
  if(list){bad++;console.log(`  ${clip.name.padEnd(24)} ${list.padEnd(50)} ${worst.toFixed(2)} ${worstAt}`);}
}
console.log(bad? `\n${bad} clip(s) contain joints bending the wrong way` : "\nno joint bends the wrong way in any clip");
