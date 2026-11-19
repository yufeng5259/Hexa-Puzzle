'use strict';
// Three-row header convention adapted from island/meta_dev/app.js.
// Every key here is one independent workbook config/excel/<name>.xlsx.
const schemas = {
 Constants: {id:'string',valueType:'string',value:'string'},
 Rewards: {id:'string',coins:'int',energy:'int',hints:'int',scaleByMap:'bool'},
 Maps: {id:'string',order:'int',name:'string',chapter:'string',subtitle:'string',incomeMult:'number',backgroundAssetId:'string',thumbAssetId:'string',placeholderOf:'string?',nextMapId:'string?',completionRewardId:'string?'},
 MapBuildings: {id:'string',mapId:'string',slot:'int',name:'string',feetX:'number',feetY:'number',anchorX:'number',anchorY:'number',widthFraction:'number',flipX:'bool',zIndex:'int',maxRewardId:'string?'},
 BuildingStages: {id:'string',buildingId:'string',level:'int',cost:'int',assetId:'string'},
 Mainline: {id:'string',levelNo:'int',puzzleId:'string',kind:'string',firstClearRewardId:'string',replayRewardId:'string'},
 PlayerLevels: {id:'string',level:'int',expToNext:'int',rewardId:'string?'},
 SignIn: {id:'string',day:'int',rewardId:'string'},
 DailyTasks: {id:'string',order:'int',type:'string',target:'int',rewardId:'string',slot:'string',weight:'int'},
 EndlessShapes: {id:'string',order:'int',cells:'json',weight:'int',color:'int'},
 EndlessStages: {id:'string',score:'int',rewardId:'string'},
 GuideSteps: {id:'string',order:'int',step:'string',pageId:'string',targetId:'string?',textKey:'string?',params:'json'},
 LeagueTiers: {id:'string',tier:'int',name:'string',starsToNext:'int',rewardMult:'number',strength:'number',floor:'int'},
 LeagueRewards: {id:'string',order:'int',board:'string',rankFrom:'int',rankTo:'int',coins:'int',energy:'int',hints:'int',stars:'int',gift:'string'},
 LeagueCurves: {id:'string',board:'string',slot:'int',mult:'number'},
 LeagueBots: {id:'string',order:'int',name:'string',nameEn:'string',avatar:'string',avatarBg:'int',style:'string',skill:'number',sessionsMin:'int',sessionsMax:'int',activeFrom:'int',activeTo:'int',sprintShare:'number',tierMin:'int',tierMax:'int'},
};
/** Constants every build needs, with the value type each must have. */
const constants = {
 initialCoins:'int', initialHints:'int',
 energyMax:'int', energyInitial:'int', energyRecoverSeconds:'int', energyStartCost:'int', energyFirstLevelFree:'bool',
 welcomeRewardId:'string', guideBuildingId:'string', firstMapId:'string', mainlineLoopTransforms:'json',
 buildExpPerUpgrade:'int', buildConstructionSeconds:'number', 
 buildFxScaffoldEnd:'number', buildFxCarryStart:'number', buildFxCarryEnd:'number', buildFxHammerStart:'number', buildFxCloudStart:'number',
 buildFxRevealAt:'number', buildFxSparkleSeconds:'number', buildFxBeeFraction:'number', buildFxResumeFrom:'number',
 dailyChestRewardId:'string', dailyTaskCount:'int',
 endlessUnlockAfterLevelNo:'int', endlessRadius:'int', endlessTraySize:'int',
 endlessScorePerPlaced:'int', endlessScorePerCleared:'int', endlessScorePerLine:'int', endlessScoreMultiLine:'int',
 endlessSwapPerGame:'int', endlessHammerPerGame:'int', endlessSwapRetries:'int',
 animProgressSeconds:'number',
 animCardSeconds:'number', animCardStaggerSeconds:'number', animScatterSeconds:'number', animFlySeconds:'number', animPulseSeconds:'number',
 animSkipAfterSeconds:'number', animRewardTimeoutSeconds:'number', animChestShakeSeconds:'number', animChestOpenSeconds:'number', animCoinParticlesMax:'int',
 animWinHoldSeconds:'number', animWinWaveSeconds:'number', animResultEnterSeconds:'number', animFailSeconds:'number', animBoardFadeSeconds:'number', animFirstWinLimitSeconds:'number',
 animEndlessSettleSeconds:'number', animEndlessHighlightSeconds:'number', animEndlessClearSeconds:'number', animEndlessScoreSeconds:'number', animEndlessRefillSeconds:'number',
 animEndlessDimSeconds:'number', animScoreRollSeconds:'number', animRecordSeconds:'number',
 animEndlessSwapOutSeconds:'number', animEndlessSwapInSeconds:'number', animEndlessHammerSeconds:'number', animEndlessShatterSeconds:'number',
 leagueDailySize:'int', leagueWeeklySize:'int', leagueAllTimeSize:'int', leagueDailyBaseDefault:'int', leagueWeeklyBaseDefault:'int',
 leagueAllTimeMin:'int', leagueAllTimeMax:'int', leagueAllTimeGrowMin:'number', leagueAllTimeGrowMax:'number',
 leaguePendingMax:'int', leagueJitter:'number', leagueSprintHours:'number',
};
const dailyTaskTypes = ['win','build','endlessLines','endlessScore','placePiece'];
const dailyTaskSlots = ['fixed','rotate','fallback'];
/** Guide steps match core/Guide.ts guideStep(); the runtime derives the step from records. */
const guideSteps = ['firstPuzzle','goBuild','finishBuild','welcome'];
const guidePages = ['home','build','puzzle','result','welcome'];
/** League (docs/v2/16): boards with rewards, opening gifts, bot play styles and the 24 animal avatars (docs/v2/17 §3.1). */
const leagueBoards = ['daily','weekly'];
const leagueGifts = ['gold','silver','bronze','coin','none'];
const leagueStyles = ['casual','steady','sprinter','nightOwl'];
const leagueAvatars = ['bear','rabbit','fox','cat','dog','panda','raccoon','hedgehog','squirrel','frog','duck','chick','sloth','monkey','tiger','lion','elephant','giraffe','hippo','crocodile','seal','owl','penguin','koala'];
module.exports={schemas,constants,dailyTaskTypes,dailyTaskSlots,guideSteps,guidePages,leagueBoards,leagueGifts,leagueStyles,leagueAvatars};
