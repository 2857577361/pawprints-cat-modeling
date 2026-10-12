import { BufferAttribute, BufferGeometry } from 'three';

// Phong tessellation retains the original control vertices and places each new
// edge vertex between the projections onto the endpoint tangent planes.
const PHONG_BLEND = 0.65;
const EPS = 1e-12;

function component(attribute, vertex, channel) {
  if (attribute.getComponent) return attribute.getComponent(vertex, channel);
  return attribute[['getX', 'getY', 'getZ', 'getW'][channel]](vertex);
}
function read(attribute, vertex) {
  return Array.from({ length: attribute.itemSize }, (_, c) => component(attribute, vertex, c));
}
function unit(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > EPS ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
}
function middle(a, b) { return a.map((v, i) => (v + b[i]) * 0.5); }
function smoothMiddle(a, b, normalA, normalB) {
  const m = middle(a, b);
  const n0 = unit(normalA), n1 = unit(normalB);
  const d0 = (m[0] - a[0]) * n0[0] + (m[1] - a[1]) * n0[1] + (m[2] - a[2]) * n0[2];
  const d1 = (m[0] - b[0]) * n1[0] + (m[1] - b[1]) * n1[1] + (m[2] - b[2]) * n1[2];
  return m.map((v, i) => v - PHONG_BLEND * 0.5 * (d0 * n0[i] + d1 * n1[i]));
}
function add(a, b) { return a.map((v, i) => v + b[i]); }
function subtract(a, b) { return a.map((v, i) => v - b[i]); }
function mergedSkin(indices, weights, a, b = a) {
  const influences = new Map();
  for (const vertex of [a, b]) {
    for (let c = 0; c < Math.min(indices.itemSize, weights.itemSize); c++) {
      const joint = component(indices, vertex, c);
      const weight = component(weights, vertex, c) * 0.5;
      if (Number.isFinite(weight) && weight > 0) influences.set(joint, (influences.get(joint) || 0) + weight);
    }
  }
  const selected = [...influences].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4);
  const total = selected.reduce((sum, pair) => sum + pair[1], 0);
  if (total <= EPS) return { indices: [component(indices, a, 0), 0, 0, 0], weights: [1, 0, 0, 0] };
  return {
    indices: Array.from({ length: 4 }, (_, i) => selected[i]?.[0] || 0),
    weights: Array.from({ length: 4 }, (_, i) => (selected[i]?.[1] || 0) / total),
  };
}
function refineOnce(source) {
  const attributes = source.attributes;
  const position = attributes.position, normal = attributes.normal;
  const hasSkin = Boolean(attributes.skinIndex && attributes.skinWeight);
  const values = Object.fromEntries(Object.keys(attributes).map(key => [key, []]));
  const morphValues = Object.fromEntries(Object.entries(source.morphAttributes).map(([key, targets]) => [key, targets.map(() => [])]));
  const relative = source.morphTargetsRelative;
  const edges = new Map();
  const triangles = [];
  let count = position.count;

  for (let vertex = 0; vertex < count; vertex++) {
    for (const [key, attr] of Object.entries(attributes)) {
      let value = read(attr, vertex);
      if (key === 'normal') value = unit(value);
      values[key].push(...value);
    }
    if (hasSkin) {
      const skin = mergedSkin(attributes.skinIndex, attributes.skinWeight, vertex);
      values.skinIndex.splice(vertex * 4, 4, ...skin.indices);
      values.skinWeight.splice(vertex * 4, 4, ...skin.weights);
    }
    for (const [key, targets] of Object.entries(source.morphAttributes)) {
      targets.forEach((attr, target) => morphValues[key][target].push(...read(attr, vertex)));
    }
  }

  function midpoint(a, b) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (edges.has(key)) return edges.get(key);
    const index = count++;
    edges.set(key, index);
    const pa = read(position, a), pb = read(position, b);
    const na = unit(read(normal, a)), nb = unit(read(normal, b));
    const newPosition = smoothMiddle(pa, pb, na, nb);
    const newNormal = unit(middle(na, nb));
    const skin = hasSkin ? mergedSkin(attributes.skinIndex, attributes.skinWeight, a, b) : null;
    for (const [attributeKey, attr] of Object.entries(attributes)) {
      let value = middle(read(attr, a), read(attr, b));
      if (attributeKey === 'position') value = newPosition;
      else if (attributeKey === 'normal') value = newNormal;
      else if (attributeKey === 'skinIndex' && skin) value = skin.indices;
      else if (attributeKey === 'skinWeight' && skin) value = skin.weights;
      else if (attributeKey === 'tangent') value = [...unit(value), value[3] >= 0 ? 1 : -1];
      values[attributeKey].push(...value);
    }
    for (const [attributeKey, targets] of Object.entries(source.morphAttributes)) {
      targets.forEach((attr, target) => {
        let value = middle(read(attr, a), read(attr, b));
        if (attributeKey === 'position') {
          const ma = read(attr, a), mb = read(attr, b);
          const posedA = relative ? add(pa, ma) : ma;
          const posedB = relative ? add(pb, mb) : mb;
          const morphNormal = source.morphAttributes.normal?.[target];
          const posedNormalA = morphNormal ? unit(relative ? add(na, read(morphNormal, a)) : read(morphNormal, a)) : na;
          const posedNormalB = morphNormal ? unit(relative ? add(nb, read(morphNormal, b)) : read(morphNormal, b)) : nb;
          const posedMidpoint = smoothMiddle(posedA, posedB, posedNormalA, posedNormalB);
          value = relative ? subtract(posedMidpoint, newPosition) : posedMidpoint;
        } else if (attributeKey === 'normal') {
          const ma = read(attr, a), mb = read(attr, b);
          const posedNormal = unit(middle(relative ? add(na, ma) : ma, relative ? add(nb, mb) : mb));
          value = relative ? subtract(posedNormal, newNormal) : posedNormal;
        }
        morphValues[attributeKey][target].push(...value);
      });
    }
    return index;
  }

  for (let i = 0; i < source.index.count; i += 3) {
    const a = source.index.getX(i), b = source.index.getX(i + 1), c = source.index.getX(i + 2);
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    triangles.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  const refined = new BufferGeometry();
  refined.name = source.name;
  refined.userData = { ...source.userData };
  for (const [key, attr] of Object.entries(attributes)) {
    const ArrayType = key === 'skinIndex' ? (values[key].some(x => x > 65535) ? Uint32Array : Uint16Array) : Float32Array;
    const result = new BufferAttribute(new ArrayType(values[key]), attr.itemSize);
    result.name = attr.name;
    refined.setAttribute(key, result);
  }
  refined.setIndex(triangles);
  refined.morphTargetsRelative = relative;
  for (const [key, targets] of Object.entries(source.morphAttributes)) {
    refined.morphAttributes[key] = targets.map((attr, target) => {
      const result = new BufferAttribute(new Float32Array(morphValues[key][target]), attr.itemSize);
      result.name = attr.name;
      return result;
    });
  }
  for (const group of source.groups) refined.addGroup(group.start * 4, group.count * 4, group.materialIndex);
  refined.setDrawRange(source.drawRange.start * 4, Number.isFinite(source.drawRange.count) ? source.drawRange.count * 4 : Infinity);
  refined.computeBoundingBox();
  refined.computeBoundingSphere();
  return refined;
}

