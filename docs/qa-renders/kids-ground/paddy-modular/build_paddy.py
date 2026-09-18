import bpy, math, random, json
from pathlib import Path
from mathutils import Vector

BASE=Path(__file__).resolve().parents[2]
OUT=BASE/'models/nature/paddy-modular'
QA=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
random.seed(61)
def material(name,color,roughness=1):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=roughness
    return m
mats=[material('Wet paddy earth',(0.105,.135,.065)),material('Shallow paddy water',(.18,.245,.14),.27),material('Rice green',(.20,.46,.075)),material('Rice light',(.32,.57,.115)),material('Varambu earth',(.30,.17,.085)),material('Varambu grassy top',(.29,.34,.115))]
def mesh(name,v,f,mi):
    me=bpy.data.meshes.new(name); me.from_pydata(v,[],f); me.update()
    ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob)
    for m in mats: me.materials.append(m)
    for p,i in zip(me.polygons,mi):p.material_index=i
    return ob
def field(name,dense):
    v=[(-2,-2,0),(2,-2,0),(2,2,0),(-2,2,0)]; f=[(0,1,2,3)]; mi=[1]
    for row in range(8):
      for col in range(8):
        if random.random()>(.96 if dense else .77):continue
        x=-1.55+col*.44+random.uniform(-.09,.09); y=-1.55+row*.44+.05*math.sin(col*1.8+row)+random.uniform(-.07,.07)
        clump_height=random.uniform(.29,.44)
        for blade in range(5):
          a=random.random()*math.tau; h=clump_height*random.uniform(.75,1.15); lean=random.uniform(.08,.19); w=.016
          dx,dy=math.cos(a),math.sin(a); k=len(v)
          v.extend([(x-dy*w*.45,y+dx*w*.45,.004),(x+dy*w*.45,y-dx*w*.45,.004),(x+dx*lean*.28-dy*w,y+dy*lean*.28+dx*w,h*.62),(x+dx*lean*.28+dy*w,y+dy*lean*.28-dx*w,h*.62),(x+dx*lean,y+dy*lean,h)])
          f.extend([(k,k+1,k+3,k+2),(k+2,k+3,k+4)]);mi.extend([2+blade%2]*2)
    return mesh(name,v,f,mi)
def bund(name,dirs):
    v=[]; f=[]; mi=[]
    # Center square and arms share matching seam heights and widths.
    def section(points):
        k=len(v);v.extend(points);f.append(tuple(range(k,k+len(points))));mi.append(5)
    section([(-.19,-.19,.18),(.19,-.19,.18),(.19,.19,.18),(-.19,.19,.18)])
    for d in range(4):
      a=d*math.pi/2
      def p(x,y,z):return (x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a),z)
      if d in dirs:
        rings=[(.19,.19,.30,.18),(.65,.205,.315,.185),(1.15,.175,.285,.165),(1.65,.195,.305,.175),(2,.19,.30,.18)]
        for aa,bb in zip(rings,rings[1:]):
          y,w,b,h=aa; yy,ww,bbb,hh=bb
          section([p(-w,y,h),p(w,y,h),p(ww,yy,hh),p(-ww,yy,hh)])
          for s in [-1,1]:
            k=len(v);v.extend([p(s*w,y,h),p(s*ww,yy,hh),p(s*bbb,yy,0),p(s*b,y,0)]);f.append(tuple(range(k,k+4)));mi.append(4)
      else:
        k=len(v);v.extend([p(-.19,.19,.18),p(.19,.19,.18),p(.30,.30,0),p(-.30,.30,0)]);f.append(tuple(range(k,k+4)));mi.append(4)
    return mesh(name,v,f,mi)
objects=[field('Paddy_Rice_Dense',True),field('Paddy_Rice_Sparse',False),bund('Varambu_Straight',[0,2]),bund('Varambu_Corner',[0,1]),bund('Varambu_T',[0,1,2]),bund('Varambu_Cross',[0,1,2,3]),bund('Varambu_End',[0])]
inventory=[]
for o in objects:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    path=OUT/(o.name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
    inventory.append({'name':o.name,'bytes':path.stat().st_size,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)})
for o in objects:o.hide_render=True
# Actual mesh assembly: 3 x 2 paddy cells, bund junction grid at 4m spacing.
for x in range(3):
 for y in range(2):
    src=objects[(x+y)%2];o=bpy.data.objects.new('Field',src.data);bpy.context.collection.objects.link(o);o.location=(x*4+2,y*4+2,0)
for x in range(4):
 for y in range(3):
    dirs=[]
    if y<2:dirs.append(0)
    if x>0:dirs.append(1)
    if y>0:dirs.append(2)
    if x<3:dirs.append(3)
    o=bund('Joined_varambu',dirs);o.location=(x*4,y*4,0)
bpy.ops.mesh.primitive_plane_add(size=200,location=(6,4,-.015));bpy.context.object.data.materials.append(material('Neutral ground',(.30,.28,.22)))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
scene.world.color=(.55,.55,.55)
bpy.ops.object.light_add(type='AREA',location=(0,-4,14));bpy.context.object.data.energy=2200;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=12
bpy.ops.object.camera_add(location=(18,-19,17));cam=bpy.context.object;cam.rotation_euler=(Vector((6,4,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=20;scene.camera=cam
scene.render.resolution_x=1200;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.render.filepath=str(QA/'paddy_joined_preview.png');bpy.ops.render.render(write_still=True)
(QA/'inventory.json').write_text(json.dumps(inventory,indent=2))
