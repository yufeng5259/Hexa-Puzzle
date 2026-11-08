'use strict';
// Three-row header convention adapted from island/meta_dev/app.js.
const schemas = {
 Constants: {id:'string',valueType:'string',value:'string'},
 Maps: {id:'string',nameKey:'string',backgroundAssetId:'string',nextMapId:'string?',completionRewardId:'string'},
 MapBuildings: {id:'string',mapId:'string',slotId:'int',buildingId:'string',x:'number',y:'number',scale:'number',zOrder:'int',anchorX:'number',anchorY:'number',upgradeOffsetX:'number',upgradeOffsetY:'number'},
 BuildingStages: {id:'string',buildingId:'string',stage:'int',cost:'int',bodyAssetId:'string',effectId:'string?'},
 Mainline: {id:'string',levelNo:'int',puzzleId:'string',rewardId:'string'},
 Rewards: {id:'string',coins:'int',energy:'int',hints:'int'},
 GuideSteps: {id:'string',groupId:'string',nextStepId:'string?',triggerEvent:'string',pageId:'string',targetId:'string?',action:'string',completeEvent:'string',params:'json',textKey:'string?',shape:'string',offsetX:'number',offsetY:'number',padding:'number',width:'number?',height:'number?',radius:'number?',handOffsetX:'number',handOffsetY:'number',skippable:'bool',timeoutSeconds:'int'}
};
const buildingIds = ['treehouse','flowerbed','workshop','watermill','greenhouse'];
const assetIds = ['garden1.background', ...buildingIds.flatMap(id=>Array.from({length:6},(_,stage)=>`building.${id}.stage${stage}`))];
const targetIds = ['home.build','home.play','result.home','welcome.claim','building.slot1.upgrade',...Array.from({length:3},(_,i)=>[`puzzle.piece${i}`,`puzzle.target${i}`]).flat()];
module.exports={schemas,buildingIds,assetIds,targetIds};
