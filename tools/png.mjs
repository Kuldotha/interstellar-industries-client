import {deflateSync,inflateSync} from 'node:zlib';
import {readFileSync,writeFileSync} from 'node:fs';
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(name,data){const type=Buffer.from(name),buffer=Buffer.alloc(data.length+12);buffer.writeUInt32BE(data.length);type.copy(buffer,4);data.copy(buffer,8);let crc=0xffffffff;for(const byte of Buffer.concat([type,data]))crc=crcTable[(crc^byte)&255]^(crc>>>8);buffer.writeUInt32BE((crc^0xffffffff)>>>0,data.length+8);return buffer;}
export function writePng(path,width,height,pixels){
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const raw=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)Buffer.from(pixels.subarray(y*width*4,(y+1)*width*4)).copy(raw,y*(width*4+1)+1);
  writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
export function readPng(path){
  const png=readFileSync(path),width=png.readUInt32BE(16),height=png.readUInt32BE(20),depth=png[24],type=png[25],channels={0:1,2:3,4:2,6:4}[type];
  if(!channels||![8,16].includes(depth)||png[28])throw Error('Unsupported PNG format');
  const chunks=[];for(let p=8;p<png.length;){const size=png.readUInt32BE(p);if(png.toString('ascii',p+4,p+8)==='IDAT')chunks.push(png.subarray(p+8,p+8+size));p+=size+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*channels*depth/8,bpp=channels*depth/8,decoded=new Uint8Array(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=bpp?decoded[i-bpp]:0,b=y?decoded[i-stride]:0,c=y&&x>=bpp?decoded[i-stride-bpp]:0;decoded[i]=(raw[y*(stride+1)+1+x]+[0,a,b,(a+b)>>1,paeth(a,b,c)][filter])&255;}}
  const pixels=new Uint8Array(width*height*4),step=depth/8;for(let i=0;i<width*height;i++){const offset=i*bpp;for(let c=0;c<3;c++)pixels[i*4+c]=decoded[offset+(channels<=2?0:c*step)];pixels[i*4+3]=channels===2||channels===4?decoded[offset+(channels-1)*step]:255;}
  return {width,height,pixels};
}
