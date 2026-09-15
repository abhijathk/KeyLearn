from pathlib import Path
exec((Path(__file__).parent/'build_paddy.py').read_text().split('objects=[field')[0])
OUT=BASE/'models/nature'
mats.extend([material('Bamboo olive stem',(.23,.32,.095)),material('Bamboo nodes',(.35,.40,.16))])
variants=[]
for variant in range(3):
 v=[];f=[];mi=[]
 def pole(a,b,r,idx):
  axis=(Vector(b)-Vector(a)).normalized();u=axis.cross(Vector((0,1,0))).normalized();w=axis.cross(u)
  k=len(v)
  for p in (Vector(a),Vector(b)):
   for n in range(5):v.append(tuple(p+r*(u*math.cos(n*math.tau/5)+w*math.sin(n*math.tau/5))))
  for n in range(5):f.append((k+n,k+(n+1)%5,k+5+(n+1)%5,k+5+n));mi.append(idx)
 for stem in range(4+variant):
  a=stem*2.4;x=.48*math.cos(a);y=.48*math.sin(a);h=random.uniform(2.6,3.8);lx=random.uniform(-.35,.35);ly=random.uniform(-.35,.35)
  pole((x,y,0),(x+lx,y+ly,h),.034,6)
  for node in range(1,8):
   z=h*node/8;xx=x+lx*node/8;yy=y+ly*node/8;pole((xx,yy,z),(xx,yy,z+.026),.039,7)
   if node<4:continue
   direction=a+node*2.1;bx=xx+math.cos(direction)*.55;by=yy+math.sin(direction)*.55;bz=z+.16
   pole((xx,yy,z),(bx,by,bz),.009,6)
   for leaf in range(5):
    t=.25+leaf*.15;cx=xx+(bx-xx)*t;cy=yy+(by-yy)*t;cz=z+(bz-z)*t
    ang=direction+(-1 if leaf%2 else 1)*.75;dx=math.cos(ang);dy=math.sin(ang);length=random.uniform(.22,.35);wid=.035;k=len(v)
    v.extend([(cx,cy,cz),(cx+dx*length*.45-dy*wid,cy+dy*length*.45+dx*wid,cz+.035),(cx+dx*length,cy+dy*length,cz-.055),(cx+dx*length*.45+dy*wid,cy+dy*length*.45-dx*wid,cz+.035)])
    f.extend([(k,k+1,k+2),(k,k+2,k+3)]);mi.extend([2+leaf%2]*2)
 variants.append(mesh('Bamboo_Cluster_%02d'%(variant+1),v,f,mi))
bpy.ops.object.select_all(action='DESELECT')
for o in variants:o.select_set(True)
bpy.context.view_layer.objects.active=variants[0]
path=OUT/'KeralaBambooGroves.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
for i,o in enumerate(variants):o.location.x=(i-1)*3
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(material('Ground',(.32,.29,.23)))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.world.color=(.6,.6,.6)
bpy.ops.object.light_add(type='AREA',location=(0,-4,10));bpy.context.object.data.energy=1600;bpy.context.object.data.size=8
bpy.ops.object.camera_add(location=(8,-15,7));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.5))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=12;scene.camera=cam
scene.render.resolution_x=1100;scene.render.resolution_y=650;scene.render.resolution_percentage=100;scene.render.filepath=str(QA/'bamboo_variants.png');bpy.ops.render.render(write_still=True)
print('BAMBOO_BYTES',path.stat().st_size)
