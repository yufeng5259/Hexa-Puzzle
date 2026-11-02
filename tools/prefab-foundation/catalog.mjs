import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';

// Editor/build-time inventory only. Never ship the prototype JS in the game.
export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = file => readFileSync(resolve(repositoryRoot, file), 'utf8');
const artContext = { window: {} };
vm.runInNewContext(read('prototype/block-data.js'), artContext, { timeout: 5000 });
export const sourceArt = artContext.window.BlockArt;
export const sourceConfigs = sourceArt.configs;
const source = prefix => {
  const exact = Object.keys(sourceConfigs).find(key => key === prefix || key.startsWith(prefix + '_'));
  if (!exact) throw new Error(`Unknown source page: ${prefix}`);
  return exact;
};
const routeContext = { window: {} };
const app = read('prototype/app.js');
const mainRoutes = vm.runInNewContext(app.slice(app.indexOf('const mainPages='), app.indexOf('let adButtonTimer')) + '\nmainPages;', routeContext);
const meta = read('prototype/meta.js');
const metaRoutes = vm.runInNewContext(meta.slice(meta.indexOf('const pages ='), meta.indexOf('const names=')) + '\npages;', {});

// id, class/prefab name, module, category, source prefixes, prototype routes.
const definitions = [
  ['loading','LoadingPage','boot','page',['主图'],['loading']],
  ['mainline-map','MainlineMapPage','mainline','page',['微信图片_20261019173444_81_187'],['levels']],
  ['garden','GardenPage','garden','page',['T15-01','T15-02','T15-03','T15-04','T15-05'],['home','home-max','build-upgrade','build-short','home-finished']],
  ['puzzle','PuzzlePage','puzzle','page',['T02-01','T02-02','T03-01','T05-01','T05-02'],['puzzle','puzzle-six','puzzle-hint','challenge','challenge-seven']],
  ['endless-intro','EndlessIntroPage','endless','page',['T11-01'],['endless-intro']],
  ['endless','EndlessPage','endless','page',['T13-01'],['endless']],
  ['world-map','WorldMapPage','garden','page',['T27-01'],['world-map']],
  ['companion-list','CompanionListPage','collection','page',['T20-01'],['bee-home']],
  ['companion-detail','CompanionDetailPage','collection','page',['T21-01'],['bee-detail']],
  ['wardrobe','WardrobePage','collection','page',['T23-01'],['wardrobe']],
  ['album','AlbumPage','collection','page',['T24-01'],['album']],
  ['daily-tasks','DailyTasksPage','daily','page',['T29-01'],['tasks']],
  ['weekly-tasks','WeeklyTasksPage','daily','page',['T30-01'],['weekly-tasks']],
  ['achievements','AchievementsPage','daily','page',['T31-01'],['achievements']],
  ['signin','SigninPage','daily','page',['T32-01'],['signin']],
  ['events','EventsPage','daily','page',['T33-01'],['events']],
  ['event-detail','EventDetailPage','daily','page',['T34-01'],['event-detail']],
  ['mailbox','MailboxPage','services','page',['T48-01'],['mailbox']],
  ['featured','FeaturedView','mainline','dialog',['T10-01'],['featured']],
  ['puzzle-preview','PuzzlePreviewView','puzzle','dialog',['T01-01','T04-01'],['level-preview','challenge-preview']],
  ['puzzle-resume','PuzzleResumeView','mainline','dialog',['T09-01'],['resume-puzzle']],
  ['puzzle-result','PuzzleResultView','puzzle','dialog',['T06-01'],['puzzle-win']],
  ['challenge-result','ChallengeResultView','puzzle','dialog',['T07-01'],['challenge-win']],
  ['challenge-fail','ChallengeFailView','puzzle','dialog',['T08-01'],['challenge-fail']],
  ['endless-revive','EndlessReviveView','endless','dialog',['T12-01'],['endless-revive']],
  ['endless-result','EndlessResultView','endless','dialog',['T14-01'],['endless-result']],
  ['chapter-reward','ChapterRewardView','garden','dialog',['T16-01'],['chapter-complete']],
  ['chapter-next','ChapterNextView','garden','dialog',['T17-01','T17-02'],['chapter-next']],
  ['journey-complete','JourneyCompleteView','garden','dialog',['T18-01'],['journey-complete']],
  ['story','StoryView','collection','dialog',['T19-01'],['story','bee-story']],
  ['companion-decor','CompanionDecorView','collection','dialog',['T22-01'],['bee-decor']],
  ['photo-detail','PhotoDetailView','collection','dialog',['T25-01'],['album-detail']],
  ['album-reward','AlbumRewardView','collection','dialog',['T26-01','T26-02','T26-03'],['album-reward','album-water-reward','album-cloud-reward']],
  ['weekly-stamp','WeeklyStampView','daily','dialog',['T28-01'],['weekly-stamp']],
  ['event-reward','EventRewardView','daily','dialog',['T35-01'],['event-reward']],
  ['pause','PauseView','services','dialog',['T36-01'],['pause']],
  ['confirmation','ConfirmationView','services','dialog',['T37-01','T38-01','T13-01'],['exit-confirm','restart-confirm','endless-confirm']],
  ['settings','SettingsView','services','dialog',['T39-01'],['settings']],
  ['help-index','HelpIndexView','services','dialog',['T40-01'],['help']],
  ['help-detail','HelpDetailView','services','dialog',['T40-02','T40-03','T40-04'],['puzzle-help','endless-help','build-help']],
  ['hint-empty','HintEmptyView','services','dialog',['T41-01'],['hint-empty']],
  ['ad-status','AdStatusView','services','dialog',['T42-01','T43-01','T44-01','T45-01'],['ad-loading','ad-unavailable','ad-pending','ad-cooldown']],
  ['local-save','LocalSaveView','services','dialog',['T46-01'],['local-save']],
  ['daily-supply','DailySupplyView','services','dialog',['T47-01'],['supply']],
  ['mail-detail','MailDetailView','services','dialog',['T49-01'],['mail-detail']],
  ['privacy','PrivacyView','services','dialog',['T50-01'],['privacy']],
  ['guide-overlay','GuideOverlay','common','guide',['T51-01','T51-02','T51-03','T51-04','T51-05','T51-06','T51-07','T51-08'],['guide-garden-entry','guide-home','guide-menu','guide-puzzle','guide-return','guide-upgrade','guide-complete','guide-endless']],
  ['level-node','LevelNodeItem','mainline','item',['微信图片_20261019173444_81_187'],[]],
  ['featured-item','FeaturedItem','mainline','item',['T10-01'],[]],
  ['building','BuildingItem','garden','item',['T15-01'],[]],
  ['building-price','BuildingPriceItem','garden','item',['T15-01'],[]],
  ['scene-companion','SceneCompanionItem','garden','item',['T15-01'],[]],
  ['companion-card','CompanionCardItem','collection','item',['T20-01'],[]],
  ['affinity-node','AffinityNodeItem','collection','item',['T21-01'],[]],
  ['outfit-item','OutfitItem','collection','item',['T23-01'],[]],
  ['photo-item','PhotoItem','collection','item',['T24-01'],[]],
  ['theme-card','ThemeCardItem','garden','item',['T27-01'],[]],
  ['task-item','TaskItem','daily','item',['T29-01'],[]],
  ['achievement-item','AchievementItem','daily','item',['T31-01'],[]],
  ['signin-cell','SigninCellItem','daily','item',['T32-01'],[]],
  ['event-card','EventCardItem','daily','item',['T33-01'],[]],
  ['milestone-item','MilestoneItem','daily','item',['T34-01'],[]],
  ['mail-item','MailItem','services','item',['T48-01'],[]],
  ['tray-slot','TraySlotItem','puzzle','item',['T02-01'],[]],
  ['puzzle-piece','PuzzlePieceItem','puzzle','item',['T02-01'],[]],
  ['hex-cell','HexCellItem','puzzle','item',['T02-01'],[]],
  ['puzzle-tutorial','PuzzleTutorialItem','services','item',['T40-02'],[]],
  ['endless-tutorial','EndlessTutorialItem','services','item',['T40-03'],[]],
  ['garden-tutorial','GardenTutorialItem','services','item',['T40-04'],[]],
  ['reward-item','RewardItem','common','item',['T06-01'],[]],
  ['button','CommonButton','common','common',['T01-01'],[]],
  ['icon-button','IconButton','common','common',['T02-01'],[]],
  ['resource-hud','ResourceHUD','common','common',['T15-01'],[]],
  ['resource-counter','ResourceCounter','common','common',['T15-01'],[]],
  ['title-bar','TitleBar','common','common',['T39-01'],[]],
  ['dialog-frame','DialogFrame','common','common',['T36-01'],[]],
  ['progress','ProgressDisplay','common','common',['主图'],[]],
  ['setting-toggle','SettingToggle','common','common',['T39-01'],[]],
  ['virtual-list','VirtualList','common','common',[],[]],
  ['toast','ToastView','common','common',[],[]],
  ['gm-panel','GMPanel','debug','debug',[],[]],
  ['gm-command','GMCommandItem','debug','debug',[],[]],
];

