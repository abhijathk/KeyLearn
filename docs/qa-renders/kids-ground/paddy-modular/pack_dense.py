import json,struct,copy
from pathlib import Path
p=Path(__file__).resolve().parents[2]/'models/nature/paddy-modular/KeralaPaddy_Dense_v3.glb'
b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:];root=set(j['scenes'][0]['nodes'])
for i,node in enumerate(j['nodes']):
 if i not in root:node.pop('name',None)
 for k in ('translation','rotation','scale'):
  if k in node:node[k]=[round(x,6) for x in node[k]]
used=set();colors=set()
for m in j['meshes']:
 for pr in m['primitives']:
  mat=j['materials'][pr['material']]
  if 'normalTexture' not in mat and 'baseColorTexture' not in mat.get('pbrMetallicRoughness',{}):pr['attributes'].pop('TEXCOORD_0',None)
  if 'COLOR_0' in pr['attributes']:colors.add(pr['attributes']['COLOR_0'])
  used.update(pr['attributes'].values());used.add(pr['indices'])
buf=bytearray();views=[];access=[];mapping={}
def append(data,target=None):
 while len(buf)%4:buf.append(0)
 v={'buffer':0,'byteOffset':len(buf),'byteLength':len(data)}
 if target:v['target']=target
 views.append(v);buf.extend(data);return len(views)-1
for old in sorted(used):
 a=copy.deepcopy(j['accessors'][old]);v=j['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];size={5126:4,5123:2,5125:4}[a['componentType']]*dim;stride=v.get('byteStride',size)
 data=b''.join(binary[start+i*stride:start+i*stride+size] for i in range(a['count']))
 if old in colors:
  floats=struct.unpack('<'+'f'*(len(data)//4),data);data=bytes(max(0,min(255,round(x*255))) for x in floats);a['componentType']=5121;a['normalized']=True
 a.pop('byteOffset',None);a['bufferView']=append(data,v.get('target'));mapping[old]=len(access);access.append(a)
for m in j['meshes']:
 for pr in m['primitives']:
  pr['attributes']={k:mapping[v] for k,v in pr['attributes'].items()};pr['indices']=mapping[pr['indices']]
for im in j.get('images',[]):
 v=j['bufferViews'][im['bufferView']];o=v.get('byteOffset',0);im['bufferView']=append(binary[o:o+v['byteLength']])
j['accessors']=access;j['bufferViews']=views;j['buffers']=[{'byteLength':len(buf)}]
while len(buf)%4:buf.append(0)
js=json.dumps(j,separators=(',',':')).encode();js+=b' '*(-len(js)%4)
p.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(js)+len(buf))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(buf),0x004e4942)+buf)
print('bytes',p.stat().st_size)
assert p.stat().st_size<=150000
