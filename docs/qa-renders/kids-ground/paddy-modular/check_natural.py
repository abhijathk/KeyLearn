import json,struct,math
from pathlib import Path
p=Path(__file__).resolve().parents[2]/'models/nature/paddy-modular/KeralaPaddy_Natural_v2.glb'
b=p.read_bytes();assert b[:4]==b'glTF' and struct.unpack_from('<I',b,8)[0]==len(b)
n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:]
def read(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];fmt={5126:'f',5123:'H',5125:'I',5121:'B'}[a['componentType']];dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];sz=struct.calcsize(fmt)*dim;stride=v.get('byteStride',sz);off=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*dim,binary,off+k*stride) for k in range(a['count'])]
tri=0
for m in j['meshes']:
 for prim in m['primitives']:
  verts=read(prim['attributes']['POSITION']);assert all(math.isfinite(x) for v in verts for x in v)
  ix=read(prim['indices']);assert all(0<=x[0]<len(verts) for x in ix);tri+=len(ix)//3
assert len(j['scenes'][0]['nodes'])==13
assert not j.get('animations') and not j.get('skins') and not j.get('cameras')
assert len(b)<=150000
report={'bytes':len(b),'triangles':tri,'root_modules':13,'embedded_images':len(j['images']),'basic_buffer_index_checks':'PASS','size_budget':'PASS','full_Khronos_validation':'NOT RUN','placement':'4-unit grid; pre-oriented variants, do not rotate winding connectors arbitrarily'}
(Path(__file__).parent/'natural_v2_QA.json').write_text(json.dumps(report,indent=2));print(report)
