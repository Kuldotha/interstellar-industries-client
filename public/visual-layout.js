export async function loadVisualLayout(resolution){
 const response=await fetch(`layouts/equal-area-${resolution}.bin`);
 if(!response.ok)throw Error('Equal-area layout unavailable');
 const bytes=await response.arrayBuffer(),count=10*resolution*resolution+2;
 if(bytes.byteLength!==count*21*4)throw Error('Invalid visual layout size');
 const view=new DataView(bytes),values=Float32Array.from({length:count*21},(_,i)=>view.getFloat32(i*4,true));
 if(!values.every(Number.isFinite))throw Error('Invalid visual layout coordinates');
 return core=>{const ptr=core.visual_layout_buffer(count);new Float32Array(core.memory.buffer,ptr,values.length).set(values);};
}
