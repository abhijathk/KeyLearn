// Draws the buffalo skeleton as a side-view stick figure across a clip, from
// the same node-space FK the QA trusts. Bypasses Blender rendering entirely.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
const [file, clipName, outPPM] = process.argv.slice(2);
const b = readFileSync(file);
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
const anim=g.animations.find(a=>a.name===clipName);const dur=Math.max(...anim.samplers.map(s=>acc[s.input].max[0]));const N=Math.round(dur*30)+1;
const tr=new Map();for(const ch of anim.channels){if(ch.target.path==="scale")continue;const s=anim.samplers[ch.sampler],ti=rd(s.input),va=rd(s.output);const pf=[];for(let f=0;f<N;f++){const tt=Math.min(dur,f/30);let k=0;while(k<ti.length-1&&ti[k+1]<=tt)k++;const k2=Math.min(ti.length-1,k+1);const u=ti[k2]===ti[k]?0:(tt-ti[k])/(ti[k2]-ti[k]);pf.push(ch.target.path==="rotation"?slerp(va[k],va[k2],u):va[k].map((x,i)=>x+u*(va[k2][i]-x)));}const e=tr.get(ch.target.node)??{};e[ch.target.path==="rotation"?"r":"t"]=pf;tr.set(ch.target.node,e);}
function fkAt(f){const pos=new Map(),rot=new Map();const solve=(i)=>{if(pos.has(i))return;const lt=tr.get(i)?.t?.[f]??restT(i),lr=tr.get(i)?.r?.[f]??restR(i);const p=parent.get(i);if(p==null||!joints.includes(p)){pos.set(i,[AT[0]+qrot(AR,lt)[0],AT[1]+qrot(AR,lt)[1],AT[2]+qrot(AR,lt)[2]]);rot.set(i,qmul(AR,lr));return;}solve(p);const w=qrot(rot.get(p),lt);pos.set(i,[pos.get(p)[0]+w[0],pos.get(p)[1]+w[1],pos.get(p)[2]+w[2]]);rot.set(i,qmul(rot.get(p),lr));};for(const j of joints)solve(j);return pos;}
// bounds across all frames for consistent framing
let minZ=1e9,maxZ=-1e9,minY=1e9,maxY=-1e9;
for(let f=0;f<N;f++){const p=fkAt(f);for(const j of joints){const w=p.get(j);minZ=Math.min(minZ,w[2]);maxZ=Math.max(maxZ,w[2]);minY=Math.min(minY,w[1]);maxY=Math.max(maxY,w[1]);}}
const groundY=minY;
// side projection: screen x = Z (forward, +Z to the right), screen y = up (Y)
const cellW=300, cellH=380, pad=22, cols=8, rows=1;
const beats=[0.0,1.3,2.2,3.0,3.6,4.4,5.1,6.0];const FR=beats.map(b=>Math.min(N-1,Math.round(b*30)));
const W=cellW*cols, H=cellH+22;
const buf=Buffer.alloc(W*H*3, 24);
let CLIPX0=0,CLIPX1=W;const setpx=(x,y,r,gg,bl)=>{x=Math.round(x);y=Math.round(y);if(x<CLIPX0||y<0||x>=CLIPX1||x>=W||y>=H)return;const o=(y*W+x)*3;buf[o]=r;buf[o+1]=gg;buf[o+2]=bl;};
const line=(x0,y0,x1,y1,r,gg,bl)=>{const dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let er=dx-dy,x=x0,y=y0;for(let k=0;k<2000;k++){for(let a=-1;a<=1;a++)for(let bb=-1;bb<=1;bb++)setpx(x+a,y+bb,r,gg,bl);if(Math.round(x)===Math.round(x1)&&Math.round(y)===Math.round(y1))break;const e2=2*er;if(e2>-dy){er-=dy;x+=sx;}if(e2<dx){er+=dx;y+=sy;}}};
const rangeZ=Math.max(0.001,maxZ-minZ), rangeY=Math.max(0.001,maxY-groundY);
const scale=Math.min((cellW-2*pad)/rangeZ,(cellH-2*pad)/rangeY)*0.92;
// draw each frame
const BONES=joints.filter(j=>parent.has(j)&&joints.includes(parent.get(j)));
for(let ci=0;ci<cols;ci++){const f=FR[ci];const p=fkAt(f);const ox=ci*cellW;CLIPX0=ox;CLIPX1=ox+cellW;
  // ground line
  const gy=22+(cellH-pad)-((groundY-groundY)*scale);
  for(let x=0;x<cellW;x++)setpx(ox+x,gy,60,90,60);
  const sx=(z)=>ox+pad+(z-minZ)*scale;
  const sy=(y)=>22+(cellH-pad)-(y-groundY)*scale;
  for(const j of BONES){ if(/^R_/.test(nm(j))) continue; const a=p.get(parent.get(j)),c=p.get(j);
    const isLeg=/leg/i.test(nm(j)); const isHead=/head|ear|chest/i.test(nm(j)); const isTail=/tail/i.test(nm(j));
    const col=isLeg?[120,180,255]:isHead?[255,200,120]:isTail?[200,140,220]:[220,220,220];
    line(sx(a[2]),sy(a[1]),sx(c[2]),sy(c[1]),col[0],col[1],col[2]);}
  // hooves as dots
  for(const h of ["frontleg2","backleg2"]){const w=p.get(byName[h]);const front=/front/i.test(h);for(let a=-2;a<=2;a++)for(let bb=-2;bb<=2;bb++)setpx(sx(w[2])+a,sy(w[1])+bb,front?255:120,front?120:200,front?120:120);}
}
// write PPM then convert to PNG via sips
const ppm=`P6\n${W} ${H}\n255\n`;
writeFileSync(outPPM, Buffer.concat([Buffer.from(ppm,"ascii"),buf]));
for(let ci=0;ci<cols;ci++){const t=(FR[ci]/30).toFixed(1)+"s";for(let k=0;k<t.length;k++){}}
console.log("frames",FR.map(f=>(f/30).toFixed(2)).join(","));
