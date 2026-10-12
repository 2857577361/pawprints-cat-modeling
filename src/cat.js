import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {makeCoatMaterial,makeFurGeometry,makeEyeMaterial} from './cat-coat.js';
import {refineCatSurface} from './cat-surface.js';
import {repairCatSkin} from './cat-skin.js';
import {createFelineMotion} from './cat-motion.js';

// Fripouille by guillaume bolis, rebuilt/rigged by kenchoo, CC BY 4.0.
// Full attribution, source provenance and modification notes: ATTRIBUTION.md.
const basePromise=new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'models/companion-cat.glb');
const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);

function personalizeSurface(geometry,id){
 const g=geometry.clone(),p=g.attributes.position,points=[];
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);points.push(x,y,z);
  const head=smooth(.195,.228,z)*smooth(.248,.282,y);
  const cheeks=head*(1-smooth(.307,.341,y));
  const torso=(1-smooth(.11,.19,z))*smooth(-.23,-.14,z)*smooth(.09,.18,y);
  const tail=1-smooth(-.24,-.205,z);
  let xx=x*(1+cheeks*(id==='shupian'?.14:.045)+torso*(id==='shupian'?.14:.12));
  let yy=y,zz=z;
  if(id==='shupian'){yy-=head*smooth(.32,.37,y)*.004;xx*=1+tail*.25;}
  // A slightly shorter bridge and fuller cheek silhouette; eyes use the same deformation.
  zz-=smooth(.283,.309,z)*(id==='shupian'?.0025:.001);
  p.setXYZ(i,xx,yy,zz);
 }
 g.setAttribute('coatPoint',new T.Float32BufferAttribute(points,3));
 g.deleteAttribute('tangent');
 return g;
}

export class Cat {
 constructor(id){
  this.id=id;this.root=new T.Group();this.root.userData.catId=id;
  this.body=new T.Group();this.root.add(this.body);
  this.target=null;this.jumpTime=-1;this.speed=0;this.runFast=false;this.ready=false;
  this.readyPromise=basePromise.then(gltf=>this.build(gltf));
 }
 build(gltf){
  const model=cloneSkeleton(gltf.scene);this.model=model;
  // Source coordinates have a natural standing height of 0.37 m.
  model.scale.multiplyScalar(5.4);model.position.y=.012;
  model.userData.sourceAnimations=gltf.animations;
  this.body.add(model);
  const meshes=[];model.traverse(n=>{if(n.isMesh)meshes.push(n);});
  for(const mesh of meshes){
   const source=mesh.material;
   if(mesh.name==='Object_8'){
    mesh.geometry=refineCatSurface(personalizeSurface(repairCatSkin(mesh.geometry,mesh.skeleton),this.id),2);
    mesh.material=makeCoatMaterial(source,this.id);this.mesh=mesh;
    mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
    const fg=makeFurGeometry(mesh.geometry,this.id);
    const fur=new T.SkinnedMesh(fg,makeCoatMaterial(source,this.id,true));
    fur.name='groomed-coat';fur.position.copy(mesh.position);fur.quaternion.copy(mesh.quaternion);fur.scale.copy(mesh.scale);
    mesh.parent.add(fur);fur.bind(mesh.skeleton,mesh.bindMatrix);fur.frustumCulled=false;
    fur.castShadow=false;fur.receiveShadow=false;
    const fullCount=fg.index.count;
    const cameraPosition=new T.Vector3(),catPosition=new T.Vector3();
    fur.onBeforeRender=(_renderer,_scene,camera)=>{
     camera.getWorldPosition(cameraPosition);this.root.getWorldPosition(catPosition);
     const distance=cameraPosition.distanceTo(catPosition);
     const density=T.MathUtils.clamp(9/Math.max(9,distance),.22,1);
     fg.setDrawRange(0,Math.floor(fullCount*density/18)*18);
    };
    this.fur=fur;
   }else if(mesh.isSkinnedMesh){
    mesh.geometry=refineCatSurface(personalizeSurface(repairCatSkin(mesh.geometry,mesh.skeleton),this.id),2);
    mesh.material=makeEyeMaterial(source,this.id);
    mesh.material.map.anisotropy=8;mesh.frustumCulled=false;
   }else{
    // Original fine whisker geometry follows the head bone.
    mesh.material=new T.MeshStandardMaterial({color:'#d6d2bd',roughness:.72,side:T.DoubleSide});
   }
  }
  this.motion=createFelineMotion(model);
  this.root.traverse(n=>n.userData.catId=this.id);
  this.ready=true;
 }
 moveTo(x,z){this.target=v(x,0,z);}
 jump(){if(this.jumpTime<0)this.jumpTime=0;}
 update(dt,t){
  const before=this.root.position.clone();let moving=false;
  if(this.target){
   const d=this.target.clone().sub(this.root.position);d.y=0;const distance=d.length();
   if(distance>.045){
    const max=this.runFast?4.6:1.45;
    this.speed=T.MathUtils.damp(this.speed,Math.min(max,Math.sqrt(distance*12)),6,dt);
    this.root.position.addScaledVector(d.normalize(),Math.min(distance,this.speed*dt));
    const angle=Math.atan2(d.x,d.z),delta=Math.atan2(Math.sin(angle-this.root.rotation.y),Math.cos(angle-this.root.rotation.y));
    this.root.rotation.y+=delta*Math.min(1,dt*8);moving=true;
   }else this.target=null;
  }
  if(!moving)this.speed=T.MathUtils.damp(this.speed,0,9,dt);
  let phase=-1,height=0;
  if(this.jumpTime>=0){this.jumpTime+=dt;phase=Math.min(this.jumpTime/.9,1);height=Math.sin(phase*Math.PI)*1.18;if(phase>=1)this.jumpTime=-1;}
  this.body.position.y=height;
  if(!this.ready)return;
  const actual=before.distanceTo(this.root.position)/Math.max(dt,.001);
  this.motion.update(dt,t,actual,phase);
 }
}
