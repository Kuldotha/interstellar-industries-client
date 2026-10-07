export const cropModels=['fiber','tuber','biomass'];
export function cropGeometry(model,color){
 if(!cropModels.includes(model))throw new Error('Unknown crop model: '+model);
 const positions=[],normals=[],colors=[],indices=[];
 const triangle=(a,b,c,tint)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);for(const p of [a,b,c]){positions.push(...p);normals.push(...n.map(v=>v/length));colors.push(...tint,1);indices.push(indices.length);}};
 const stem=(x,z,height,radius)=>{for(let i=0;i<4;i++){const a=i*Math.PI/2,b=(i+1)*Math.PI/2,p=[x+Math.cos(a)*radius,0,z+Math.sin(a)*radius],q=[x+Math.cos(b)*radius,0,z+Math.sin(b)*radius],r=[q[0],height,q[2]],s=[p[0],height,p[2]],t=color.map(v=>v*.7);triangle(p,q,r,t);triangle(p,r,s,t);}};
 const leaf=(angle,y,length,width,rise)=>{const c=Math.cos(angle),s=Math.sin(angle),p=(r,h,w)=>[c*r-s*w,h,s*r+c*w],base=p(0,y,0),tip=p(length,y+rise,0),ridge=p(length*.5,y+rise*.7+.055,0),left=p(length*.48,y+rise*.45,width),right=p(length*.48,y+rise*.45,-width);for(const [a,b,c] of [[base,left,ridge],[left,tip,ridge],[tip,right,ridge],[right,base,ridge]])triangle(a,b,c,color.map(v=>Math.min(1,v*(.95+y*.15))));};
 if(model==='fiber'){
  for(const [x,z,h] of [[0,0,.88],[-.1,.06,.72],[.09,-.07,.8]]){stem(x,z,h,.016);const top=[x,h+.12,z],bottom=[x,h-.09,z],ring=Array.from({length:5},(_,i)=>[x+Math.cos(i*Math.PI*.4)*.105,h,z+Math.sin(i*Math.PI*.4)*.105]);for(let i=0;i<5;i++){triangle(top,ring[i],ring[(i+1)%5],[.91,.88,.7]);triangle(bottom,ring[(i+1)%5],ring[i],[.8,.78,.6]);}}
  for(let i=0;i<3;i++)leaf(i*2.4,.3+i*.1,.17,.045,.13);
 }else if(model==='tuber'){
  stem(0,0,.35,.025);for(let i=0;i<6;i++)leaf(i*Math.PI/3,.15,.29,.13,.4+(i%2)*.2);
  for(let i=0;i<3;i++)leaf(i*2.1+.3,.3,.17,.09,.7);
 }else{
  stem(0,0,1,.038);for(let i=0;i<6;i++)leaf(i*2.4,.2+i*.11,.29-(i*.015),.095,.17);
  leaf(.3,.84,.12,.055,.16);
 }
 return {positions,normals,colors,indices};
}
