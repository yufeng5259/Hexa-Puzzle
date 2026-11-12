const fs=require('fs');
const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='F:/qiguobing/git/Hexa Puzzle/Project/docs/v2';
const record=path.join(root,'制作记录/扩展美术20261112');
(async()=>{
 let browser;
 try{browser=await chromium.launch({headless:true});}
 catch(first){browser=await chromium.launch({headless:true,channel:'msedge'});}
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 await page.waitForSelector('.card');
 const count=await page.locator('.card').count();
 if(count!==55)throw Error('Expected55 design cards, got'+count);
 const broken=await page.evaluate(async()=>{
   const all=[...document.querySelectorAll('.imagebox img')];
   for(const im of all)im.loading='eager';
   return (await Promise.all(all.map(async im=>{try{await im.decode();return im.naturalWidth?null:im.getAttribute('src');}catch(e){return im.getAttribute('src');}}))).filter(Boolean);
 });
 if(broken.length)throw Error('Broken images:'+broken.join(','));
 const filters={};
 for(const [cat,want] of [['页面',25],['六角块图集',12],['地图背景',3],['建筑升级图集',15]]){
  await page.locator(`[data-category="${cat}"]`).click();
  const actual=await page.locator('.card').count();filters[cat]=actual;if(actual!==want)throw Error('Filter count:'+cat);
 }
 await page.locator('#search').fill('B01');
 if(await page.locator('.card').count()!==1)throw Error('B01 search did not match exactly1');
 await page.locator('.imagebox').first().click();
 if(!await page.locator('#lightbox').evaluate(el=>el.open))throw Error('Lightbox did not open');
 await page.locator('#large').evaluate(el=>el.decode());
 await page.locator('#zoom').click();
 if(!await page.locator('#large').evaluate(el=>el.classList.contains('actual')))throw Error('Native-size zoom failed');
 await page.locator('#close').click();
 await page.locator('#back').selectOption('white');
 if(!await page.locator('body').evaluate(el=>el.classList.contains('whitecards')))throw Error('White background failed');
 await page.locator('#back').selectOption('dark');
 await page.locator('#search').fill('');
 await page.locator('[data-category="页面"]').click();
 await page.screenshot({path:path.join(record,'图册_桌面浏览.png')});
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 if(overflow)throw Error('Mobile horizontal overflow');
 await page.screenshot({path:path.join(record,'图册_手机浏览.png')});
 if(errors.length)throw Error('Page errors:'+errors.join(','));
 const result={status:'PASS',date:'2026-11-12',designCards:count,imagesDecoded:55,brokenImages:broken,filters,search:'PASS',modal:'PASS',nativeSize:'PASS',backgroundSwitch:'PASS',mobileHorizontalOverflow:overflow,pageErrors:errors,method:'Actual headless browser loaded the portable file gallery and all55 final image links'};
 fs.writeFileSync(path.join(record,'图册浏览验证.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 await browser.close();
})().catch(e=>{console.error(e.message);process.exitCode=1;});
