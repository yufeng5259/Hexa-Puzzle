import {ref,scriptType} from './builder.mjs';
const supported=new Set(['puzzle','puzzle-preview','puzzle-result','challenge-result','challenge-fail','pause','confirmation','settings']);

/** Explicit build-time source slot bindings; runtime components never search node names. */
export function attachPlayStatus(p,b,contexts){
  if(!supported.has(p.id))return;
  for(const ctx of contexts){
    if(ctx.sourcePage?.startsWith('T13-'))continue;
    const labels=[],keys=[];
    const slot=(pattern,key)=>ctx.texts.filter(t=>pattern.test(t.name)).forEach(t=>{labels.push(ref(t.id));keys.push(key);});
    slot(/^花蜜余额$|^花蜜数量$/,'honey');
    slot(/^提示库存值$|^提示库存$|^本关提示库存$/,'inventory');
    slot(/^玩家主线进度$|^头像进度等级$/,'playerLevel');
    if(p.id==='puzzle-preview')slot(/^收益说明$/,'preview');
    if(p.id==='pause'){slot(/^弹窗说明$/,'pauseMessage');slot(/^保存回主界面_文案$/,'exitCaption');}
    if(p.id==='confirmation'){
      slot(/^弹窗说明$/,ctx.sourcePage.startsWith('T37-')?'exitMessage':'restartMessage');
      slot(/^保存并返回_文案$/,'exitCaption');
    }
    if(p.id==='puzzle-result'||p.id==='challenge-result'){
      slot(/^页面标题$/,'resultTitle');slot(/^已到账$/,'resultMessage');slot(/^本次实际奖励$/,'amount');
      slot(/^关号$/,'level');slot(/^历史最佳$/,'history');slot(/^下一关_文案$/,'next');
    }
    if(p.id==='challenge-fail'){
      slot(/^弹窗说明$/,'failMessage');slot(/^弹窗实际数值$/,'failNumber');slot(/^弹窗数值说明$/,'failUnit');
    }
    slot(/^视频.*文案$/,'unavailableAd');
    if(p.id==='settings')slot(/^本地存档_文案$/,'localSave');
    const unavailable=ctx.buttons.filter(t=>/^视频|^本地存档_/.test(t.name));
    const unavailableNodes=p.id==='challenge-result'?ctx.images.filter(t=>/星[123]|星级|成绩星/.test(t.name)).map(t=>ref(t.node)):[];
    b.component(ctx.root,scriptType('assets/scripts/features/puzzle/presentation/PlayStatusPresentation.ts'),{
      kind:p.id,labels,keys,unavailableButtons:unavailable.map(t=>ref(t.id)),unavailableNodes,
    });
    // Existing fixed buttons keep serialized targets; only their action contract changes.
    if(p.id==='challenge-fail'||p.id==='challenge-result')for(const button of ctx.buttons){
      const action=/^免费重试_/.test(button.name)?'play:retry':/^下一关_/.test(button.name)?'play:next':/^返回地图_|^返回上一页$/.test(button.name)?'nav:mainline-map':/^回家园$/.test(button.name)?'nav:garden':null;
      if(action)b.objects[button.id].clickEvents=[{__type__:'cc.ClickEvent',target:ref(b.root),component:p.viewClass,_componentId:'',handler:'onAction',customEventData:action}];
    }
  }
}
