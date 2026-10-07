export function assertRequestOrigin(req){
 const configured=process.env.PUBLIC_ORIGIN;
 if(process.env.NODE_ENV==='production'&&!configured)throw Error('PUBLIC_ORIGIN must be configured');
 const origin=configured?new URL(configured).origin:'http://'+req.headers.host;
 const url=new URL(origin);
 if(!configured&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Host not allowed');
 if(req.headers.host!==url.host)throw Error('Host not allowed');
 if(req.method==='POST'&&req.headers.origin!==origin)throw Error('Origin not allowed');
}
