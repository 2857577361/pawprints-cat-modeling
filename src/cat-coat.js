import * as T from 'three';

// Coordinates are in the source cat's rest space (metres), never screen space.
// The artist's UVs, pore/strand normal map, eyelids and nasal leather are retained.
const coatGLSL = `
vec3 coatColor(vec3 original, vec3 p, float gray) {
 float l=dot(original,vec3(.2126,.7152,.0722));
 float tone=smoothstep(.035,.48,l);
 float a=abs(p.x);
 float head=smoothstep(.17,.224,p.z)*smoothstep(.235,.271,p.y);
 float ear=smoothstep(.330,.351,p.y);
 float orangePixel=smoothstep(.012,.08,original.r-original.b);
 vec3 ivory=vec3(.80,.785,.748)*( .945+.055*clamp(l*2.,0.,1.));
 vec3 silver=mix(vec3(.058,.064,.065),vec3(.49,.515,.522),tone);
 float wave=p.z*235.+sin(p.y*75.+p.x*62.)*1.8;
 float stripes=pow(max(0.,sin(wave)),7.);
 vec3 grayBase=mix(vec3(.40,.425,.432),vec3(.13,.15,.155),stripes*.6);
 // Recover organic tabby detail from the original UV texture, adding coat only
 // on originally white legs; the silver coat has its own restricted white bib.
 silver=mix(grayBase,silver,orangePixel);
 float leg=(1.-smoothstep(.12,.185,p.y))*smoothstep(.016,.031,a);
 float legBand=pow(max(0.,sin(p.y*275.+sin(p.z*85.)*.85)),5.);
 vec3 legSilver=mix(vec3(.31,.335,.345),vec3(.075,.084,.092),legBand*.8);
 silver=mix(silver,legSilver,leg*.9);
 float chin=(1.-smoothstep(.275,.294,p.y))*head;
 float bib=smoothstep(.075,.17,p.z)*(1.-smoothstep(.21,.265,p.y))*smoothstep(.13,.19,p.y);
 float toes=1.-smoothstep(.018,.045,p.y);
 silver=mix(silver,ivory,max(max(chin,bib),toes)*.94);
 float forehead=smoothstep(.314,.338,p.y)*head*(1.-ear);
 float m=pow(max(0.,cos(p.x*450.+abs(p.x)*p.y*650.)),8.);
 silver=mix(silver,vec3(.042,.049,.05),forehead*m*.75);
 // White body, orange on viewer-left, dark tabby on viewer-right, white blaze.
 float blazeWidth=.003+clamp((.333-p.y)*.39,0.,.018);
 float blaze=1.-smoothstep(blazeWidth,blazeWidth+.003,a);
 float lowerEdge=.276+.008*smoothstep(.025,.060,a)+.002*sin(p.x*310.+p.y*180.);
 float facePatch=head*smoothstep(lowerEdge,lowerEdge+.006,p.y)*(1.-blaze);
 vec3 ginger=mix(vec3(.23,.096,.028),vec3(.65,.372,.145),tone);
 vec3 tabby=mix(vec3(.025,.024,.019),vec3(.32,.268,.175),tone);
 vec3 furPatch=mix(ginger,tabby,smoothstep(-.002,.002,p.x));
 vec3 calico=mix(ivory,furPatch,facePatch);
 float crown=head*smoothstep(.323,.341,p.y)*(1.-smoothstep(.011,.027,a));
 calico=mix(calico,tabby,crown*.94);
 float rump=(1.-smoothstep(.72,1.05,length(vec2(p.x/.072,(p.z+.16)/.091))))*smoothstep(.206,.235,p.y);
 float tail=1.-smoothstep(-.265,-.215,p.z);
 float irregular=.7+.3*sin(p.x*92.+p.z*40.);
 calico=mix(calico,furPatch,max(rump*irregular,tail));
 vec3 result=mix(calico,silver,gray);
 // Keep the original mouth, pads and recessed inner ears rather than painting over anatomy.
 float muzzle=head*(1.-smoothstep(.277,.297,p.y))*smoothstep(.288,.300,p.z);
 float noseWidth=.001+clamp((p.y-.280)*.49,0.,.0055);
 float nose=smoothstep(.295,.300,p.z)*(1.-smoothstep(noseWidth,noseWidth+.0008,a))*smoothstep(.279,.283,p.y)*(1.-smoothstep(.292,.295,p.y));
 result=mix(result,original,muzzle*.42);
 result=mix(result,mix(vec3(.39,.19,.175),vec3(.035,.039,.035),gray),nose);
 vec3 earColor=mix(original,vec3(l*.98,l*.78,l*.76),gray);
 result=mix(result,earColor,ear*.56);
 return result;
}
`;

