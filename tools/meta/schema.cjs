'use strict';
// Three-row header convention adapted from island/meta_dev/app.js.
// Every key here is one independent workbook config/excel/<name>.xlsx.
const schemas = {
 Constants: {id:'string',valueType:'string',value:'string'},
 Rewards: {id:'string',coins:'int',energy:'int',hints:'int'},
 Maps: {id:'string',order:'int',name:'string',backgroundAssetId:'string',nextMapId:'string?',completionRewardId:'string?'},
 MapBuildings: {id:'string',mapId:'string',slot:'int',name:'string',feetX:'number',feetY:'number',anchorX:'number',anchorY:'number',widthFraction:'number',flipX:'bool',zIndex:'int',maxRewardId:'string?'},
 BuildingStages: {id:'string',buildingId:'string',level:'int',cost:'int',assetId:'string'},
 Mainline: {id:'string',levelNo:'int',puzzleId:'string',kind:'string',firstClearRewardId:'string',replayRewardId:'string'},
 PlayerLevels: {id:'string',level:'int',expToNext:'int',rewardId:'string?'},
 SignIn: {id:'string',day:'int',rewardId:'string'},
 DailyTasks: {id:'string',order:'int',type:'string',target:'int',rewardId:'string',slot:'string',weight:'int'},
 EndlessShapes: {id:'string',order:'int',cells:'json',weight:'int',color:'int'},
 EndlessStages: {id:'string',score:'int',rewardId:'string'},
 GuideSteps: {id:'string',order:'int',step:'string',pageId:'string',targetId:'string?',textKey:'string?',params:'json'},
};
/** Constants every build needs, with the value type each must have. */
const constants = {
 initialCoins:'int', initialHints:'int',
 energyMax:'int', energyInitial:'int', energyRecoverSeconds:'int', energyStartCost:'int', energyFirstLevelFree:'bool',
 welcomeRewardId:'string', guideBuildingId:'string', firstMapId:'string',
 buildExpPerUpgrade:'int', buildConstructionSeconds:'number',
 dailyChestRewardId:'string', dailyTaskCount:'int',
 endlessUnlockAfterLevelNo:'int', endlessRadius:'int', endlessTraySize:'int',
 endlessScorePerPlaced:'int', endlessScorePerCleared:'int', endlessScorePerLine:'int', endlessScoreMultiLine:'int',
};
const dailyTaskTypes = ['win','build','endlessLines','endlessScore','placePiece'];
const dailyTaskSlots = ['fixed','rotate','fallback'];
/** Guide steps match core/Guide.ts guideStep(); the runtime derives the step from records. */
const guideSteps = ['firstPuzzle','goBuild','finishBuild','welcome'];
const guidePages = ['home','build','puzzle','result','welcome'];
module.exports={schemas,constants,dailyTaskTypes,dailyTaskSlots,guideSteps,guidePages};
