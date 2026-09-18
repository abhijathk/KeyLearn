from pathlib import Path
code=(Path(__file__).parent/'build_paddy_dense.py').read_text()
start=code.index('\nobjects=[newfield');end=code.index('\nfor o in objects:\n    for ob in tree(o):ob.hide_render=True')
replacement='''
def tree(o):
    yield o
    for c in o.children:yield from tree(c)
path=OUT/'KeralaPaddy_Dense_v3.glb'
bpy.ops.import_scene.gltf(filepath=str(path))
roots=[o for o in bpy.context.scene.objects if o.parent is None]
objects=sorted([o for o in roots if o.name.startswith('Paddy_Rice_Dense')],key=lambda o:o.name)+[o for o in roots if o.name.startswith('Varambu_')]
'''
exec(code[:start]+replacement+code[end:].replace("'paddy_dense_v3.png'","'paddy_dense_v3_export_QA.png'"))