const binding = (name,type,role='binding') => ({name,type,role});
const defaultBindings = category => category === 'item' ? [binding('icon','Sprite','dynamic-image'),binding('titleLabel','Label','dynamic-text'),binding('button','Button','event')]
  : ['page','dialog'].includes(category) ? [binding('titleLabel','Label','dynamic-text'),binding('backButton','Button','event')]
  : [];
const specifics = {
  loading:[['progressBar','ProgressBar'],['progressLabel','Label','dynamic-text']],
  'mainline-map':[['presentation','MainlineMapPresentation']],
  garden:[['buildingsRoot','Node'],['buildingPrefab','Prefab'],['effectRoot','Node'],['gardenProgress','ProgressBar'],['gardenProgressLabel','Label','dynamic-text']],
  puzzle:[['boardRoot','Node'],['trayRoot','Node'],['hintRoot','Node'],['piecePrefab','Prefab'],['cellPrefab','Prefab'],['slotPrefab','Prefab'],['remainingLabel','Label','dynamic-text'],['hintButton','Button','event'],['undoButton','Button','event']],
  endless:[['boardRoot','Node'],['trayRoot','Node'],['effectRoot','Node'],['scoreLabel','Label','dynamic-text'],['cellPrefab','Prefab'],['piecePrefab','Prefab'],['harvestButton','Button','event']],
  'puzzle-preview':[['boardRoot','Node'],['trayRoot','Node'],['startButton','Button','event'],['rewardLabel','Label','dynamic-text']],
  building:[['body','Sprite','dynamic-image'],['rotorRoot','Node'],['rotor','Sprite','dynamic-image'],['priceRoot','Node'],['progressBar','ProgressBar']],
  'building-price':[['priceLabel','Label','dynamic-text'],['currencyIcon','Sprite'],['upgradeButton','Button','event']],
  'guide-overlay':[['maskRoot','Node'],['highlightRoot','Node'],['hand','Sprite'],['ghostRoot','Node'],['bubbleLabel','Label','dynamic-text'],['skipButton','Button','event']],
  'virtual-list':[['scrollView','ScrollView'],['viewport','Mask'],['content','Node'],['itemPrefab','Prefab']],
  'setting-toggle':[['button','Button','event'],['onRoot','Node'],['offRoot','Node'],['label','Label','dynamic-text']],
  button:[['button','Button','event'],['background','Sprite'],['label','Label','dynamic-text']],
  'icon-button':[['button','Button','event'],['icon','Sprite','dynamic-image']],
  'resource-counter':[['icon','Sprite','dynamic-image'],['valueLabel','Label','dynamic-text'],['addButton','Button','event']],
  'resource-hud':[['honeyLabel','Label','dynamic-text'],['hintLabel','Label','dynamic-text'],['avatar','Sprite','dynamic-image'],['settingsButton','Button','event']],
  progress:[['progressBar','ProgressBar'],['valueLabel','Label','dynamic-text']],
  toast:[['messageLabel','Label','dynamic-text']],
  'gm-panel':[['scrollView','ScrollView'],['viewport','Mask'],['content','Node'],['commandPrefab','Prefab'],['closeButton','Button','event']],
  'gm-command':[['button','Button','event'],['label','Label','dynamic-text']],
};
const listItems = {'companion-list':'companion-card',wardrobe:'outfit-item',album:'photo-item',achievements:'achievement-item',mailbox:'mail-item'};
const prose = new Set(['mail-detail','privacy']);

