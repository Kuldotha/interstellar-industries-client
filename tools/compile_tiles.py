import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
meshes=json.loads((root/'assets/tiles-raw.json').read_text())
from mesh_geometry import triangulate
order=['section-0']+['edge-'+str(i) for i in range(4)]+['corner-0-0']+[f'corner-{i}-{j}' for i in range(1,4) for j in range(4)]
rs=['pub struct AuthoredMesh { pub vertices: &\'static [[f32;3]], pub triangles: &\'static [[usize;3]], pub masks: &\'static [u8], pub normals: &\'static [[f32;3]], pub weights: &\'static [[[f32;3];3]] }','pub static AUTHORED: &[AuthoredMesh] = &['];manifest=[]
for name in order:
 m=meshes[name];vs=[[-p[0],p[1],p[2]] for p in m['positions']];ts=[];masks=[];normals=[];weights=[];offset=0
 for face in m['faces']:
  colors=m['loopColors'][offset:offset+len(face)];offset+=len(face)
  means=[sum(c[i] for c in colors)/len(colors) for i in range(3)]
  mask=3 if max(means)<100 else max(range(3),key=lambda i:means[i])
  normal=[0.,0.,0.]
  for j in range(len(face)):
   a=vs[face[j]];b=vs[face[(j+1)%len(face)]]
   for k in range(3):normal[k]-=(a[(k+1)%3]-b[(k+1)%3])*(a[(k+2)%3]+b[(k+2)%3])
  length=math.sqrt(sum(x*x for x in normal));assert length>1e-12
  normal=[x/length for x in normal]
  for tri in triangulate(face,vs):
   ordered=tri[::-1];ts.append(ordered);masks.append(mask);normals.append(normal)
   scale=255.0 if m['colorType']==17 else 1.0
   weights.append([[colors[face.index(vertex)][k]/scale for k in range(3)] for vertex in ordered])
 rs.append('AuthoredMesh { vertices: &'+str(vs).replace('e-','e-')+', triangles: &'+str(ts)+', masks: &'+str(masks)+', normals: &'+str(normals)+', weights: &'+str(weights)+' },')
 manifest.append({'name':name,'vertices':len(vs),'triangles':len(ts),'heightRange':[min(p[1] for p in vs),max(p[1] for p in vs)]})
rs.append('];')
(root/'core/src/authored.rs').write_text('\n'.join(rs))
(root/'public/tileset-manifest.json').write_text(json.dumps(manifest,indent=2))
print(manifest)
