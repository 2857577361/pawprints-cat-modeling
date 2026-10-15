"""Local UV baking from supplied reference photographs. No network or original coat colour.
Front-face projection is manually registered to anatomical landmarks; body uses
photo patches with conservative masks. Unseen regions are documented estimates.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import argparse, json, struct, io
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--reference-dir',type=Path,required=True,help='Local folder with numbered 01.jpg … 12.jpg from the reference manifest')
parser.add_argument('--output-dir',type=Path,default=Path(__file__).resolve().parents[1]/'public/models')
parser.add_argument('--audit-dir',type=Path,required=True)
args=parser.parse_args();REF=args.reference_dir;OUT=args.output_dir;ROOT=args.audit_dir
OUT.mkdir(parents=True,exist_ok=True);ROOT.mkdir(parents=True,exist_ok=True)
N=2048
blob=(Path(__file__).resolve().parents[1]/'public/models/companion-cat.glb').read_bytes()
size=struct.unpack_from('<I',blob,12)[0];gltf=json.loads(blob[20:20+size]);binary=blob[28+size:]
def accessor(index):
 a=gltf['accessors'][index];view=gltf['bufferViews'][a['bufferView']]
 dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dtype=np.dtype({5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']])
 return np.ndarray((a['count'],dim),dtype=dtype,buffer=binary,offset=view.get('byteOffset',0)+a.get('byteOffset',0),strides=(view.get('byteStride',dtype.itemsize*dim),dtype.itemsize)).copy()
body=gltf['meshes'][1]['primitives'][0];attributes=body['attributes']
p=accessor(attributes['POSITION']);uv=accessor(attributes['TEXCOORD_0']);ix=accessor(body['indices']).reshape(-1,3);norm=accessor(attributes['NORMAL'])
imageView=gltf['bufferViews'][gltf['images'][0]['bufferView']]
originalBytes=binary[imageView['byteOffset']:imageView['byteOffset']+imageView['byteLength']]
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def mix(a,b,t):return a*(1-t[...,None])+b*t[...,None]
def photo(n):
 im=Image.open(REF/f'{n:02}.jpg').convert('RGB');im.thumbnail((1824,1824));return np.asarray(im).astype(float)
def sample(im,x,y):
 x=np.clip(x,0,im.shape[1]-1.001);y=np.clip(y,0,im.shape[0]-1.001);a=x.astype(int);b=y.astype(int);u=(x-a)[...,None];v=(y-b)[...,None]
 return im[b,a]*(1-u)*(1-v)+im[b,a+1]*u*(1-v)+im[b+1,a]*(1-u)*v+im[b+1,a+1]*u*v
# Rasterize original UV triangles once. Track distinct surface overlap, not shared edges.
pos=np.zeros((N,N,3),np.float32);ns=pos.copy();mask=np.zeros((N,N),bool);conflicts=0
for tri in ix:
 t=uv[tri]*(N-1);x0,y0=np.floor(t.min(0)).astype(int);x1,y1=np.ceil(t.max(0)).astype(int);x0=max(x0,0);y0=max(y0,0);x1=min(x1,N-1);y1=min(y1,N-1)
 X,Y=np.meshgrid(np.arange(x0,x1+1),np.arange(y0,y1+1));v0=t[1]-t[0];v1=t[2]-t[0];den=v0[0]*v1[1]-v1[0]*v0[1]
 if abs(den)<1e-9:continue
 u=((X-t[0,0])*v1[1]-(Y-t[0,1])*v1[0])/den;v=(v0[0]*(Y-t[0,1])-v0[1]*(X-t[0,0]))/den
 ok=(u>=0)&(v>=0)&(u+v<=1);yy=Y[ok];xx=X[ok];w=np.stack([1-u[ok]-v[ok],u[ok],v[ok]],1);q=w@p[tri]
 conflicts+=np.count_nonzero(mask[yy,xx]&(np.linalg.norm(pos[yy,xx]-q,axis=1)>.005))
 pos[yy,xx]=q;ns[yy,xx]=w@norm[tri];mask[yy,xx]=True
print('Distinct-surface overlap pixels:',conflicts,flush=True)
if conflicts>100:raise RuntimeError('UV overlaps need inspection')
yy,xx=np.where(mask);q=pos[yy,xx];normal=ns[yy,xx];x,y,z=q.T;a=np.abs(x)
photos={i:photo(i) for i in [1,4,10,11,12]}
# These patches contain coat only, without background or eyes; preserve natural strand detail.
def patch(im,rect,s,t):
 l,top,r,bottom=rect;return sample(im,l+np.clip(s,0,1)*(r-l),top+np.clip(t,0,1)*(bottom-top))
# Exclude photographed eyeballs/nasal leather before projection; the app has real eye meshes.
for number,regions in {11:[(475,408,65,55,[171,171,164]),(724,430,68,54,[169,169,160]),(580,610,65,40,[181,179,170])],4:[(661,403,42,42,[221,214,195]),(815,404,49,42,[138,120,87]),(737,532,39,24,[224,217,198])]}.items():
 im=photos[number];Y,X=np.indices(im.shape[:2])
 for cx,cy,rx,ry,col in regions:
  dist=np.sqrt(((X-cx)/rx)**2+((Y-cy)/ry)**2);w=1-smooth(.85,1.12,dist)
  im[:]=mix(im,np.array(col,dtype=float),w)
baseOriginal=np.asarray(Image.open(io.BytesIO(originalBytes)).convert('RGB')).astype(float)
original=sample(baseOriginal,xx/(N-1)*(baseOriginal.shape[1]-1),yy/(N-1)*(baseOriginal.shape[0]-1))
rows=np.array([.250,.265,.273,.286,.308,.326,.340,.370])
for cat in ['shupian','yangyang']:
 gray=cat=='shupian'
 white=np.array([223.,222.,215.]) if gray else np.array([234.,232.,222.])
 if gray:
  body=patch(photos[11],(1010,420,1640,840),(.16-z)/.35,(.27-y)/.13)
  # This reference has warm indoor lighting; neutralise excess yellow without erasing markings.
  lum=112+body.mean(-1)*.38;body=np.stack([lum*.99,lum,lum*1.015],-1)
  back=patch(photos[12],(1150,285,1410,835),x/.14+.5,(z+.18)/.34)
  bl=87+back.mean(-1)*.47;back=np.stack([bl*.99,bl,bl*1.015],-1)
  body=mix(body,back,smooth(.22,.265,y)*(1-smooth(.10,.19,z)))
  # Patch photographed on the actual front leg; bands are not inherited from the source cat.
  legs=patch(photos[1],(515,1240,598,1560),a/.07,1-y/.18)
  ll=75+legs.mean(-1)*.55;legs=np.stack([ll*.99,ll,ll*1.015],-1)
  body=mix(body,legs,(1-smooth(.135,.185,y))*smooth(.016,.034,a))
  belly=(1-smooth(.12,.18,y))*(1-smooth(.018,.045,a))
  bib=smooth(.11,.18,z)*(1-smooth(.235,.274,y))*smooth(.14,.20,y)
  toes=1-smooth(.018,.036,y)
  body=mix(body,white,np.maximum.reduce([belly*.75,bib,toes*.94]))
  # Broad fluffy silver tail with darker end, based on photos 2 and 10.
  tail=1-smooth(-.238,-.205,z);tl=np.clip((-.22-z)/.19,0,1)
  tailCol=np.stack([150-52*tl,152-52*tl,153-51*tl],-1)
  body=mix(body,tailCol,tail)
  body=mix(body,np.array([155.,156.,155.]),smooth(.19,.23,z)*smooth(.28,.32,y))
  face=photos[11];py=np.interp(y,rows,[805,730,679,608,418,288,170,0])+750*x;px=583+x*5900
  faceRGB=sample(face,px,py)
  fl=faceRGB.mean(-1);faceRGB=mix(faceRGB,np.stack([fl*1.005,fl,fl*.985],-1),np.full_like(x,.60))
 else:
  # White fur microtexture from the actual shoulder (no blue fabric).
  body=patch(photos[4],(1120,360,1390,650),(.17-z)/.36,(.27-y)/.22)
  body=mix(body,white,np.full_like(x,.72))
  # Asymmetric head cap: anatomical right (-X) orange, left (+X) dark tabby.
  orange=patch(photos[4],(604,250,663,299),a/.06,(y-.29)/.05)
  dark=patch(photos[4],(825,243,916,302),a/.06,(y-.29)/.05)
  cap=mix(orange,dark,smooth(-.004,.003,x))
  h=smooth(.18,.225,z)*smooth(.286,.304,y)
  body=mix(body,cap,h)
  # Distinct orange nape patch seen in top-down photo 12; preserve white shoulders.
  nape=np.exp(-((x+.008)/.033)**4-((z-.175)/.052)**4)*smooth(.255,.285,y)
  body=mix(body,np.array([175.,120.,66.]),nape)
  rump=(1-smooth(.75,1.05,np.sqrt(((x+.018)/.050)**2+((z+.174)/.062)**2)))*smooth(.22,.26,y)
  body=mix(body,np.array([168.,119.,68.]),rump)
  tail=1-smooth(-.24,-.208,z)
  t=np.clip((-.21-z)/.195,0,1)
  knots=np.array([0,.25,.5,.75,1]);cx=np.interp(t,knots,[1385,1490,1550,1575,1620]);cy=np.interp(t,knots,[855,864,915,985,1050])
  across=np.clip(x/.025,-1,1)*24
  tailRGB=sample(photos[10],cx+across*.65,cy-across*.76)
  # Real tail rings from the shared windowsill photo, not evenly spaced sinusoids.
  tailRGB=tailRGB*np.array([1.04,1.02,.98])
  body=mix(body,tailRGB,tail)
  face=photos[4];py=np.interp(y,rows,[680,620,585,532,404,280,205,78]);px=735+x*np.interp(y,rows,[1500,1800,2300,3000,3650,3600,3400,3100])
  faceRGB=sample(face,px,py)
  # Correct cool cast using a conservative constant white balance; retain orange/black contrast.
  faceRGB=faceRGB*np.array([1.04,1.02,.98])
 # Only project front-facing head. Eye holes remain independent geometry.
 head=smooth(.236,.267,z)*smooth(.247,.267,y)*(1-smooth(.336,.350,y))
 front=smooth(.05,.48,-normal[:,2])
 projection=head*front
 body=mix(body,faceRGB*(.88 if gray else 1),projection)
 if not gray:
  gingerMask=(1-smooth(-.025,-.007,x))*smooth(.307,.329,y)*(1-smooth(.343,.355,y))*smooth(.21,.25,z)
  gingerDetail=np.clip(faceRGB.mean(-1)/185,.65,1.2)
  body=mix(body,np.array([181.,130.,76.])*gingerDetail[:,None],gingerMask*.70)
 # Ear shell uses the cat's coat, while only the forward-facing concha is pink.
 ear=smooth(.331,.342,y)*smooth(.015,.028,a)
 shell=np.tile([180.,181.,178.] if gray else [221.,214.,199.],(len(x),1))
 if not gray:
  shell=mix(shell,np.array([177.,128.,78.]),1-smooth(-.025,-.01,x))
 inner=smooth(.12,.58,-normal[:,2])*smooth(.338,.348,y)*(1-smooth(.354,.372,y))
 detail=np.clip(original.mean(-1)/160,.78,1.16)
 pink=np.array([226.,176.,174.])*detail[:,None]
 earColour=mix(shell,pink,inner*.95)
 body=mix(body,earColour,ear)
 pad=(1-smooth(.003,.009,y))*smooth(.08,.23,original[:,0]/255-original[:,1]/255)
 body=mix(body,original,pad)
 # Nasal leather now has its own rounded skinned geometry. The underlying
 # coat is neutral so the original long, flat triangle cannot show at its edges.
 nose=smooth(.295,.300,z)*(1-smooth(.006,.009,a))*smooth(.278,.283,y)*(1-smooth(.293,.297,y))
 body=mix(body,white,nose)
 body=np.clip(body,0,255)
 atlas=np.zeros((N,N,3),np.uint8);atlas[:]=white;atlas[yy,xx]=body.astype(np.uint8)
 # UV gutters dilated 12 px to prevent mip seams; no new colours in filled islands.
 filled=mask.copy()
 for _ in range(12):
  sums=np.zeros_like(atlas,dtype=np.float32);count=np.zeros((N,N),np.float32)
  for axis in [0,1]:
   for delta in [-1,1]:
    f=np.roll(filled,delta,axis);sums+=np.roll(atlas,delta,axis)*f[...,None];count+=f
  new=(~filled)&(count>0);atlas[new]=(sums[new]/count[new,None]).astype(np.uint8);filled|=new
 Image.fromarray(atlas).save(OUT/f'coat-{cat}.png')
 print(cat,'saved',flush=True)
# Debugging aid: mapping coloured by source-space region, original UV unchanged.
report={'resolution':N,'uv_overlap_pixels':int(conflicts),'source_photos':{'shupian':[11,12,2,10],'yangyang':[4,12,10]},'method':'registered frontal photo projection, photo sampled body patches, conservative unseen-region fills','limitations':['Photos retain some lighting; correction is approximate, not calibrated albedo recovery.','Back of ears, full flanks and underside lack orthographic coverage.','Tail ring placement is estimated from visible references.']}
import json
(ROOT/'bake-report.json').write_text(json.dumps(report,indent=2))