export const prefabCatalog = definitions.map(([id,name,module,category,prefixes,routes])=>{
  const sourcePages=prefixes.map(source), sourcePage=sourcePages[0]||null;
  const common=category==='common';
  const directory=category==='page'?'pages':category==='dialog'?'dialogs':category==='guide'?'guide':category==='debug'?'debug':'items';
  const path=common?`assets/resources/framework/${name}.prefab`:module==='boot'?`assets/resources/boot/${name}.prefab`:`assets/bundles/${module}/prefabs/${directory}/${name}.prefab`;
  const manual=id==='loading'||id==='mainline-map';
  const bindings=[...(manual?[]:defaultBindings(category)),...(specifics[id]||[]).map(args=>binding(...args))];
  if(listItems[id])bindings.push(binding('scrollView','ScrollView'),binding('viewport','Mask'),binding('content','Node'),binding('itemPrefab','Prefab'));
  if(prose.has(id))bindings.push(binding('scrollView','ScrollView'),binding('viewport','Mask'),binding('content','Node'),binding('bodyLabel','Label','dynamic-text'));
  const uniqueBindings=[...new Map(bindings.map(b=>[b.name,b])).values()];
  const variants=sourcePages.map((key,index)=>({id:key,sourcePage:key,routes:routes.filter(r=>sourceConfigs[key].runtime?.routes?.includes(r)),scope:id==='endless'?'layers-z-below-85':id==='guide-overlay'?'guide-overlay-only':'authored-layout',default:index===0}));
  return {id,name,module,category,path,sourcePage,sourcePages,routes,status:'foundation-business-pending',bindings:uniqueBindings,variants,...(manual?{maintenance:'manual'}:{}),
    presentation:['page','dialog'].includes(category)?(new Set(['challenge-fail','endless-revive','pause','confirmation','hint-empty']).has(id)?'overlay':'authored-full-canvas'):category,
    listItemId:listItems[id]||null,
    resourceRoles:{staticImages:'authored background / panel / decoration / button frames; preserve source geometry',dynamicImages:new Set(['garden','building','scene-companion','companion-list','companion-detail','wardrobe','album','photo-detail','photo-item','outfit-item','theme-card']).has(id)?'theme / stage / companion / outfit / photo selected by assetId':'content icons selected by assetId where applicable',dynamicText:'all source text slots are Label components; numbers, title, prices, progress and status supplied through typed bindings'}};
});