/**
 * Refine an indexed triangle mesh without replacing its anatomical control mesh.
 * Returns a new geometry; preserves UV seams, groups, skin influences and morphs.
 * Relative morph positions are refined in posed space then converted to deltas.
 */
export function refineCatSurface(geometry, iterations = 2) {
  if (!geometry?.isBufferGeometry || !geometry.index || !geometry.attributes.position) {
    throw new TypeError('refineCatSurface requires an indexed BufferGeometry with positions');
  }
  if (!Number.isInteger(iterations) || iterations < 0 || iterations > 4) {
    throw new RangeError('iterations must be an integer from 0 to 4');
  }
  if (geometry.index.count % 3) throw new RangeError('index must contain complete triangles');
  const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  if (Boolean(skinIndex) !== Boolean(skinWeight) || (skinIndex && (skinIndex.itemSize !== 4 || skinWeight.itemSize !== 4))) {
    throw new TypeError('skinIndex and skinWeight must both have four components');
  }
  let result = geometry.clone();
  if (!result.attributes.normal) result.computeVertexNormals();
  for (let step = 0; step < iterations; step++) {
    const previous = result;
    result = refineOnce(previous);
    previous.dispose();
  }
  result.userData.catSurface = { method: 'Phong tangent-plane midpoint', iterations, blend: PHONG_BLEND };
  return result;
}
