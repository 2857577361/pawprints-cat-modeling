import * as T from 'three';

// Foot-target animation for the original 40-joint bicolor-cat rig. All imported
// bind matrices, limb lengths and rest rotations stay intact; the skin is
// repaired separately before this controller is created.
// Footprints/IK follow the approach in Martin & Neff, Interactive Quadruped
// Animation (UC Davis). Gait timing is an authored approximation, not mocap.
const clamp = T.MathUtils.clamp;
const lerp = T.MathUtils.lerp;
const smooth = x => { x = clamp(x, 0, 1); return x*x*(3-2*x); };
const fract = x => x-Math.floor(x);
const V = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
const X = V(1,0,0), Y = V(0,1,0), Z = V(0,0,1);

export function createFelineMotion(model) {
  model.updateWorldMatrix(true, true);
  const bones = [];
  model.traverse(n => { if (n.isBone) bones.push(n); });
  const find = name => bones.find(b => b.name.includes(name));
  const rest = new Map(bones.map(b => [b, {
    p:b.position.clone(), q:b.quaternion.clone(), s:b.scale.clone(),
    point:model.worldToLocal(b.getWorldPosition(V())),
    orientation:model.getWorldQuaternion(new T.Quaternion()).invert().multiply(b.getWorldQuaternion(new T.Quaternion())),
  }]));
  const root = find('Wolf_ROOTSHJnt');
  const rigRoot = find('GLTF_created_0_rootJoint') || find('Wolf_MAINSHJnt') || root;
  const spine = ['Spine_01','Spine_02','Spine_03','Spine_04','Spine_Top'].map(n=>find('Wolf_'+n));
  const neck = ['Neck_01','Neck_02','Neck_Top'].map(n=>find('Wolf_'+n));
  const tail = ['Tail_01_02','Tail_01_03','Tail_01_04','Tail_01_05'].map(n=>find('Wolf_'+n));
  if (!root || spine.some(b=>!b)) throw new Error('Feline motion requires the original bicolor cat skeleton.');
  const localPoint = b => model.worldToLocal(b.getWorldPosition(V()));
  const legs = [];
  for (const side of ['l','r']) for (const front of [true,false]) {
    const prefix = `Wolf_${side}_${front?'Front':'Hind'}Leg_`;
    const hip=find(prefix+'Hip'), knee=find(prefix+(front?'KneeSH':'Knee1'));
    const hock=front?null:find(prefix+'Knee2'), ankle=find(prefix+'Ankle');
    const ball=find(prefix+'Ball'), toe=find(prefix+'Toe');
    if (![hip,knee,ankle,ball,toe].every(Boolean) || (!front&&!hock)) throw new Error('Incomplete feline limb chain.');
    const end=front?ankle:hock;
    const hipPoint=rest.get(hip).point, kneePoint=rest.get(knee).point, endPoint=rest.get(end).point;
    const direction=endPoint.clone().sub(hipPoint).normalize();
    const pole=front
      ? kneePoint.clone().sub(hipPoint).addScaledVector(direction,-kneePoint.clone().sub(hipPoint).dot(direction)).normalize()
      : V(side==='l'?.32:-.32,-.12,1).normalize();
    legs.push({side,front,hip,knee,hock,ankle,ball,toe,end,
      a:hipPoint.distanceTo(kneePoint), b:kneePoint.distanceTo(endPoint), pole,
      paw:rest.get(ball).point.clone(),
      pawOffset:rest.get(ball).point.clone().sub(rest.get(ankle).point),
      heelOffset:front?V():rest.get(hock).point.clone().sub(rest.get(ankle).point),
      anchor:V(), liftOff:V(), landing:V(), target:V(), phase:0, stance:false, initialized:false,
      // Four distinct beats: hind-left, fore-left, hind-right, fore-right.
      walkOffset:front?(side==='l'?.25:.75):(side==='l'?0:.5),
      runOffset:front?(side==='l'?.49:.57):(side==='l'?0:.08),
      contactError:0,recovery:-1,recoveryStart:V(),lastPawWorld:ball.getWorldPosition(V()),
    });
  }
  const sourceClips=model.userData.sourceAnimations || model.animations || [];
  // The supplied clip is an idle/breathing pose, not locomotion. Its genuine
  // eyelid morphs are retained without letting its leg tracks fight foot IK.
  const faceTracks=sourceClips.flatMap(c=>c.tracks.filter(t=>t.name.endsWith('.morphTargetInfluences')).map(t=>t.clone()));
  const faceMixer=faceTracks.length?new T.AnimationMixer(model):null;
  if(faceMixer)faceMixer.clipAction(new T.AnimationClip('original eyelids',Math.max(...sourceClips.map(c=>c.duration)),faceTracks)).play();
  let cycle=0, blend=0, runBlend=0, previousWorld=model.getWorldPosition(V());
  let initialized=false, wasJumping=false, turnRate=0;
  const tailPose=tail.map(()=>({yaw:0,pitch:0}));
  const previousForward=model.getWorldDirection(V());
  const velocity=V(), modelQ=new T.Quaternion(), parentQ=new T.Quaternion();
  const stats={gait:'idle',feet:[],stride:0,cycle:0};

  function restore() {
    for(const b of bones){const r=rest.get(b);b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}
    model.updateWorldMatrix(true,true);
  }
  function rotate(b,axis,angle){
    if(!b||Math.abs(angle)<1e-8)return;
    model.getWorldQuaternion(modelQ);
    b.parent.getWorldQuaternion(parentQ).invert();
    const localAxis=axis.clone().applyQuaternion(modelQ).applyQuaternion(parentQ).normalize();
    b.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(localAxis,angle));
    b.updateWorldMatrix(false,true);
  }
  function translate(b,offset){
    const p=rest.get(b).point.clone().add(offset);
    model.localToWorld(p); b.parent.worldToLocal(p); b.position.copy(p);
    b.updateWorldMatrix(false,true);
  }
  function orient(b,canonicalOrientation){
    const desired=model.getWorldQuaternion(new T.Quaternion()).multiply(canonicalOrientation);
    const invParent=b.parent.getWorldQuaternion(new T.Quaternion()).invert();
    b.quaternion.copy(invParent.multiply(desired));b.updateWorldMatrix(false,true);
  }
  function aim(b,child,target){
    const origin=b.getWorldPosition(V());
    const current=child.getWorldPosition(V()).sub(origin).normalize();
    const desired=model.localToWorld(target.clone()).sub(origin).normalize();
    if(current.lengthSq()<.5||desired.lengthSq()<.5)return;
    const delta=new T.Quaternion().setFromUnitVectors(current,desired);
    const world=delta.multiply(b.getWorldQuaternion(new T.Quaternion()));
    const parentInverse=b.parent.getWorldQuaternion(new T.Quaternion()).invert();
    b.quaternion.copy(parentInverse.multiply(world));b.updateWorldMatrix(false,true);
  }
  function solveLeg(leg,ballTarget,curl=0) {
    // Bound predictive landing points to the anatomical workspace. During a
    // fast reversal the old velocity may still point behind the new heading.
    ballTarget=ballTarget.clone();
    ballTarget.x=clamp(ballTarget.x,leg.paw.x-.018,leg.paw.x+.018);
    ballTarget.z=clamp(ballTarget.z,leg.paw.z-(leg.front?.085:.065),leg.paw.z+(leg.front?.085:.065));
    ballTarget.y=clamp(ballTarget.y,leg.paw.y,leg.paw.y+.042);
    leg.target.copy(ballTarget);
    // Keep toes horizontal during support. Flex the whole wrist during swing;
    // unlike a two-stick rig this retains the original digitigrade paw/hock.
    const pawTurn=new T.Quaternion().setFromAxisAngle(X,curl);
    const pawOffset=leg.pawOffset.clone().applyQuaternion(pawTurn);
    const ankleTarget=ballTarget.clone().sub(pawOffset);
    let endTarget=ankleTarget;
    if(!leg.front){
      const heel=leg.heelOffset.clone();
      // Fold the metatarsal backwards as the paw rises. Keeping this offset
      // upright forced the hock too close to the hip and flipped the knee up.
      const lift=smooth((ballTarget.y-leg.paw.y)/.042);
      heel.applyAxisAngle(X,-.72*lift+clamp(curl*.2,-.08,.08));
      endTarget=ankleTarget.clone().add(heel);
    }
    const hip=localPoint(leg.hip);
    function triangle(target){
      const axis=target.clone().sub(hip);
      const reach=clamp(axis.length(),Math.abs(leg.a-leg.b)+.0001,(leg.a+leg.b)*.995);
      axis.normalize();
      const bend=leg.pole.clone().addScaledVector(axis,-leg.pole.dot(axis)).normalize();
      const along=(leg.a*leg.a+reach*reach-leg.b*leg.b)/(2*reach);
      const height=Math.sqrt(Math.max(.000001,leg.a*leg.a-along*along));
      return {kneeTarget:hip.clone().addScaledVector(axis,along).addScaledVector(bend,height),
        safeEnd:hip.clone().addScaledVector(axis,reach)};
    }
    let solved=triangle(endTarget);
    // If a crouch/turn would invert the stifle, flex the hock further before
    // solving the upper chain. Preserve bone lengths instead of lifting the knee.
    if(!leg.front){
      const lift=smooth((ballTarget.y-leg.paw.y)/.042);
      let fold=-.72*lift+clamp(curl*.2,-.08,.08);
      for(let i=0;i<12&&solved.kneeTarget.y>hip.y-.009;i++){
        fold-=.07;
        endTarget=ankleTarget.clone().add(leg.heelOffset.clone().applyAxisAngle(X,fold));
        solved=triangle(endTarget);
      }
    }
    const {kneeTarget,safeEnd}=solved;
    aim(leg.hip,leg.knee,kneeTarget);
    aim(leg.knee,leg.end,safeEnd);
    if(leg.hock)aim(leg.hock,leg.ankle,ankleTarget);
    orient(leg.ankle,pawTurn.clone().multiply(rest.get(leg.ankle).orientation));
    orient(leg.ball,pawTurn.clone().multiply(rest.get(leg.ball).orientation));
    // Ball is the contact reference, not a guessed visual centre of a sphere.
    const actual=localPoint(leg.ball);
    leg.contactError=actual.distanceTo(ballTarget);
  }
  function reset(){
    restore();cycle=0;blend=0;runBlend=0;initialized=false;wasJumping=false;turnRate=0;velocity.set(0,0,0);
    for(const pose of tailPose){pose.yaw=0;pose.pitch=0;}
    previousWorld=model.getWorldPosition(V());previousForward.copy(model.getWorldDirection(V()));for(const leg of legs){leg.initialized=false;leg.recovery=-1;leg.lastPawWorld.copy(leg.ball.getWorldPosition(V()));}
  }
  function update(dt,time,speed=0,jumpPhase=-1,activity=null){
    dt=clamp(dt,0,.05);if(!Number.isFinite(time))time=0;
    speed=Math.max(0,Number.isFinite(speed)?speed:0);
    model.updateWorldMatrix(true,true);
    const world=model.getWorldPosition(V());
    const displacement=world.clone().sub(previousWorld);displacement.y=0;
    const travelled=displacement.length();
    if(dt>0&&travelled<1.5)velocity.lerp(displacement.clone().multiplyScalar(1/dt),1-Math.exp(-dt*13));
    previousWorld.copy(world);
    const scale=Math.max(.001,model.getWorldScale(V()).y);
    const sizeScale=scale/5.4;
    const jumping=jumpPhase>=0&&jumpPhase<=1;
    blend=T.MathUtils.damp(blend,speed>.07?1:0,9,dt);
    runBlend=T.MathUtils.damp(runBlend,speed>2.5?1:0,7,dt);
    const stride=lerp(.98,2.30,runBlend)*sizeScale;
    // Actual displacement drives the steps, preventing treadmill feet against
    // obstacles. A preview can still advance naturally when explicitly posed.
    const forward=model.getWorldDirection(V());forward.y=0;forward.normalize();
    const signedYaw=Math.atan2(previousForward.clone().cross(forward).y,clamp(previousForward.dot(forward),-1,1));
    const yawDelta=Math.abs(signedYaw);
    turnRate=T.MathUtils.damp(turnRate,dt>0?clamp(signedYaw/dt,-3,3):0,6,dt);
    previousForward.copy(forward);
    if(travelled<1.5&&(!jumping))cycle+=(travelled+yawDelta*.16*sizeScale*blend)/stride;
    if(!initialized){initialized=true;cycle=.10;}
    restore();
    const turn=cycle*Math.PI*2;
    const flightBob=Math.pow(Math.max(0,Math.sin(turn*2-.45)),2)*.010*runBlend*blend;
    const activityWeight=clamp(activity?.weight||0,0,1)*(1-blend);
    const resting=activity?.kind==='rest'?activityWeight:0;
    const eating=activity?.kind==='eat'?activityWeight:0;
    const pawing=['paw','dig'].includes(activity?.kind)?activityWeight:0;
    const bodyDown=(-.018-.027*runBlend)*Math.min(1,blend*1.8) + flightBob;
    const jumpCrouch=jumping?(-.017*Math.exp(-Math.pow((jumpPhase-.02)/.10,2))-.022*Math.exp(-Math.pow((jumpPhase-.94)/.08,2))):0;
    translate(rigRoot,V(0,bodyDown+jumpCrouch-resting*.155-eating*.016,0));
    rotate(root,X,(Math.sin(turn)*.035*runBlend)*blend);
    for(let i=0;i<spine.length;i++){
      rotate(spine[i],X,Math.sin(turn-.45)*.033*runBlend*blend+(i===0?-.012*Math.sin(time*1.6)*(1-blend):0));
      rotate(spine[i],Y,Math.sin(turn+.5)*.004*(1-runBlend)*blend);
    }
    rotate(spine[4],X,Math.sin(time*1.7)*.0035*(1-blend));
    rotate(neck[0],X,-Math.sin(turn-.45)*.085*runBlend*blend);
    rotate(neck[1],X,Math.sin(time*.71)*.018*(1-blend)-Math.sin(turn)*.016*blend);
    rotate(neck[2],Y,Math.sin(time*.43)*.09*(1-blend)+Math.sin(time*.8)*.012*blend);
    rotate(neck[2],Z,Math.sin(time*.31+1.1)*.02*(1-blend));
    rotate(neck[0],X,eating*(.32+Math.sin(time*5)*.055)+resting*.14);
    rotate(neck[1],X,eating*.20+resting*.10);
    // Small overlapping motion: a stable base, softer tip and delayed response
    // to turns. Local segment rotations accumulate, so keep each angle modest.
    for(let i=0;i<tail.length;i++){
      const distal=i/(tail.length-1), pose=tailPose[i];
      const yaw=Math.sin(time*.72-i*.65)*lerp(.018,.038,distal)*(1-.55*blend)
        -turnRate*(.025+.022*distal)
        +Math.sin(turn-i*.55)*.012*runBlend*blend;
      const pitch=(i===0?.19*blend:.025*blend)
        +Math.sin(time*.9-i*.7)*.010*(1-blend)
        +Math.sin(turn-i*.65)*.015*runBlend*blend
        +(jumping?Math.sin(Math.PI*jumpPhase)*(.04+.015*distal):0);
      pose.yaw=T.MathUtils.damp(pose.yaw,clamp(yaw,-.16,.16),8-i*1.3,dt);
      pose.pitch=T.MathUtils.damp(pose.pitch,pitch,9-i*1.4,dt);
      rotate(tail[i],Y,pose.yaw);rotate(tail[i],X,pose.pitch);
    }
    model.updateWorldMatrix(true,true);
    const inverse=new T.Matrix4().copy(model.matrixWorld).invert();
    for(const leg of legs){
      if(resting>.01||eating>.01||pawing>.01){
        const target=leg.paw.clone();
        target.z+=resting*(leg.front?.080:.035);
        target.x+=(leg.side==='l'?1:-1)*resting*.006;
        if(leg.front){const wave=Math.max(0,Math.sin(time*(activity?.kind==='dig'?7:3)+(leg.side==='l'?0:Math.PI)));target.y+=pawing*wave*.032;target.z+=pawing*wave*.036;}
        solveLeg(leg,target,0);
        leg.initialized=false;leg.stance=false;leg.recovery=-1;leg.lastPawWorld.copy(leg.ball.getWorldPosition(V()));continue;
      }
      if(jumping){
        const tuck=Math.sin(Math.PI*clamp((jumpPhase-.08)/.80,0,1));
        const target=leg.paw.clone();
        target.y+=tuck*(leg.front?.038:.040);
        if(!leg.front)target.x+=(leg.side==='l'?1:-1)*.006*tuck;
        target.z+=tuck*(leg.front?-.014:.024);
        solveLeg(leg,target,(leg.front?-.20:.14)*tuck);
        leg.initialized=false;leg.stance=false;leg.recovery=-1;
        leg.lastPawWorld.copy(leg.ball.getWorldPosition(V()));
        continue;
      }
      // Gait-specific touchdown offsets; change phases gently when accelerating.
      const offset=lerp(leg.walkOffset,leg.runOffset,runBlend);
      const phase=fract(cycle-offset);
      const duty=lerp(leg.front?.64:.60,.28,runBlend);
      let stance=phase<duty;
      const span=(stride*duty)/scale;
      const half=span*.5;
      const base=leg.paw.clone();
      const canonicalLanding=base.clone();canonicalLanding.z+=half;
      const nowLanding=model.localToWorld(canonicalLanding);
      if(!leg.initialized||wasJumping||travelled>=1.5){
        const local=base.clone();local.z+=stance?lerp(half,-half,phase/duty):lerp(-half,half,(phase-duty)/(1-duty));
        leg.anchor.copy(model.localToWorld(local));leg.liftOff.copy(leg.anchor);leg.landing.copy(nowLanding);
        leg.stance=stance;leg.initialized=true;
      }
      if(blend<.012){
        leg.target.copy(base);leg.anchor.copy(model.localToWorld(base.clone()));leg.liftOff.copy(leg.anchor);leg.stance=true;
      }else if(stance){
        if(!leg.stance)leg.anchor.copy(leg.landing);
        leg.target.copy(leg.anchor).applyMatrix4(inverse);
        // Height follows the local ground plane while x/z stay locked in world.
        leg.target.y=base.y;
        // Settle toward the rest pose only after the cat has stopped.
        if(speed<.04)leg.target.lerp(base,1-Math.exp(-dt*8));
        leg.liftOff.copy(model.localToWorld(leg.target.clone()));
      }else{
        const u=(phase-duty)/(1-duty);
        if(leg.stance)leg.liftOff.copy(leg.anchor);
        const remaining=(1-u)*(1-duty)*stride/Math.max(speed,.2);
        leg.landing.copy(nowLanding).addScaledVector(velocity,remaining);
        const lift=lerp(.024,.038,runBlend)*Math.sin(Math.PI*u)*blend;
        leg.target.copy(leg.liftOff).lerp(leg.landing,smooth(u)).applyMatrix4(inverse);
        leg.target.y=base.y+lift;
      }
      // A tight turn can put a previously planted paw across the body. Lift
      // and replace that paw instead of twisting its joints toward a stale
      // footprint. The replacement is a short airborne step, never a teleport.
      const offsetFromRest=leg.target.clone().sub(base);
      const strained=Math.abs(offsetFromRest.x)>.055 || Math.abs(offsetFromRest.z)>span*.72+.038;
      if(leg.recovery<0 && stance && strained && speed>.08){
        leg.recovery=0;leg.recoveryStart.copy(leg.lastPawWorld);
      }
      if(leg.recovery>=0){
        leg.recovery+=dt;
        const u=clamp(leg.recovery/.18,0,1);
        const landing=base.clone();landing.z+=half*.28;
        leg.landing.copy(model.localToWorld(landing));
        leg.target.copy(leg.recoveryStart).lerp(leg.landing,smooth(u)).applyMatrix4(inverse);
        leg.target.y=base.y+.045*Math.sin(Math.PI*u);
        stance=false;
        if(u>=1){leg.recovery=-1;leg.anchor.copy(leg.landing);leg.liftOff.copy(leg.landing);stance=phase<duty;}
      }
      leg.target.lerp(base,1-blend);
      // Keep feet in distinct left/right lanes, including sharp turns.
      const sideSign=leg.side==='l'?1:-1;
      leg.target.x=sideSign*Math.max(leg.front?.024:.048,sideSign*leg.target.x);
      const swing=stance?0:Math.max(0,Math.sin(Math.PI*(phase-duty)/(1-duty)));
      const curl=(leg.front?-.28:.17)*swing*blend*smooth(Math.max(0,leg.target.y-base.y)/.018);
      solveLeg(leg,leg.target,curl);
      leg.stance=stance;leg.phase=phase;leg.lastPawWorld.copy(leg.ball.getWorldPosition(V()));
    }
    wasJumping=jumping;
    model.updateWorldMatrix(true,true);faceMixer?.update(dt);
    stats.gait=jumping?'jump':blend<.05?'idle':runBlend>.5?'gallop':'walk';stats.stride=stride;stats.cycle=cycle;
    stats.feet=legs.map(l=>({side:l.side,front:l.front,stance:l.stance,phase:l.phase,error:l.contactError*scale,position:l.ball.getWorldPosition(V()).toArray(),target:model.localToWorld(l.target.clone()).toArray()}));
  }
  return {update,reset,stats,legs};
}
