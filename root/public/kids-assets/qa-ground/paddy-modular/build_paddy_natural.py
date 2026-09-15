from pathlib import Path
exec((Path(__file__).parent/'build_paddy.py').read_text().split('objects=[field')[0].replace('range(5):','range(4):'))
OUT=BASE/'models/nature/paddy-modular'
# Shared small earth texture, embedded once in the collection.
tex=bpy.data.images.load(str(BASE/'textures/laterite_mud_diff.jpg'))
tex.scale(128,128);tex.file_format='JPEG';tex.filepath_raw=str(QA/'varambu_earth_128.jpg');tex.save();tex.pack()
for i,col in [(4,(.48,.52,.40,1)),(5,(.68,.71,.46,1))]:
    m=mats[i];p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=col
    t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=tex
    mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=col
    m.node_tree.links.new(t.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
    # glTF export uses a direct texture; vertex colour supplies damp earth tint.
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Tint'
    m.node_tree.links.new(vc.outputs['Color'],mix.inputs[2])
water=mats[1].node_tree.nodes.get('Principled BSDF');water.inputs['Base Color'].default_value=(.14,.155,.085,1);water.inputs['Roughness'].default_value=.23
# Small periodic water material maps: suspended silt and restrained ripples.
for kind in ['color','normal']:
    im=bpy.data.images.new('Muddy_water_'+kind,width=64,height=64)
    if kind=='normal':im.colorspace_settings.name='Non-Color'
    px=[]
    for y in range(64):
      for x in range(64):
        u=x*math.tau/64;v=y*math.tau/64
        n=.5*math.sin(u+2*v)+.3*math.sin(3*u-v)+.2*math.cos(2*u+3*v)
        if kind=='color':px.extend((.37+.025*n,.345+.022*n,.245+.017*n,1))
        else:px.extend((.5+.018*math.cos(3*u+v),.5+.012*math.cos(u+2*v),.999,1))
    im.pixels[:]=px;im.filepath_raw=str(QA/('muddy_water_'+kind+'.png'));im.file_format='PNG';im.save();im.pack()
    t=mats[1].node_tree.nodes.new('ShaderNodeTexImage');t.image=im
    if kind=='color':mats[1].node_tree.links.new(t.outputs['Color'],water.inputs['Base Color'])
    else:
        nm=mats[1].node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.3
        mats[1].node_tree.links.new(t.outputs['Color'],nm.inputs['Color']);mats[1].node_tree.links.new(nm.outputs['Normal'],water.inputs['Normal'])
def warp(x,y):
    return x+.30*math.sin(y*math.pi/2)+.10*math.sin((x+y)*math.pi/2),y+.24*math.sin(x*math.pi/2)+.08*math.sin((y-x)*math.pi/2)
oldmesh=mesh
def mesh(name,v,f,mi):
    phase=2 if name.startswith('Paddy') else 0
    warped=[]
    for x,y,z in v:
        xx,yy=warp(x+phase,y+phase);warped.append((xx-phase,yy-phase,z))
    o=oldmesh(name,warped,f,mi)
    uv=o.data.uv_layers.new(name='UVMap');color=o.data.color_attributes.new(name='Tint',type='FLOAT_COLOR',domain='CORNER')
    for p in o.data.polygons:
        for li in p.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co
            uv.data[li].uv=(co.x*1.5,co.y*1.5)
            if p.material_index in (4,5):
                h=max(0,min(1,co.z/.18));color.data[li].color=(.38+.26*h,.44+.25*h,.31+.13*h,1)
            else:color.data[li].color=(1,1,1,1)
    o.data.color_attributes.remove(color)
    return o
oldfield=field
def field(name,dense):
    o=oldfield(name,dense)
    # Replace the single water quad with a flat, warped border grid.
    v=[tuple(p.co) for p in o.data.vertices];f=[];mi=[]
    for p in list(o.data.polygons)[1:]:f.append(tuple(p.vertices));mi.append(p.material_index)
    for y in range(8):
      for x in range(8):
        k=len(v)
        for xx,yy in [(x,y),(x+1,y),(x+1,y+1),(x,y+1)]:
            wx,wy=warp(xx*.5,yy*.5);v.append((wx-2,wy-2,0))
        f.append((k,k+1,k+2,k+3));mi.append(1)
    bpy.data.objects.remove(o,do_unlink=True)
    o=oldmesh(name,v,f,mi)
    uv=o.data.uv_layers.new(name='UVMap')
    for loop in o.data.loops:
        c=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=((c.x+2)/4,(c.y+2)/4)
    return o
# Softer cross sections; fixed end connectors, irregular interior widths.
def bund(name,dirs):
    v=[];f=[];mi=[]
    def face(points,index):
        k=len(v);v.extend(points);f.append(tuple(range(k,len(v))));mi.append(index)
    face([(-.16,-.16,.18),(.16,-.16,.18),(.16,.16,.18),(-.16,.16,.18)],5)
    for d in range(4):
        a=d*math.pi/2
        def p(x,y,z):return(x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a),z)
        if d in dirs:
            rings=[]
            for i in range(5):
                y=.16+(2-.16)*i/4;t=i/4;s=math.sin(math.pi*t)
                w=.16+s*(.035*math.sin(t*9+d)+.015);h=.18+s*.034*math.sin(t*8+d)
                rings.append([( -w-.15,y,0),(-w-.045,y,h*.68),(-w,y,h),(w,y,h),(w+.045,y,h*.68),(w+.15,y,0)])
            for r,rr in zip(rings,rings[1:]):
                for i in range(5):face([p(*r[i]),p(*rr[i]),p(*rr[i+1]),p(*r[i+1])],5 if i==2 else 4)
        else:face([p(-.16,.16,.18),p(.16,.16,.18),p(.31,.31,0),p(-.31,.31,0)],4)
    return mesh(name,v,f,mi)
objects=[field('Paddy_Rice_Dense',True),field('Paddy_Rice_Sparse',False),bund('Varambu_Straight_NS',[0,2]),bund('Varambu_Straight_EW',[1,3])]
for dirs in ([0,1],[1,2],[2,3],[3,0],[0,1,2],[1,2,3],[2,3,0],[3,0,1],[0,1,2,3]):objects.append(bund('Varambu_'+''.join(map(str,dirs)),dirs))
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
path=OUT/'KeralaPaddy_Natural_v2.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_normals=False,export_image_format='AUTO')
for o in objects:o.hide_render=True
for x in range(3):
 for y in range(2):
    o=bpy.data.objects.new('Field',objects[(x+y)%2].data);bpy.context.collection.objects.link(o);o.location=(x*4+2,y*4+2,0)
for x in range(4):
 for y in range(3):
    ds=[]
    if y<2:ds.append(0)
    if x>0:ds.append(1)
    if y>0:ds.append(2)
    if x<3:ds.append(3)
    o=bund('Joined',ds);o.location=(x*4,y*4,0)
bpy.ops.mesh.primitive_plane_add(size=200,location=(6,4,-.018));bpy.context.object.data.materials.append(material('Surrounding ground',(.26,.235,.16)))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.world.color=(.65,.65,.65)
bpy.ops.object.light_add(type='AREA',location=(6,12,10));bpy.context.object.data.energy=2500;bpy.context.object.data.size=10
bpy.ops.object.camera_add(location=(18,-19,17));cam=bpy.context.object;cam.rotation_euler=(Vector((6,4,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=19;scene.camera=cam
scene.render.resolution_x=1200;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.render.filepath=str(QA/'paddy_natural_v2.png');bpy.ops.render.render(write_still=True)
print('OUTPUT_BYTES',path.stat().st_size)
