/* Block hex runtime reference. Shared textures + axial cells, no level PNGs.
 * Canvas2D sampling differs from the exact Python/OpenCV editor reference.
 * Browser global: BlockHex. No engine, bundler, network or project dependency.
 */
(function (global) {
  'use strict';
  const SQRT3 = Math.sqrt(3), VERSION = 'block.hex.v1';
  function canvas(w, h) {
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.ceil(w)); out.height = Math.max(1, Math.ceil(h));
    return out;
  }
  const ctx = c => c.getContext('2d', {willReadFrequently: true});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function pixel(q, r, flip) { return [1.5*q, SQRT3*(r+q/2)*(flip ? -1 : 1)]; }
  function layout(cells, box, padding = 24, flip = true) {
    if (!cells.length) throw new Error('Empty hex shape');
    const points = cells.map(c => pixel(c[0], c[1], flip));
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const left = Math.min(...xs)-1, top = Math.min(...ys)-SQRT3/2;
    const width = Math.max(...xs)+1-left, height = Math.max(...ys)+SQRT3/2-top;
    const radius = Math.min((box[2]-padding*2)/width, (box[3]-padding*2)/height);
    if (!(radius > 0)) throw new Error('Hex bounds are smaller than padding');
    const ox = box[0]+(box[2]-width*radius)/2-left*radius;
    const oy = box[1]+(box[3]-height*radius)/2-top*radius;
    return {radius, offset:[ox,oy], centers:cells.map((c,i) => ({cell:c.slice(),center:[ox+points[i][0]*radius,oy+points[i][1]*radius]}))};
  }
  function polygon(context, x, y, radius) {
    context.beginPath();
    for (let i=0;i<6;i++) {
      const px=x+radius*Math.cos(Math.PI*i/3), py=y+radius*Math.sin(Math.PI*i/3);
      if (i) context.lineTo(px,py); else context.moveTo(px,py);
    }
    context.closePath();
  }
  function boundaryEdges(cells) {
    const corners=[[2,0],[1,1],[-1,1],[-2,0],[-1,-1],[1,-1]], edges=new Map();
    for (const [q,r] of cells) {
      const vertices=corners.map(([x,y])=>[3*q+x,2*r+q+y]);
      for(let i=0;i<6;i++) {
        const a=vertices[i],b=vertices[(i+1)%6],key=[a.join(','),b.join(',')].sort().join('|');
        if(edges.has(key)) edges.delete(key); else edges.set(key,[a,b]);
      }
    }
    return [...edges.values()]; // Both exterior and interior-hole edges.
  }
  function distance(mask,w,h,inside) {
    const d=new Float32Array(w*h), inf=1e6;
    for(let i=0;i<d.length;i++) d[i]=(Boolean(mask[i])===inside)?inf:0;
    const forward=[[-1,0,1],[0,-1,1],[-1,-1,1.4],[1,-1,1.4],[-2,-1,2.1969],[2,-1,2.1969],[-1,-2,2.1969],[1,-2,2.1969]];
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const i=y*w+x;if(!d[i])continue;
      for(const [dx,dy,cost]of forward) {
        const xx=x+dx,yy=y+dy;
        if(xx>=0&&xx<w&&yy>=0&&yy<h)d[i]=Math.min(d[i],d[yy*w+xx]+cost);
      }
    }
    for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--) {
      const i=y*w+x;if(!d[i])continue;
      for(const [dx,dy,cost]of forward) {
        const xx=x-dx,yy=y-dy;
        if(xx>=0&&xx<w&&yy>=0&&yy<h)d[i]=Math.min(d[i],d[yy*w+xx]+cost);
      }
    }
    return d;
  }
  function mirrorTexture(image,w,h,regrade) {
    const source=canvas(image.width,image.height),sc=ctx(source);sc.drawImage(image,0,0);
    if(regrade) {
      const data=sc.getImageData(0,0,source.width,source.height),v=data.data;
      for(let i=0;i<v.length;i+=4) {v[i]=Math.floor(clamp(v[i]*.7+106,0,255));v[i+1]=Math.floor(clamp(v[i+1]*.78+65,0,255));v[i+2]=Math.floor(clamp(v[i+2]*.65+23,0,255));}
      sc.putImageData(data,0,0);
    }
    const tile=canvas(source.width*2,source.height*2),tc=ctx(tile);
    tc.drawImage(source,0,0);tc.save();tc.translate(tile.width,0);tc.scale(-1,1);tc.drawImage(source,0,0);tc.restore();
    tc.save();tc.translate(0,tile.height);tc.scale(1,-1);tc.drawImage(tile,0,0,tile.width,source.height,0,0,tile.width,source.height);tc.restore();
    const out=canvas(w,h),oc=ctx(out);oc.fillStyle=oc.createPattern(tile,'repeat');oc.fillRect(0,0,w,h);return out;
  }
  function roundEven(value) { const n=Math.floor(value),f=value-n;return f===.5?(n%2?n+1:n):Math.round(value); }
  function reduce(source,w,h) {const out=canvas(w,h),c=ctx(out);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(source,0,0,w,h);return out;}
  function generateBoard(spec,materials) {
    const box=spec.bbox,ss=spec.supersample||2,w=Math.ceil(box[2]),h=Math.ceil(box[3]),W=w*ss,H=h*ss;
    const fitted=layout(spec.cells,box,spec.padding===undefined?24:spec.padding,spec.flip_y!==false);
    const silhouette=canvas(W,H),sc=ctx(silhouette);sc.fillStyle='#fff';
    for(const item of fitted.centers) {polygon(sc,(item.center[0]-box[0])*ss,(item.center[1]-box[1])*ss,fitted.radius*ss);sc.fill();}
    const rgba=sc.getImageData(0,0,W,H).data,mask=new Uint8Array(W*H);
    for(let i=0;i<mask.length;i++)mask[i]=rgba[i*4+3]>=128?1:0;
    const inside=distance(mask,W,H,true),outside=distance(mask,W,H,false),d=new Float32Array(W*H);
    const scale=ss*Math.min(1,Math.max(.25,fitted.radius/60));
    for(let i=0;i<d.length;i++)d[i]=(inside[i]-outside[i])/scale;
    const floor=canvas(W,H),rim=canvas(W,H),shadowMask=canvas(W,H);
    const fc=ctx(floor),rc=ctx(rim),mc=ctx(shadowMask);
    const floorData=fc.createImageData(W,H),rimData=rc.createImageData(W,H),shadowData=mc.createImageData(W,H);
    const floorSource=materials.hex_wood_floor||canvas(1,1),railSource=materials.hex_rail_profile||canvas(1,26);
    const floorSmall=mirrorTexture(floorSource,w,h,false),floorBig=reduce(floorSmall,W,H),floorPixels=ctx(floorBig).getImageData(0,0,W,H).data;
    const rimSmall=mirrorTexture(floorSource,w,h,true),rimBig=reduce(rimSmall,W,H),grain=ctx(rimBig).getImageData(0,0,W,H).data;
    const mean=[0,0,0];for(let i=0;i<grain.length;i+=4)for(let c=0;c<3;c++)mean[c]+=grain[i+c]/(W*H);
    const rail=canvas(railSource.width,railSource.height),rctx=ctx(rail);rctx.drawImage(railSource,0,0);const pixels=rctx.getImageData(0,0,rail.width,rail.height).data;
    const profile=Array.from({length:rail.height},()=>[0,0,0]);
    for(let y=0;y<rail.height;y++)for(let x=0;x<rail.width;x++)for(let c=0;c<3;c++)profile[y][c]+=pixels[(y*rail.width+x)*4+c]/rail.width;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
      const i=y*W+x,j=i*4,dist=d[i];
      const gx=x===0?d[i+1]-dist:x===W-1?dist-d[i-1]:(d[i+1]-d[i-1])/2;
      const gy=y===0?d[i+W]-dist:y===H-1?dist-d[i-W]:(d[i+W]-d[i-W])/2;
      const sample=profile[clamp(roundEven(dist+18),0,profile.length-1)],light=clamp(1-.03*gx+.06*gy,.88,1.12);
      for(let c=0;c<3;c++) {
        floorData.data[j+c]=floorPixels[j+c];
        rimData.data[j+c]=Math.floor(clamp(sample[c]*clamp(grain[j+c]/Math.max(mean[c],1),.94,1.06)*light,0,255));
        shadowData.data[j+c]=[53,29,12][c];
      }
      floorData.data[j+3]=dist>=3?255:0;rimData.data[j+3]=dist>=-18&&dist<7?255:0;shadowData.data[j+3]=dist>=-18?90:0;
    }
    fc.putImageData(floorData,0,0);rc.putImageData(rimData,0,0);mc.putImageData(shadowData,0,0);
    // Editor reference applies LANCZOS then a 1px Gaussian; Canvas approximates
    // this via high-quality resize + filter. It is not an exact PSD renderer.
    const shadow=canvas(w,h),shadowCtx=ctx(shadow);shadowCtx.filter='blur(1px)';shadowCtx.drawImage(reduce(shadowMask,w,h),0,5);
    return {floor:reduce(floor,w,h),rim:reduce(rim,w,h),shadow,layout:fitted};
  }
  function outline(spec) {
    const box=spec.bbox,n=3,out=canvas(box[2]*n,box[3]*n),c=ctx(out),f=spec.layout||layout(spec.cells,box,spec.padding===undefined?24:spec.padding,spec.flip_y!==false);
    const centers=new Map(f.centers.map(a=>[a.cell.join(','),a.center])),width=spec.width||5;
    c.lineJoin='round';
    for(const cell of spec.outline_cells||spec.cells) {
      const center=centers.get(cell.join(','));if(!center)throw new Error('Outline cell not in board');
      for(const [extra,color]of [[6,'rgba(107,52,12,.96)'],[3,'#f29f1d'],[0,`rgba(${(spec.color||[255,228,105,255]).slice(0,3).join(',')},${(spec.color||[255,228,105,255])[3]/255})`]]) {
        polygon(c,(center[0]-box[0])*n,(center[1]-box[1])*n,f.radius*.95*n);c.lineWidth=(width+extra)*n;c.strokeStyle=color;c.stroke();
      }
      c.beginPath();for(const [i,k]of [3,4,5,0].entries()) {const x=(center[0]-box[0]+f.radius*.95*Math.cos(Math.PI*k/3))*n,y=(center[1]-box[1]+f.radius*.95*Math.sin(Math.PI*k/3))*n;if(i)c.lineTo(x,y);else c.moveTo(x,y);}
      c.strokeStyle='#fffac4';c.lineWidth=Math.max(2,Math.floor(width/2))*n;c.stroke();
    }
    return reduce(out,box[2],box[3]);
  }
  function render(spec,materials) {
    if(spec.renderer!==VERSION)throw new Error('Unsupported hex renderer');
    if(['floor','rim','shadow'].includes(spec.role))return generateBoard(spec,materials)[spec.role];
    if(spec.role==='outline')return outline(spec);
    if(spec.role==='selection') {
      const [w,h]=spec.size,n=3,out=canvas(w*n,h*n),c=ctx(out);c.strokeStyle='#ffe27d';c.lineWidth=4*n;
      c.beginPath();c.roundRect(4*n,4*n,(w-8)*n,(h-8)*n,17*n);c.stroke();return reduce(out,w,h);
    }
    if(spec.role==='well'||spec.role==='obstacle') {
      const source=materials.hex_empty_well;if(!source)throw new Error('Missing hex_empty_well material');
      const mother=canvas(source.width,source.height),c=ctx(mother);c.drawImage(source,0,0);
      if(spec.role==='obstacle') {const im=c.getImageData(0,0,mother.width,mother.height),d=im.data;for(let i=0;i<d.length;i+=4){const y=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);for(let k=0;k<3;k++)d[i+k]=Math.floor(y*.85+d[i+k]*.15);}c.putImageData(im,0,0);}
      return reduce(mother,spec.size[0],spec.size[1]);
    }
    throw new Error('Unknown hex role '+spec.role);
  }
  async function loadMaterials(entries,baseURL=document.baseURI) {
    const result={};await Promise.all(Object.entries(entries).map(async([key,value])=>{
      const file=typeof value==='string'?value:(value.file||value.source_file);
      const im=new Image();im.src=new URL(file,baseURL).href;await im.decode();result[key]=im;
    }));return result;
  }
  function createRenderer(materials,{maxEntries=12,materialVersion='1'}={}) {
    const cache=new Map();
    return {render(spec) {
      const structure=['floor','rim','shadow'].includes(spec.role);
      const data=structure?{cells:spec.cells,bbox:spec.bbox,padding:spec.padding,
        supersample:spec.supersample,flip_y:spec.flip_y}:spec;
      const key=JSON.stringify([materialVersion,structure?'board':'component',data]);
      if(cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return structure?hit[spec.role]:hit;}
      const image=structure?generateBoard(spec,materials):render(spec,materials);cache.set(key,image);
      while(cache.size>maxEntries)cache.delete(cache.keys().next().value);
      return structure?image[spec.role]:image;
    },clear(){cache.clear();},get cacheSize(){return cache.size;}};
  }
  global.BlockHex={VERSION,layout,boundaryEdges,render,loadMaterials,createRenderer};
})(typeof window!=='undefined'?window:globalThis);
