import {Float32BufferAttribute,Uint16BufferAttribute,MathUtils} from 'three';
const s=(a,b,x)=>MathUtils.smoothstep(x,a,b);
function mix(a,b,t){const out=new Map();for(const [j,w]of a)out.set(j,w*(1-t));for(const[j,w]of b)out.set(j,(out.get(j)||0)+w*t);return out;}
const single=j=>new Map([[j,1]]);
function along(value,stops){
 if(value<=stops[0][0])return single(stops[0][1]);
 for(let i=1;i<stops.length;i++)if(value<=stops[i][0])return mix(single(stops[i-1][1]),single(stops[i][1]),s(stops[i-1][0],stops[i][0],value));
 return single(stops.at(-1)[1]);
}
// The downloaded idle rig has non-local weight leakage: leg joints influence
// the forehead, opposite paws and mid-back. Keep its 40 joints/bind poses and
// repair those influence regions before surface refinement. The original head
// weights and facial morphs are retained after removing unrelated leg joints.
export function repairCatSkin(source,skeleton){
 const g=source.clone(),p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 const index=name=>{const i=skeleton.bones.findIndex(b=>b.name.includes(name));if(i<0)throw new Error('Missing cat joint: '+name);return i;};
 const spine=[[-.15,index('Wolf_ROOTSHJnt')],[-.075,index('Wolf_Spine_01')],[-.02,index('Wolf_Spine_02')],[.033,index('Wolf_Spine_03')],[.085,index('Wolf_Spine_04')],[.138,index('Wolf_Spine_Top')],[.20,index('Wolf_Neck_01')]];
 const neck=[index('Wolf_Neck_01'),index('Wolf_Neck_02'),index('Wolf_Neck_Top'),index('Wolf_Head_Jaw')];
 const tail=[[-.39,index('Wolf_Tail_01_05')],[-.32,index('Wolf_Tail_01_04')],[-.255,index('Wolf_Tail_01_03')],[-.19,index('Wolf_Tail_01_02')]];
 const chains={};
 for(const side of ['l','r']){
  const f=`Wolf_${side}_FrontLeg_`,h=`Wolf_${side}_HindLeg_`;
  chains[side]={
   front:[[.018,index(f+'Ball')],[.041,index(f+'Ankle')],[.065,index(f+'Knee')],[.143,index(f+'Knee')],[.178,index(f+'Hip')]],
   hind:[[.014,index(h+'Ankle')],[.04,index(h+'Knee2')],[.088,index(h+'Knee2')],[.115,index(h+'Knee1')],[.156,index(h+'Knee1')],[.193,index(h+'Hip')]],
  };
 }
 const indices=[],weights=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.abs(x),side=x>=0?'l':'r';
  let w=along(z,spine);
  const neckBlend=s(.15,.205,z)*s(.198,.263,y);
  const n=along(y,[[.23,neck[0]],[.27,neck[1]],[.303,neck[2]]]);
  w=mix(w,n,neckBlend);
  const head=s(.178,.228,z)*s(.240,.270,y);
  if(head>0){
   const original=new Map();let total=0;
   for(let j=0;j<4;j++){const bi=si.getComponent(i,j),bw=sw.getComponent(i,j);if(neck.includes(bi)&&bw>0){original.set(bi,(original.get(bi)||0)+bw);total+=bw;}}
   if(total>.01){for(const[k,v]of original)original.set(k,v/total);w=mix(w,original,head);}else w=mix(w,single(neck[2]),head);
  }
  // Lower limbs must retain their own weights right up to their inner edge.
  // Fading them toward the centreline left a sheet of torso-bound vertices
  // between the paws when either leg moved. Only fade laterally at the pelvis.
  const lateral=1-s(.12,.15,y)*(1-s(.007,.032,a));
  const front=s(.05,.104,z)*(1-s(.171,.238,y))*lateral*(1-head);
  const hind=(1-s(-.105,-.048,z))*(1-s(.159,.247,y))*lateral;
  w=mix(w,along(y,chains[side].front),front);
  w=mix(w,along(y,chains[side].hind),hind);
  // The actual tail tip hangs below y=.105. A height gate assigned its
  // underside to the hind legs, tearing the tail whenever those legs flexed.
  const tailMask=1-s(-.240,-.198,z);
  w=mix(w,along(z,tail),tailMask);
  const top=[...w].filter(x=>x[1]>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4);const sum=top.reduce((n,x)=>n+x[1],0);
  while(top.length<4)top.push([0,0]);indices.push(...top.map(x=>x[0]));weights.push(...top.map(x=>x[1]/sum));
 }
 g.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
 return g;
}