export function makeCoatMaterial(source, id, fur=false, albedo=null) {
 const m=new T.MeshPhysicalMaterial({
  map:albedo??source.map, normalMap:null,
  normalScale:new T.Vector2(.65,.65), roughness:fur?.98:.93,
  metalness:0, sheen:fur?.48:.2, sheenColor:new T.Color('#c5c7bf'),
  sheenRoughness:.92, side:T.DoubleSide,
 });
 m.map.anisotropy=8;
 if(fur){m.vertexColors=true; m.depthWrite=true;}
 m.onBeforeCompile=sh=>{
  sh.uniforms.uGray={value:id==='shupian'?1:0};
  sh.vertexShader='attribute vec3 coatPoint; varying vec3 vCoatPoint;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCoatPoint=coatPoint;');
  sh.fragmentShader='varying vec3 vCoatPoint;uniform float uGray;\n'+coatGLSL+sh.fragmentShader;
  if(!albedo)sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=coatColor(diffuseColor.rgb,vCoatPoint,uGray);');
  // Ribbons represent round fibres: both visible sides use the outward follicle normal.
  if(fur)sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal *= faceDirection;');
 };
 m.customProgramCacheKey=()=>`companion-coat-5-photo-${id}-${fur}-${Boolean(albedo)}`;
 return m;
}

let seed=1701;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const v=()=>new T.Vector3();
const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);

// Bent, tapered ribbons follow the surface's original four-bone skinning.
// Each follicle samples the triangle's barycentric weights and UVs. Three
// curve segments avoid the straight, spiky silhouette of the previous fur.
export function makeFurGeometry(g,id){
 seed=id==='shupian'?1701:2701;
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,cp=g.attributes.coatPoint;
 const si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 const ix=g.index?.array??Array.from({length:p.count},(_,i)=>i);
 const cum=[],a=v(),b=v(),c=v();let area=0;
 for(let i=0;i<ix.length;i+=3){a.fromBufferAttribute(p,ix[i]);b.fromBufferAttribute(p,ix[i+1]);c.fromBufferAttribute(p,ix[i+2]);area+=b.sub(a).cross(c.sub(a)).length()/2;cum.push(area);}
 const positions=[],normals=[],uvs=[],points=[],colors=[],sis=[],sws=[],indices=[];
 const count=id==='shupian'?115000:72000;
 const point=v(),normal=v(),coat=v(),tangent=v(),side=v(),tmp=v();
 for(let f=0;f<count;f++){
  const r=rand()*area;let lo=0,hi=cum.length-1;while(lo<hi){const m=(lo+hi)>>1;if(cum[m]<r)lo=m+1;else hi=m;}
  const ids=[ix[lo*3],ix[lo*3+1],ix[lo*3+2]];let u=rand(),w=rand();if(u+w>1){u=1-u;w=1-w;}const bary=[1-u-w,u,w];
  point.set(0,0,0);normal.set(0,0,0);coat.set(0,0,0);let tu=0,tv=0;
  const weights=new Map();
  ids.forEach((i,k)=>{const q=bary[k];point.addScaledVector(a.fromBufferAttribute(p,i),q);normal.addScaledVector(a.fromBufferAttribute(n,i),q);coat.addScaledVector(a.fromBufferAttribute(cp,i),q);tu+=uv.getX(i)*q;tv+=uv.getY(i)*q;for(let j=0;j<4;j++){const bi=si.array[i*4+j],bw=sw.array[i*4+j]*q;weights.set(bi,(weights.get(bi)||0)+bw);}});
  const {x,y,z}=coat,ax=Math.abs(x);normal.normalize().negate();
  const head=smooth(.185,.222,z)*smooth(.245,.272,y);
  // Eyelids, nose leather and pads stay clean. The eyeballs use their own mesh.
  if(head&&z>.261&&Math.pow((ax-.021)/.013,2)+Math.pow((y-.308)/.012,2)<1.05)continue;
  if(z>.293&&ax<.014&&y>.275&&y<.299)continue;
  if(y<.006)continue;
  let length=(id==='shupian'?.0068:.0022)*(.55+rand()*.95);
  const tail=(1-smooth(-.235,-.19,z));
  const ruff=head*(1-smooth(.292,.316,y));
  if(id==='shupian'){length*=1+tail*2.8+ruff*.8;}
  if(head)length*=.18+.82*(1-smooth(.278,.310,y));
  if(y>.338)length*=id==='shupian'?1.5:.45;
  if(id==='shupian'&&head&&ax>.033&&y>.282&&y<.325)length*=1.35;
  if(y<.095)length*=.48;
  // Face radiates from muzzle; shoulders/chest flow down, spine toward rump.
  tangent.set(0,-.42,-.8);
  if(head)tangent.set(Math.sign(x)*.63,-.35,-.18);
  if(y>.335)tangent.set(Math.sign(x)*.23,.8,-.12);
  if(tail)tangent.set(0,-.20,-1);
  tangent.addScaledVector(normal,-tangent.dot(normal)).normalize();
  tangent.addScaledVector(normal,.28+rand()*.2).normalize();
  side.crossVectors(normal,tangent);if(side.lengthSq()<.01)side.crossVectors(normal,new T.Vector3(1,.1,0));side.normalize();
  const ws=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4);while(ws.length<4)ws.push([0,0]);const sum=ws.reduce((s,x)=>s+x[1],0);ws.forEach(x=>x[1]/=sum);
  const width=(id==='shupian'?.000065:.000055)*(.6+rand()*.65)*(1+tail*1.3),shade=.86+rand()*.23;
  const base=positions.length/3;
  for(let k=0;k<=3;k++){
   const t=k/3;const spread=width*(1-t*.94);
   tmp.copy(point).addScaledVector(normal,.00006+length*.32*Math.sin(t*Math.PI*.78)).addScaledVector(tangent,length*t);
   for(const sign of[-1,1]){const pt=tmp.clone().addScaledVector(side,sign*spread);positions.push(pt.x,pt.y,pt.z);normals.push(normal.x,normal.y,normal.z);uvs.push(tu,tv);points.push(coat.x,coat.y,coat.z);const light=shade*(.82+.18*t);colors.push(light,light,light);sis.push(...ws.map(x=>x[0]));sws.push(...ws.map(x=>x[1]));}
   if(k<3){const q=base+k*2;indices.push(q,q+1,q+2,q+1,q+3,q+2);}
  }
 }
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(positions,3));out.setAttribute('normal',new T.Float32BufferAttribute(normals,3));out.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));out.setAttribute('coatPoint',new T.Float32BufferAttribute(points,3));out.setAttribute('color',new T.Float32BufferAttribute(colors,3));out.setAttribute('skinIndex',new T.Uint16BufferAttribute(sis,4));out.setAttribute('skinWeight',new T.Float32BufferAttribute(sws,4));out.setIndex(indices);out.computeBoundingSphere();
 return out;
}

