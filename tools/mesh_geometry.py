def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def triangulate(poly,positions):
 if len(poly)==3:return [poly]
 normal=[0,0,0]
 for i in range(len(poly)):
  a=positions[poly[i]];b=positions[poly[(i+1)%len(poly)]]
  for j in range(3):normal[j]+=(a[(j+1)%3]-b[(j+1)%3])*(a[(j+2)%3]+b[(j+2)%3])
 drop=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=drop]
 pts={i:[positions[i][a] for a in axes] for i in poly}
 def orient(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 area=sum(pts[poly[i]][0]*pts[poly[(i+1)%len(poly)]][1]-pts[poly[(i+1)%len(poly)]][0]*pts[poly[i]][1] for i in range(len(poly)));sgn=1 if area>0 else -1
 remaining=poly[:];out=[]
 while len(remaining)>3:
  for j in range(len(remaining)):
   a,b,c=remaining[j-1],remaining[j],remaining[(j+1)%len(remaining)]
   if orient(pts[a],pts[b],pts[c])*sgn<=1e-12:continue
   if any(all(orient(pts[x],pts[y],pts[t])*sgn>=-1e-12 for x,y in [(a,b),(b,c),(c,a)]) for t in remaining if t not in (a,b,c)):continue
   out.append([a,b,c]);remaining.pop(j);break
  else:raise ValueError(('cannot triangulate',poly))
 out.append(remaining);return out