const guideBases={'guide-garden-entry':'mainline-map','guide-home':'garden','guide-menu':'garden','guide-puzzle':'puzzle','guide-return':'puzzle-result','guide-upgrade':'garden','guide-complete':'garden','guide-endless':'endless'};
export const routeCatalog=[...mainRoutes,...metaRoutes.map(route=>({...route,group:route.group==='长线系统'?'05 蜂友与收藏':route.group==='回流系统'?'06 任务与活动':'07 暂停与服务'}))].map(route=>{
  const owner=prefabCatalog.find(p=>p.routes.includes(route.id));
  if(!owner)throw new Error(`Unmapped route: ${route.id}`);
  const authoredSourcePages=Object.entries(sourceConfigs).filter(([,d])=>d.runtime?.routes?.includes(route.id)).map(([key])=>key);
  const basePrefabId=guideBases[route.id]||({'challenge-fail':'puzzle','endless-revive':'endless','endless-confirm':'endless'}[route.id])||null;
  const effectiveSource=route.id==='levels'?source('微信图片_20261019173444_81_187'):route.id==='endless'?source('T13-01'):authoredSourcePages[0]||owner.sourcePage;
  return {...route,prefabId:owner.id,sourcePage:effectiveSource,authoredSourcePages,basePrefabId,overlayPrefabId:owner.category==='guide'?owner.id:null,scope:route.id==='endless'?'layers-z-below-85-live-underlay':owner.category==='guide'?'base-page-plus-guide-overlay':'authored-layout',status:'foundation-business-pending'};
});

export const categoryCounts=Object.fromEntries(['page','dialog','guide','item','common','debug'].map(category=>[category,prefabCatalog.filter(p=>p.category===category).length]));
if(JSON.stringify(Object.values(categoryCounts))!==JSON.stringify([18,28,1,23,10,2]))throw new Error(`Prefab count mismatch: ${JSON.stringify(categoryCounts)}`);
if(routeCatalog.length!==73||new Set(routeCatalog.map(r=>r.id)).size!==73)throw new Error('Expected exactly 73 unique prototype routes');

// JSON output is useful for review without executing/importing Cocos code.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify({categoryCounts,prefabCatalog,routeCatalog},null,2));