let eyeEnvironment;
function eyeReflection(){
 if(eyeEnvironment)return eyeEnvironment;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
 const ctx=canvas.getContext('2d'),sky=ctx.createLinearGradient(0,0,0,256);
 sky.addColorStop(0,'#abc3d1');sky.addColorStop(.5,'#758784');sky.addColorStop(1,'#292e22');
 ctx.fillStyle=sky;ctx.fillRect(0,0,512,256);
 const windowLight=ctx.createRadialGradient(140,68,3,140,68,45);
 windowLight.addColorStop(0,'#ffffff');windowLight.addColorStop(.35,'#fffbea');windowLight.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=windowLight;ctx.fillRect(80,10,120,116);
 eyeEnvironment=new T.CanvasTexture(canvas);eyeEnvironment.colorSpace=T.SRGBColorSpace;eyeEnvironment.mapping=T.EquirectangularReflectionMapping;
 return eyeEnvironment;
}
export function makeEyeMaterial(source,id){
 const material=new T.MeshPhysicalMaterial({map:source.map,side:source.side,roughness:.08,clearcoat:1,clearcoatRoughness:.06,metalness:0,envMap:eyeReflection(),envMapIntensity:1.1});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 coatPoint; varying vec3 vEyePoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEyePoint=coatPoint;');
  shader.fragmentShader='varying vec3 vEyePoint;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float center=vEyePoint.x<0.?-.0188:.0211;
   vec2 irisPoint=vec2(vEyePoint.x-center,vEyePoint.y-.308)/.0128;
   float irisR=length(irisPoint);
   if(vEyePoint.z>.25) {
    float angle=atan(irisPoint.y,irisPoint.x);
    float fibre=sin(angle*143.+sin(angle*31.)*3.+irisR*13.)*.5+.5;
    float smallFibre=sin(angle*317.+irisR*43.)*.5+.5;
    vec3 eyeBase=mix(vec3(.12,.16,.046),vec3(${id==='shupian'?'.40,.35,.12':'.32,.38,.115'}),.30+fibre*.38+smallFibre*.16);
    eyeBase*=.88+.12*sin(irisR*24.+angle*3.);
    eyeBase=mix(eyeBase,vec3(.024,.032,.016),smoothstep(.83,1.,irisR));
    float pupil=length(irisPoint/vec2(.16,.64));
    eyeBase=mix(vec3(.003,.006,.004),eyeBase,smoothstep(.96,1.06,pupil));
    diffuseColor.rgb=eyeBase;
   }
  `);
 };
 material.customProgramCacheKey=()=>`feline-iris-anatomy-4-${id}`;
 return material;
}
