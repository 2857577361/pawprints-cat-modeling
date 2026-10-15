import * as T from 'three';

// Anatomical details are built in the source cat's bind space, then receive the
// same facial deformation and skin influences as the surrounding head surface.
// No rigid world-space ornaments: these follow the head in every animation.
export function addFaceDetails(body,id,deform){
 const out=[],gray=id==='shupian',g=body.geometry;
 const p=g.attributes.coatPoint,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 const candidates=[];
 for(let i=0;i<p.count;i++)if(p.getY(i)>.25&&p.getZ(i)>.23)candidates.push(i);
 function attach(geometry,material,name){
  const point=geometry.attributes.position,indices=[],weights=[],nearestVertices=[];
  for(let i=0;i<point.count;i++){
   let best=Infinity,nearest=0;
   for(const j of candidates){const d=(p.getX(j)-point.getX(i))**2+(p.getY(j)-point.getY(i))**2+(p.getZ(j)-point.getZ(i))**2;if(d<best){best=d;nearest=j;}}
   nearestVertices.push(nearest);
   for(let k=0;k<4;k++){indices.push(si.getComponent(nearest,k));weights.push(sw.getComponent(nearest,k));}
  }

  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  const mesh=new T.SkinnedMesh(deform(geometry,id),material);geometry.dispose();
  if(name.startsWith('eyelid-')&&g.morphAttributes.position?.length){
   mesh.geometry.morphTargetsRelative=g.morphTargetsRelative;
   mesh.geometry.morphAttributes.position=g.morphAttributes.position.map(attribute=>new T.Float32BufferAttribute(nearestVertices.flatMap(i=>[attribute.getX(i),attribute.getY(i),attribute.getZ(i)]),3));
   mesh.updateMorphTargets();
   mesh.onBeforeRender=()=>{if(body.morphTargetInfluences)mesh.morphTargetInfluences.splice(0,mesh.morphTargetInfluences.length,...body.morphTargetInfluences);};
  }
  mesh.name=name;mesh.position.copy(body.position);mesh.quaternion.copy(body.quaternion);mesh.scale.copy(body.scale);
  body.parent.add(mesh);mesh.bind(body.skeleton,body.bindMatrix);mesh.frustumCulled=false;out.push(mesh);return mesh;
 }
 // Continuous muzzle skin covers the old open/frowning mouth topology.
 // A shallow cap bridges the old lip cavity. Fine directional microtexture
 // avoids transferring UV seams from the source inner-mouth islands.
 const mp=[],mi=[],mr=20,ms=96;
 for(let r=0;r<=mr;r++)for(let j=0;j<=ms;j++){
  const t=r/mr,a=j/ms*Math.PI*2;
  mp.push(Math.cos(a)*.018*t,.268+Math.sin(a)*.009*t,.291+.007*Math.sqrt(Math.max(0,1-t*t)));
 }
 for(let r=0;r<mr;r++)for(let j=0;j<ms;j++){const a=r*(ms+1)+j,b=a+ms+1;mi.push(a,a+1,b,a+1,b+1,b);}
 const muzzle=new T.BufferGeometry();muzzle.setAttribute('position',new T.Float32BufferAttribute(mp,3));muzzle.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(mp.length/3*2),2));muzzle.setIndex(mi);muzzle.computeVertexNormals();
 const muzzleMaterial=new T.MeshPhysicalMaterial({color:gray?'#bfc0b8':'#dedbd0',transparent:true,depthWrite:false,roughness:.97,sheen:.24,sheenColor:new T.Color('#ddd9cf'),side:T.DoubleSide});
 muzzleMaterial.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 coatPoint; varying vec3 vMuzzle;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMuzzle=coatPoint;');
  shader.fragmentShader='varying vec3 vMuzzle;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float strand=sin(vMuzzle.x*55000.+sin(vMuzzle.y*4200.)*2.);
   diffuseColor.rgb*=.96+.04*strand;
   diffuseColor.a*=1.-smoothstep(.78,1.,length(vec2(vMuzzle.x/.018,(vMuzzle.y-.268)/.009)));
  `);
 };
 attach(muzzle,muzzleMaterial,'continuous-muzzle');
 const leather=new T.MeshStandardMaterial({color:gray?'#423e3b':'#ba807c',roughness:.66,side:T.DoubleSide});
 const lip=new T.MeshStandardMaterial({color:gray?'#4b4340':'#674a43',roughness:.87,side:T.DoubleSide});
 const eyeRim=new T.MeshStandardMaterial({color:gray?'#423e39':'#53483a',roughness:.82,side:T.DoubleSide});
 function curve(points,radius,material,name){return attach(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),40,radius,6,false),material,name);}
 const outline=new T.CatmullRomCurve3([
  [-.006,.291,.302],[-.004,.293,.302],[0,.2926,.303],[.004,.293,.302],[.006,.291,.302],
  [.0046,.288,.303],[.0018,.285,.304],[0,.2848,.304],[-.0018,.285,.304],[-.0046,.288,.303],
 ].map(v=>new T.Vector3(...v)),true,'centripetal');
 const positions=[],uv=[],triangles=[],radial=12,segments=80;
 for(let r=0;r<=radial;r++)for(let s=0;s<=segments;s++){
  const t=r/radial,edge=outline.getPoint(s/segments);
  positions.push(edge.x*t,.289+(edge.y-.289)*t,.3025+(edge.z-.3025)*t+.0015*(1-t*t));
  uv.push(s/segments,t);
 }
 for(let r=0;r<radial;r++)for(let s=0;s<segments;s++){const a=r*(segments+1)+s,b=a+segments+1;triangles.push(a,b,a+1,b,b+1,a+1);}
 const nose=new T.BufferGeometry();nose.setAttribute('position',new T.Float32BufferAttribute(positions,3));nose.setAttribute('uv',new T.Float32BufferAttribute(uv,2));nose.setIndex(triangles);nose.computeVertexNormals();
 attach(nose,leather,'anatomical-nasal-leather');
 // Narrow rims and nostrils, not a solid triangular stamp.
 const rim=outline.getPoints(100).map(v=>v.toArray());curve(rim,.00023,lip,'nasal-rim');
 for(const sign of [-1,1]){
  curve([[sign*.0051,.2907,.303],[sign*.0042,.290,.3042],[sign*.0034,.2894,.3045]],.00035,lip,`nostril-${sign}`);
  curve([[0,.2795,.3048],[sign*.0035,.2778,.3044],[sign*.007,.278,.3035],[sign*.010,.279,.302]],.00015,lip,`upper-lip-${sign}`);
  // A slim upper and lower rim follows the existing orbital opening.
  const cx=sign<0?-.0188:.0211;
  for(const upper of [true,false]){
   const points=[];
   for(let i=0;i<=24;i++){const u=-1+2*i/24;points.push([cx+u*.0118,.308+(upper?1:-1)*.0098*Math.pow(Math.max(0,1-u*u),.65),.2726+.0012*(1-u*u)]);}
   curve(points,upper?.00048:.00032,eyeRim,`eyelid-${sign}-${upper?'upper':'lower'}`);
  }
 }
 curve([[0,.2849,.3048],[0,.2825,.3045],[0,.281,.3043],[0,.2795,.304]],.00016,lip,'philtrum');
 return out;
}
