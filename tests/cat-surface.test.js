import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { refineCatSurface } from '../src/cat-surface.js';
function curvedTriangle() {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([1,0,0, 0,1,0, 0,0,1], 3));
  g.setAttribute('normal', g.attributes.position.clone());
  g.setAttribute('uv', new Float32BufferAttribute([0,0, 1,0, 0,1], 2));
  g.setAttribute('uv1', g.attributes.uv.clone()); g.setAttribute('uv2', g.attributes.uv.clone());
  g.setAttribute('skinIndex', new Uint16BufferAttribute([0,1,2,3, 1,4,5,6, 0,2,7,8], 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute([.6,.2,.1,.1, .4,.3,.2,.1, .4,.3,.2,.1], 4));
  g.setIndex([0,1,2]); g.addGroup(0,3,2); g.morphTargetsRelative = true;
  g.morphAttributes.position = [new Float32BufferAttribute([.2,-.3,.4, .2,-.3,.4, .2,-.3,.4],3)];
  g.morphAttributes.normal = [new Float32BufferAttribute(Array(9).fill(0),3)];
  return g;
}
function close(actual, expected, tolerance=1e-6) { assert.ok(Math.abs(actual-expected)<=tolerance, `${actual} vs ${expected}`); }

test('Phong subdivision bends edges while preserving original controls and all UV channels', () => {
  const source=curvedTriangle(), before=source.attributes.position.array.slice();
  const g=refineCatSurface(source,2);
  assert.equal(g.index.count,48); assert.equal(source.index.count,3);
  assert.deepEqual(source.attributes.position.array,before);
  assert.deepEqual(g.attributes.position.array.slice(0,9),before);
  close(g.attributes.position.getX(3),.6625); close(g.attributes.position.getY(3),.6625);
  assert.ok(Math.hypot(g.attributes.position.getX(3),g.attributes.position.getY(3))>Math.SQRT1_2);
  for(const name of ['uv','uv1','uv2']) {
    assert.equal(g.attributes[name].count,g.attributes.position.count);
    close(g.attributes[name].getX(3),.5); close(g.attributes[name].getY(3),0);
  }
  assert.deepEqual(g.groups,[{start:0,count:48,materialIndex:2}]);
});

test('four strongest joint influences are combined and normalized', () => {
  const g=refineCatSurface(curvedTriangle(),2), w=g.attributes.skinWeight, joints=g.attributes.skinIndex;
  assert.deepEqual(Array.from(joints.array.slice(12,16)),[0,1,4,5]);
  for(let i=0;i<w.count;i++) {
    close(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i),1);
    for(let j=0;j<4;j++) { assert.ok(w.getComponent(i,j)>=0); assert.ok(Number.isInteger(joints.getComponent(i,j))); }
  }
});

test('relative morph translation remains a delta and normals stay unit length', () => {
  const g=refineCatSurface(curvedTriangle(),2), m=g.morphAttributes.position[0], n=g.attributes.normal;
  assert.equal(g.morphTargetsRelative,true); assert.equal(m.count,g.attributes.position.count);
  for(let i=0;i<m.count;i++) {
    close(m.getX(i),.2); close(m.getY(i),-.3); close(m.getZ(i),.4);
    close(Math.hypot(n.getX(i),n.getY(i),n.getZ(i)),1);
  }
  for(const attr of [...Object.values(g.attributes),...Object.values(g.morphAttributes).flat()]) {
    assert.ok(Array.from(attr.array).every(Number.isFinite));
  }
});

test('adjacent triangles share midpoint vertices and flat surfaces stay flat', () => {
  const source=new BufferGeometry();
  source.setAttribute('position',new Float32BufferAttribute([0,0,0, 1,0,0, 1,1,0, 0,1,0],3));
  source.setIndex([0,1,2,0,2,3]); const g=refineCatSurface(source,1);
  assert.equal(g.attributes.position.count,9); assert.equal(g.index.count,24);
  for(let i=0;i<9;i++) close(g.attributes.position.getZ(i),0);
});
