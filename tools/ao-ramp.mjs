export const rampStart=.4375,rampWidth=.125;
const clamp=v=>Math.max(0,Math.min(1,v));
export function sampleAO(image,u,v){
  const x=Math.max(0,Math.min(image.width-1,u*image.width-.5)),y=Math.max(0,Math.min(image.height-1,v*image.height-.5)),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const get=(a,b)=>image.pixels[(Math.min(image.height-1,b)*image.width+Math.min(image.width-1,a))*4]/255;
  return (get(ix,iy)*(1-fx)+get(ix+1,iy)*fx)*(1-fy)+(get(ix,iy+1)*(1-fx)+get(ix+1,iy+1)*fx)*fy;
}
export function fitRamp(samples){
  let best=[1,0,0],error=samples.reduce((e,[x,y,value])=>e+(1-value)**2,0);
  for(let i=0;i<samples.length-2;i++)for(let j=i+1;j<samples.length-1;j++)for(let k=j+1;k<samples.length;k++){
    const [x,y,z]=samples[i],[x2,y2,z2]=samples[j],[x3,y3,z3]=samples[k],dx=x2-x,dy=y2-y,ex=x3-x,ey=y3-y,det=dx*ey-ex*dy;
    if(Math.abs(det)<1e-8)continue;
    const b=((z2-z)*ey-(z3-z)*dy)/det,c=(dx*(z3-z)-ex*(z2-z))/det,a=z-b*x-c*y;
    let loss=0;for(const [sx,sy,value] of samples){loss+=(clamp(a+b*sx+c*sy)-value)**2;if(loss>=error)break;}
    if(loss<error){error=loss;best=[a,b,c];}
  }
  return {plane:best,error};
}
export function bakeRampParts(parts,image){
  let squaredError=0,sampleCount=0;
  const result=parts.map(part=>{
    const out={material:part.material,positions:[],normals:[],uvs:[],uvs2:[],indices:[]};
    for(let t=0;t<part.indices.length;t+=3){
      const ids=part.indices.slice(t,t+3),samples=[];
      for(let i=0;i<=5;i++)for(let j=0;j<=5-i;j++){
        const x=i/5,y=j/5,weights=[1-x-y,x,y],uv=[0,0];for(let k=0;k<3;k++)for(let a=0;a<2;a++)uv[a]+=part.uvs2[ids[k]*2+a]*weights[k];
        samples.push([x,y,sampleAO(image,...uv)]);
      }
      const {plane:[a,b,c],error}=fitRamp(samples);squaredError+=error;sampleCount+=samples.length;
      for(let k=0;k<3;k++){const id=ids[k];out.positions.push(...part.positions.slice(id*3,id*3+3));out.normals.push(...part.normals.slice(id*3,id*3+3));out.uvs.push(...part.uvs.slice(id*2,id*2+2));out.uvs2.push(rampStart+rampWidth*(a+(k===1?b:k===2?c:0)),.5);out.indices.push(out.indices.length);}
    }
    return out;
  });
  return {parts:result,rmse:Math.sqrt(squaredError/sampleCount)};
}
