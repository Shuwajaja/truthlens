import {requireLocal} from './local-json.ts'
const MAX_PIXELS=16_000_000,MAX_EDGE=8192
// Inspect raster headers only. No image, SVG, HTML or PDF decoder is invoked.
export function checkLocalImage(bytes:Uint8Array){
 const b=bytes,view=new DataView(b.buffer,b.byteOffset,b.byteLength)
 const ascii=(start:number,length:number)=>String.fromCharCode(...b.subarray(start,start+length))
 const size=(w:number,h:number)=>requireLocal(w>0&&h>0&&w<=MAX_EDGE&&h<=MAX_EDGE&&w*h<=MAX_PIXELS,'Image pixel dimensions exceed the local limit')
 if(b[0]===137&&ascii(1,3)==='PNG'){
  requireLocal(b.length>=33&&ascii(12,4)==='IHDR'&&view.getUint32(8)===13,'Invalid PNG image header');size(view.getUint32(16),view.getUint32(20));return
 }
 if(ascii(0,3)==='GIF'){requireLocal(b.length>=10,'Invalid GIF image header');size(view.getUint16(6,true),view.getUint16(8,true));return}
 if(b[0]===255&&b[1]===216){
  let at=2
  while(at+4<=b.length){requireLocal(b[at]===255,'Invalid JPEG image header');while(b[at]===255)at++;const marker=b[at++];if(marker===0xda||marker===0xd9)break
   requireLocal(at+2<=b.length,'Truncated JPEG image');const length=view.getUint16(at);requireLocal(length>=2&&at+length<=b.length,'Invalid JPEG image segment')
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){requireLocal(length>=8,'Invalid JPEG image dimensions');size(view.getUint16(at+5),view.getUint16(at+3));return}at+=length
  }throw Error('JPEG image dimensions unavailable')
 }
 if(ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){
  // Extended/animated WebP and unknown raster formats remain fail-closed.
  requireLocal(b.length>=30,'Invalid WebP image header');const kind=ascii(12,4)
  if(kind==='VP8X'){size(1+b[24]+b[25]*256+b[26]*65536,1+b[27]+b[28]*256+b[29]*65536);return}
  if(kind==='VP8 '){requireLocal(b[23]===157&&b[24]===1&&b[25]===42,'Invalid WebP image frame');size(view.getUint16(26,true)&16383,view.getUint16(28,true)&16383);return}
  if(kind==='VP8L'){requireLocal(b[20]===47,'Invalid WebP image frame');const bits=view.getUint32(21,true);size((bits&16383)+1,((bits>>>14)&16383)+1);return}
  throw Error('Unsupported WebP image dimensions')
 }
 // Other formats cannot reach an inline image renderer; downloads are inert.
}
