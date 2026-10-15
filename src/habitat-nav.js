// Navigation surfaces use world coordinates. Upstairs is a distinct surface;
// only the top landing joins the two graphs, so a click can never teleport a cat.
export const FLOOR=.18, UPPER=3.68;
export const insideHouse=(x,z)=>x>=5&&x<=19&&z>=-7&&z<=5;
export const onStairs=(x,z)=>x>=15.8&&x<=18.2&&z>=-5.5&&z<=5.5;
export const upperArea=(x,z)=>x>=5.5&&x<=18.5&&z>=-6.5&&z<=4.5&&(x<=14.5||z<=-5.5);
export function surfaceHeight(x,z,level=0){
 if(level===1)return UPPER;
 if(onStairs(x,z))return FLOOR+(UPPER-FLOOR)*Math.max(0,Math.min(1,(5.5-z)/11));
 return insideHouse(x,z)?FLOOR:0;
}
export const blockers=[
 // Solid exterior walls; the entire southern facade is open to the meadow.
 [4.8,5.3,-7.3,5],[18.7,19.3,-7.3,5],[4.8,19.3,-7.3,-6.7],
];
export function walkable(x,z,level=0){
 if(level===1)return upperArea(x,z);
 if(Math.hypot(x,z)>85||((x-13)/8.9)**2+((z+15)/6.5)**2<1)return false;
 if(blockers.some(([a,b,c,d])=>x>a-.3&&x<b+.3&&z>c-.3&&z<d+.3))return false;
 // Furniture clearances, leaving designated approach points open.
 return ![[6.7,-4.2,1],[7,1.8,.85]].some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
}
const key=(x,z,l)=>`${x},${z},${l}`;
class Heap{constructor(){this.a=[];}push(n){let a=this.a,i=a.length;a.push(n);while(i){let p=(i-1)>>1;if(a[p].f<=n.f)break;a[i]=a[p];i=p;}a[i]=n;}pop(){let a=this.a,top=a[0],n=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].f<a[j].f)j++;if(a[j].f>=n.f)break;a[i]=a[j];i=j;}a[i]=n;}return top;}}
export function route(start,destination){
 const step=.5, sx=Math.round(start.x/step),sz=Math.round(start.z/step),sl=start.level||0;
 let tx=Math.round(destination.x/step),tz=Math.round(destination.z/step),tl=destination.level||0;
 if(!walkable(tx*step,tz*step,tl))return null;
 const open=new Heap(),seen=new Map(),closed=new Set();
 const heuristic=(x,z,l)=>Math.hypot(x-tx,z-tz)+(l!==tl?12:0);
 const first={x:sx,z:sz,l:sl,g:0,f:0,parent:null};open.push(first);seen.set(key(sx,sz,sl),first);
 let count=0;
 while(open.a.length&&count++<90000){const n=open.pop(),k=key(n.x,n.z,n.l);if(closed.has(k))continue;closed.add(k);
  if(n.x===tx&&n.z===tz&&n.l===tl){let out=[];for(let p=n;p.parent;p=p.parent)out.push({x:p.x*step,z:p.z*step,level:p.l});return out.reverse();}
  let candidates=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].map(([dx,dz])=>({x:n.x+dx,z:n.z+dz,l:n.l}));
  if(n.x*step>=16&&n.x*step<=18&&n.z*step===-5.5)candidates.push({x:n.x,z:n.z,l:1-n.l});
  for(const p of candidates){let x=p.x*step,z=p.z*step,pk=key(p.x,p.z,p.l);if(closed.has(pk)||!walkable(x,z,p.l))continue;
   if(Math.abs(surfaceHeight(x,z,p.l)-surfaceHeight(n.x*step,n.z*step,n.l))>.32)continue;
   if(p.x!==n.x&&p.z!==n.z&&(!walkable(x,n.z*step,n.l)||!walkable(n.x*step,z,n.l)))continue;
   const g=n.g+Math.hypot(p.x-n.x,p.z-n.z)+(p.l!==n.l?.1:0);
   if(seen.has(pk)&&seen.get(pk).g<=g)continue;const next={...p,g,f:g+heuristic(p.x,p.z,p.l),parent:n};seen.set(pk,next);open.push(next);
  }
 }
 return null;
}
