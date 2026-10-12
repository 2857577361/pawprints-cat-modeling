import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BufferGeometry,BufferAttribute} from 'three';
import {repairCatSkin} from '../src/cat-skin.js';

// Exercise the real asset: tail tips and inner paw edges were misclassified by
// the previous region masks, although the static pose looked acceptable.
const file=fs.readFileSync(new URL('../public/models/companion-cat.glb',import.meta.url));
const jsonLength=file.readUInt32LE(12),gltf=JSON.parse(file.subarray(20,20+jsonLength));
const binary=file.subarray(28+jsonLength),primitive=gltf.meshes[1].primitives[0];
const source=new BufferGeometry();
for(const [name,key] of [['position','POSITION'],['skinIndex','JOINTS_0'],['skinWeight','WEIGHTS_0']]){
 const a=gltf.accessors[primitive.attributes[key]],v=gltf.bufferViews[a.bufferView];
 const width=a.type==='VEC3'?3:4,bytes={5121:1,5123:2,5126:4}[a.componentType];
 const read={5121:'readUInt8',5123:'readUInt16LE',5126:'readFloatLE'}[a.componentType];
 const values=[];for(let i=0;i<a.count;i++)for(let j=0;j<width;j++)values.push(binary[read]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||width*bytes)+j*bytes));
 source.setAttribute(name,new BufferAttribute(name==='skinIndex'?new Uint16Array(values):new Float32Array(values),width));
}
const skeleton={bones:gltf.skins[0].joints.map(i=>({name:gltf.nodes[i].name}))};
const repaired=repairCatSkin(source,skeleton),p=source.attributes.position;
const influences=i=>Array.from({length:4},(_,j)=>({name:skeleton.bones[repaired.attributes.skinIndex.getComponent(i,j)].name,weight:repaired.attributes.skinWeight.getComponent(i,j)})).filter(x=>x.weight>1e-6);

test('hanging tail tips remain exclusively on the tail skeleton',()=>{
 let count=0;for(let i=0;i<p.count;i++)if(p.getZ(i)<-.27){count++;for(const w of influences(i))assert.match(w.name,/Wolf_Tail/);}
 assert.ok(count>50);
});
test('inner lower hind legs do not remain attached to the torso or opposite leg',()=>{
 const counts={l:0,r:0};for(let i=0;i<p.count;i++)if(p.getY(i)<.07&&p.getZ(i)<-.105&&p.getZ(i)>-.195){
  const side=p.getX(i)>=0?'l':'r';counts[side]++;
  for(const w of influences(i))assert.ok(w.name.includes(`Wolf_${side}_HindLeg`),w.name);
 }
 assert.ok(counts.l>10&&counts.r>10);
});
test('all repaired vertices retain finite, normalized weights',()=>{
 for(let i=0;i<p.count;i++){
  const weights=influences(i).map(w=>w.weight);assert.ok(weights.every(w=>Number.isFinite(w)&&w>=0));
  assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-5);
 }
});
