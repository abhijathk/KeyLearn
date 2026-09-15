from pathlib import Path
exec((Path(__file__).parent/'build_paddy_natural.py').read_text().split('\nobjects=[field')[0])
random.seed(83)
# Diffuse vertex colours interpolate damp soil, worn path and grassy shoulders.
for i in (4,5):
    m=mats[i];m.node_tree.nodes.clear();p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');p.inputs['Roughness'].default_value=.96
    c=m.node_tree.nodes.new('ShaderNodeVertexColor');c.layer_name='GroundColor'
    output=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(c.outputs['Color'],p.inputs['Base Color']);m.node_tree.links.new(p.outputs[0],output.inputs[0])
water.inputs['Roughness'].default_value=.3
# Avoid visible periodic colour bands on the water.
for link in list(water.inputs['Base Color'].links):mats[1].node_tree.links.remove(link)
water.inputs['Base Color'].default_value=(.125,.12,.065,1)
def clump(name,scale):
    v=[];f=[];mi=[]
    for k in range(8):
        a=k*2.4+random.uniform(-.3,.3);h=random.uniform(.40,.59)*scale;l=random.uniform(.10,.19)*scale;w=.022*scale;dx=math.cos(a);dy=math.sin(a);n=len(v)
        v.extend([(-dy*w*.25,dx*w*.25,0),(dy*w*.25,-dx*w*.25,0),(dx*l*.35-dy*w,dy*l*.35+dx*w,h*.65),(dx*l*.35+dy*w,dy*l*.35-dx*w,h*.65),(dx*l,dy*l,h)])
        f.extend([(n,n+1,n+3,n+2),(n+2,n+3,n+4)]);mi.extend([2+k%2]*2)
    o=oldmesh(name,v,f,mi);data=o.data;bpy.data.objects.remove(o,do_unlink=True);return data
rice=[clump('RiceClump_'+str(i),1) for i in range(3)];grass=clump('BundGrass',.36)
def instance(data,parent,loc,scale=1):
    o=bpy.data.objects.new(data.name,data);bpy.context.collection.objects.link(o);o.parent=parent;o.location=loc;o.scale=(scale,scale,scale);o.rotation_euler.z=random.uniform(-.4,.4);return o
def newfield(name,seed):
    random.seed(seed);o=field(name,False)
    # Only water geometry remains in the root; clumps share three meshes.
    polys=[p for p in o.data.polygons if p.material_index==1];v=[];f=[]
    for p in polys:
        k=len(v);v.extend([tuple(o.data.vertices[i].co) for i in p.vertices]);f.append(tuple(range(k,len(v))))
    bpy.data.objects.remove(o,do_unlink=True);o=oldmesh(name,v,f,[1]*len(f))
    uv=o.data.uv_layers.new(name='UVMap')
    for loop in o.data.loops:
        c=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=((c.x+2)/4,(c.y+2)/4)
    for y in range(12):
      for x in range(12):
        if random.random()<.025:continue
        xx=.34+x*.3+random.uniform(-.045,.045);yy=.34+y*.3+random.uniform(-.055,.055);wx,wy=warp(xx,yy)
        instance(rice[(x+y)%3],o,(wx-2,wy-2,.003),random.uniform(.83,1.12))
    return o
oldbund=bund
def newbund(name,dirs):
    o=oldbund(name,dirs);c=o.data.color_attributes.new(name='GroundColor',type='FLOAT_COLOR',domain='CORNER')
    for p in o.data.polygons:
      for li in p.loop_indices:
        v=o.data.vertices[o.data.loops[li].vertex_index].co;h=max(0,min(1,v.z/.18));noise=.025*math.sin(v.x*4.1+v.y*2.3)
        base=(.075+.10*h,.069+.065*h,.035+.035*h)
        c.data[li].color=tuple(max(.01,a+noise) for a in base)+(1,)
    for d in dirs:
      a=d*math.pi/2
      for k in range(7):
        y=.38+k*.225+random.uniform(-.05,.05);x=random.choice([-1,1])*random.uniform(.17,.25);xx=x*math.cos(a)-y*math.sin(a);yy=x*math.sin(a)+y*math.cos(a);wx,wy=warp(xx,yy)
        instance(grass,o,(wx,wy,.135),random.uniform(.7,1.35))
    return o
objects=[newfield('Paddy_Rice_Dense_A',13),newfield('Paddy_Rice_Dense_B',27)]
patterns=[[0,2],[1,3],[0,1],[1,2],[2,3],[3,0],[0,1,2],[1,2,3],[2,3,0],[3,0,1],[0,1,2,3]]
for ds in patterns:objects.append(newbund('Varambu_'+''.join(map(str,ds)),ds))
def tree(o):
    yield o
    for child in o.children:yield from tree(child)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:
    for ob in tree(o):ob.select_set(True)
bpy.context.view_layer.objects.active=objects[0];path=OUT/'KeralaPaddy_Dense_v3.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_normals=False,export_image_format='AUTO')
for o in objects:
    for ob in tree(o):ob.hide_render=True
def clone(src,parent=None):
    o=src.copy();o.data=src.data;bpy.context.collection.objects.link(o);o.parent=parent;o.hide_render=False
    for c in src.children:clone(c,o)
    return o
for x in range(3):
 for y in range(2):clone(objects[(x+y)%2]).location=(x*4+2,y*4+2,0)
for x in range(4):
 for y in range(3):
    ds=[]
    if y<2:ds.append(0)
    if x>0:ds.append(1)
    if y>0:ds.append(2)
    if x<3:ds.append(3)
    src=next(o for o in objects[2:] if set(o.name.split('_')[1])==set(map(str,ds)));clone(src).location=(x*4,y*4,0)
bpy.ops.mesh.primitive_plane_add(size=200,location=(6,4,-.018));bpy.context.object.data.materials.append(material('Surrounding ground',(.26,.235,.16)))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.world.color=(.65,.65,.65)
bpy.ops.object.light_add(type='AREA',location=(6,12,10));bpy.context.object.data.energy=2500;bpy.context.object.data.size=10
bpy.ops.object.camera_add(location=(18,-19,17));cam=bpy.context.object;cam.rotation_euler=(Vector((6,4,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=19;scene.camera=cam
scene.render.resolution_x=1200;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.render.filepath=str(QA/'paddy_dense_v3.png');bpy.ops.render.render(write_still=True)
print('OUTPUT_BYTES',path.stat().st_size)
