from pathlib import Path
import random,math,json
root=Path(__file__).resolve().parents[1];rng=random.Random(1701);points=[]
for i in range(64):
 candidates=[]
 for j in range(256):
  a=rng.random();b=rng.random()
  if a+b>1:a=1-a;b=1-b
  a=.14+a*.58;b=.14+b*.58
  x=-a-.5*b;y=-math.sqrt(3)/2*b
  score=min(((x-p[2])**2+(y-p[3])**2 for p in points[-7:]),default=1)
  candidates.append((score,a,b,x,y))
 _,a,b,x,y=max(candidates);points.append((a,b,x,y))
(root/'assets/section-spawn-points.json').write_text(json.dumps({'maxBand':8,'points':[[p[0],p[1]] for p in points],'rule':'Best candidate against previous seven points. Non-wrapping bands; final world-space minimum distance rejection.'},indent=2))
(root/'core/src/spawn_points.rs').write_text('pub const SPAWN_POINTS: [[f32;2];64] = '+str([[p[0],p[1]] for p in points])+';\n')
