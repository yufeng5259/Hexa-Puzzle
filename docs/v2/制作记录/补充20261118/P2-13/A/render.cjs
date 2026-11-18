const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async () => {
 const jobs=JSON.parse(fs.readFileSync(path.join(__dirname,'render_jobs.json'),'utf8'));
 for (const j of jobs) {
  const buffer=await sharp(path.join(__dirname,j.source),{density:288}).ensureAlpha().png().toBuffer();
  await sharp(buffer).resize(j.width,j.height,{kernel:'lanczos3'}).png().toFile(path.resolve(__dirname,j.out));
 }
 console.log('8 native SVG masters rendered');
})().catch(e=>{console.error(e);process.exit(1)});
