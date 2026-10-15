import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Cat} from './cat.js';
import {makeCoatMaterial} from './cat-coat.js';
const scene=new T.Scene();scene.background=new T.Color('#babdc1');
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;document.body.append(renderer.domElement);
const camera=new T.PerspectiveCamera(32,innerWidth/innerHeight,.01,100);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new T.HemisphereLight(0xffffff,0x8a8d93,.95));const light=new T.DirectionalLight(0xffffff,2.7);light.position.set(-3,5,5);scene.add(light);const fill=new T.DirectionalLight(0xffffff,.5);fill.position.set(4,2,-3);scene.add(fill);
async function initializeReview(){
const cats={shupian:new Cat('shupian'),yangyang:new Cat('yangyang')};for(const c of Object.values(cats)){scene.add(c.root);c.root.visible=false;}
let cat=cats.shupian;await Promise.all(Object.values(cats).map(c=>c.readyPromise));cat.root.visible=true;
// Studio poses reuse actual app geometry, fur, textures and skeletal animation.
const views={front:[[0,1.73,4.3],[0,1.57,1.28]],left:[[2.4,1.95,3.8],[0,1.48,1.2]],right:[[-2.4,1.95,3.8],[0,1.48,1.2]],side:[[5,2,1],[0,1.0,0]],back:[[2.3,5,-3.2],[0,1,0]],tail:[[1.5,1.5,-4],[0,.8,-1.5]],feet:[[1,1,3.4],[0,.32,.55]]};
function view(name){const [p,t]=views[name];camera.position.fromArray(p);controls.target.fromArray(t);controls.update();}view('front');
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));document.querySelector('#cat').onchange=e=>{cat.root.visible=false;cat=cats[e.target.value];cat.root.visible=true;};
document.querySelector('#fur').onclick=()=>cat.fur.visible=!cat.fur.visible;
for(const c of Object.values(cats)){c.newMaterials=[c.mesh.material,c.fur.material];}
document.querySelector('#old').onclick=()=>{cat.old=!cat.old;if(cat.old){if(!cat.oldMaterials){const source=cat.sourceCoatMaterial;cat.oldMaterials=[makeCoatMaterial(source,cat.id),makeCoatMaterial(source,cat.id,true)];}cat.mesh.material=cat.oldMaterials[0];cat.fur.material=cat.oldMaterials[1];}else{[cat.mesh.material,cat.fur.material]=cat.newMaterials;}};
let start=performance.now();function frame(){requestAnimationFrame(frame);const t=(performance.now()-start)/1000,m=document.querySelector('#motion').value;cat.motion.update(1/60,t,m==='walk'?1.45:m==='run'?4.6:0,m==='jump'?(t%1.8)/1.8:-1);cat.body.position.y=m==='jump'?Math.sin((t%1.8)/1.8*Math.PI)*1.18:0;controls.update();renderer.render(scene,camera);}frame();
document.querySelector('#status').textContent='五官结构修整预览 · 鼻革 / 眼睑 / 虹膜 / 唇线 · 拖动旋转 / 滚轮缩放';
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

}
initializeReview().catch(error=>{console.error(error);document.querySelector('#status').textContent='模型加载失败：'+error.message;});
