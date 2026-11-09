/** Read-only configuration boundary. Engine/resource loading is owned by app. */
export interface MapRow { readonly id: string; readonly nameKey: string; readonly backgroundAssetId: string; readonly nextMapId: string | null; readonly completionRewardId: string }
export interface MapBuildingRow { readonly id: string; readonly mapId: string; readonly slotId: number; readonly buildingId: string; readonly x: number; readonly y: number; readonly scale: number; readonly zOrder: number; readonly anchorX: number; readonly anchorY: number; readonly upgradeOffsetX: number; readonly upgradeOffsetY: number }
export interface BuildingStageRow { readonly id: string; readonly buildingId: string; readonly stage: number; readonly cost: number; readonly bodyAssetId: string; readonly effectId: string | null }
export interface MainlineRow { readonly id: string; readonly levelNo: number; readonly puzzleId: string; readonly rewardId: string }
export interface RewardRow { readonly id: string; readonly coins: number; readonly energy: number; readonly hints: number }
export interface GuideStepRow { readonly id: string; readonly groupId: string; readonly nextStepId: string | null; readonly triggerEvent: string; readonly pageId: string; readonly targetId: string | null; readonly action: 'click' | 'drag' | 'wait' | 'continue'; readonly completeEvent: string; readonly params: Readonly<Record<string, unknown>>; readonly textKey: string | null; readonly shape: 'none' | 'rect' | 'roundRect' | 'circle'; readonly offsetX: number; readonly offsetY: number; readonly padding: number; readonly width: number | null; readonly height: number | null; readonly radius: number | null; readonly handOffsetX: number; readonly handOffsetY: number; readonly skippable: boolean; readonly timeoutSeconds: number }
export type BuildingStage = BuildingStageRow;
export type Mainline = MainlineRow;
export type MapBuilding = MapBuildingRow;
type Row = Readonly<Record<string, unknown>>;
const names = ['Constants', 'Maps', 'MapBuildings', 'BuildingStages', 'Mainline', 'Rewards', 'GuideSteps'] as const;
const fields: Record<string, Record<string, string>> = {
    Constants: { id:'string', valueType:'string', value:'value' },
    Maps: { id:'string', nameKey:'string', backgroundAssetId:'string', nextMapId:'string?', completionRewardId:'string' },
    MapBuildings: { id:'string', mapId:'string', slotId:'int', buildingId:'string', x:'number', y:'number', scale:'number', zOrder:'int', anchorX:'number', anchorY:'number', upgradeOffsetX:'number', upgradeOffsetY:'number' },
    BuildingStages: { id:'string', buildingId:'string', stage:'int', cost:'int', bodyAssetId:'string', effectId:'string?' },
    Mainline: { id:'string', levelNo:'int', puzzleId:'string', rewardId:'string' },
    Rewards: { id:'string', coins:'int', energy:'int', hints:'int' },
    GuideSteps: { id:'string', groupId:'string', nextStepId:'string?', triggerEvent:'string', pageId:'string', targetId:'string?', action:'string', completeEvent:'string', params:'object', textKey:'string?', shape:'string', offsetX:'number', offsetY:'number', padding:'number', width:'number?', height:'number?', radius:'number?', handOffsetX:'number', handOffsetY:'number', skippable:'boolean', timeoutSeconds:'int' },
};
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value as Record<string, unknown>).forEach(freeze); Object.freeze(value); } return value; }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }

/** Guide permissions name real view actions; building slots are data-driven. */
const GUIDE_ACTION = /^(puzzle:drag|puzzle:undo|result:home|home:build|welcome:claim|building:upgrade:\d+)$/;
export class MetaManager {
    private readonly tables = new Map<string, Map<string, Row>>();
    public constructor(raw: unknown) {
        if (!record(raw) || raw.schemaVersion !== 1 || !record(raw.tables)) throw new Error('Unsupported game configuration schema');
        for (const name of names) {
            const table = raw.tables[name];
            if (!record(table) || !Array.isArray(table.keys) || !table.keys.length || table.keys[0] !== 'id' || new Set(table.keys).size !== table.keys.length || table.keys.some(key => typeof key !== 'string' || !key || ['__proto__', 'constructor', 'prototype'].includes(key))) throw new Error(`${name}: invalid keys`);
            const keys = table.keys as string[], rows = new Map<string, Row>();
            for (const id of Object.keys(table).filter(key => key !== 'keys')) {
                const values = table[id];
                if (!Array.isArray(values) || values.length !== keys.length || String(values[0]) !== id || ['__proto__','constructor','prototype'].includes(id)) throw new Error(`${name}:${id}: invalid row`);
                const row: Record<string, unknown> = Object.create(null);
                keys.forEach((key, i) => { row[key] = JSON.parse(JSON.stringify(values[i])); });
                if(keys.length!==Object.keys(fields[name]).length)throw new Error(`${name}:${id}: unexpected fields`);
                for(const [key,declared] of Object.entries(fields[name])) {
                    const value=row[key],type=declared.replace(/\?$/,'');
                    if(declared.endsWith('?')&&value===null)continue;
                    const valid=type==='value'?value!==undefined:type==='int'?Number.isSafeInteger(value):type==='number'?typeof value==='number'&&Number.isFinite(value):type==='object'?record(value):typeof value===type&&(type!=='string'||String(value).length>0);
                    if(!valid)throw new Error(`${name}:${id}:${key}: expected ${declared}`);
                }
                rows.set(id, freeze(row));
            }
            if (!rows.size) throw new Error(`${name}: empty table`);
            this.tables.set(name, rows);
        }
        const max = this.getConstant<number>('energyMax'), initial = this.getConstant<number>('energyInitial');
        const interval = this.getConstant<number>('energyRecoverSeconds');
        if (!Number.isSafeInteger(max) || max < 1 || !Number.isSafeInteger(initial) || initial < 0 || initial > max || !Number.isSafeInteger(interval) || interval < 1) throw new Error('Invalid energy constants');
        for (const id of ['energyFailureCost','initialCoins','initialHints']) { const value=this.getConstant<number>(id); if(!Number.isSafeInteger(value)||value<0)throw new Error(`Invalid constant ${id}`); }
        for (const reward of this.rows<RewardRow>('Rewards')) if([reward.coins,reward.energy,reward.hints].some(value=>!Number.isSafeInteger(value)||value<0))throw new Error(`Invalid reward ${reward.id}`);
        this.getReward(this.getConstant<string>('welcomeRewardId'));
        const lines = this.getMainlines();
        const used = new Set<string>();
        lines.forEach((line, i) => { if (line.levelNo !== i + 1 || !line.puzzleId || used.has(line.puzzleId)) throw new Error('Mainline numbers must be continuous with unique puzzles'); used.add(line.puzzleId); this.getReward(line.rewardId); });
        for (const map of this.getMaps()) {
            this.getReward(map.completionRewardId); if (map.nextMapId) this.getMap(map.nextMapId);
            const slots = this.getMapBuildings(map.id);
            if (slots.length !== 5 || slots.some((slot,i) => slot.slotId !== i + 1)) throw new Error(`${map.id}: five unique slots required`);
            slots.forEach(slot => { if(![slot.x,slot.y,slot.scale,slot.zOrder,slot.anchorX,slot.anchorY,slot.upgradeOffsetX,slot.upgradeOffsetY].every(Number.isFinite)||slot.scale<=0||slot.anchorX<0||slot.anchorX>1||slot.anchorY<0||slot.anchorY>1)throw new Error(`Invalid building layout ${slot.id}`); const stages = this.getBuildingStages(slot.buildingId); if (stages.length < 2 || stages.some((stage,i)=>stage.stage !== i || !Number.isSafeInteger(stage.cost) || stage.cost < 0 || !stage.bodyAssetId)) throw new Error(`${slot.buildingId}: invalid stages`); });
        }
        this.getMap(this.getConstant<string>('firstMapId'));
        const guides = this.getGuideSteps(this.getConstant<string>('firstGuideGroupId'));
        if (!guides.length) throw new Error('Missing first guide group');
        for (const step of this.rows<GuideStepRow>('GuideSteps')) {
            if (!['home','puzzle','result','build','welcome'].includes(step.pageId)) throw new Error(`Invalid guide page ${step.id}`);
            const actions = step.params.allowedActions;
            if (!Array.isArray(actions) || actions.some(action => typeof action !== 'string' || !GUIDE_ACTION.test(action))) throw new Error(`Invalid guide allowedActions ${step.id}`);
            if (step.params.highlightProvider !== undefined && (step.params.highlightProvider !== 'puzzlePlacementPreview' || step.action !== 'drag' || !step.params.pieceId || !step.params.targetCell)) throw new Error(`Invalid guide highlightProvider ${step.id}`);
            if(!['click','drag','wait','continue'].includes(step.action)||!['none','rect','roundRect','circle'].includes(step.shape)||!Number.isFinite(step.padding)||step.padding<0||!Number.isFinite(step.timeoutSeconds)||step.timeoutSeconds<0)throw new Error(`Invalid guide step ${step.id}`);
            const seen = new Set([step.id]); let next=step.nextStepId;
            while(next){if(seen.has(next))throw new Error(`Guide cycle at ${next}`);seen.add(next);const target=this.getGuideStep(next);if(target.groupId!==step.groupId)throw new Error('Cross-group guide link');next=target.nextStepId;}
        }
        // Resume derives phases from pages, so the welcome exit is identified by its page, not a fixed target.
        const welcome = guides.find(step=>step.pageId==='welcome'), upgrade=guides.find(step=>step.nextStepId===welcome?.id);
        if (!welcome || welcome.completeEvent!=='welcome.rewardCommitted' || welcome.nextStepId!==null || upgrade?.completeEvent!=='building.upgradeCommitted') throw new Error('Missing welcome guide exit after upgrade');
        const drags=guides.filter(step=>step.action==='drag'),pieceIds=new Set(drags.map(step=>step.params.pieceId));
        if(!drags.length||pieceIds.size!==drags.length)throw new Error('First guide requires unique drag lessons');
        const pointed=new Set(guides.map(step=>step.nextStepId));let cursor=guides.find(step=>!pointed.has(step.id));
        const pending=new Set(drags.map(step=>step.id));
        while(cursor?.action==='drag'){
            if(cursor.skippable||cursor.timeoutSeconds!==0||cursor.params.highlightProvider!=='puzzlePlacementPreview'||(cursor.params.allowedActions as unknown[]).length!==1||(cursor.params.allowedActions as unknown[])[0]!=='puzzle:drag')throw new Error('Drag lessons must be forced with native preview');
            pending.delete(cursor.id);cursor=cursor.nextStepId?this.getGuideStep(cursor.nextStepId):undefined;
        }
        if(pending.size||cursor?.action!=='wait'||cursor.completeEvent!=='puzzle.winCommitted'||(cursor.params.allowedActions as unknown[]).length!==0||cursor.skippable||cursor.timeoutSeconds!==0)throw new Error('First guide requires consecutive drag lessons then committed win wait');
        for (const map of this.getMaps()) { const seen=new Set([map.id]); let next=map.nextMapId; while(next){if(seen.has(next))throw new Error(`Map cycle at ${next}`);seen.add(next);next=this.getMap(next).nextMapId;} }
        const firstSlot=this.getMapBuildings(this.getConstant<string>('firstMapId'))[0];
        if(this.getConstant<number>('initialCoins')+this.getReward(lines[0].rewardId).coins<this.getBuildingStage(firstSlot.buildingId,1).cost)throw new Error('First guide upgrade is unaffordable');
    }
    private get<T>(name: string, id: string): T { const row = this.tables.get(name)?.get(String(id)); if (!row) throw new Error(`Missing configuration ${name}:${id}`); return row as unknown as T; }
    private rows<T>(name: string): readonly T[] { return Object.freeze(Array.from(this.tables.get(name)!.values()) as unknown as T[]); }
    public getConstant<T = unknown>(id: string): T { return this.get<{ value: T }>('Constants', id).value; }
    public getMap(id: string): MapRow { return this.get('Maps', id); }
    public getMaps(): readonly MapRow[] { return this.rows('Maps'); }
    public getMapBuildings(mapId: string): readonly MapBuildingRow[] { return Object.freeze(this.rows<MapBuildingRow>('MapBuildings').filter(row=>row.mapId===mapId).sort((a,b)=>a.slotId-b.slotId)); }
    public getBuildingStage(buildingId: string, stage: number): BuildingStageRow { const row = this.getBuildingStages(buildingId).find(value=>value.stage===stage); if (!row) throw new Error(`Missing building stage ${buildingId}:${stage}`); return row; }
    public getBuildingStages(buildingId: string): readonly BuildingStageRow[] { return Object.freeze(this.rows<BuildingStageRow>('BuildingStages').filter(row=>row.buildingId===buildingId).sort((a,b)=>a.stage-b.stage)); }
    public getMaxStage(buildingId: string): number { const stages=this.getBuildingStages(buildingId); if(!stages.length) throw new Error(`Unknown building ${buildingId}`); return stages[stages.length-1].stage; }
    public getMainlines(): readonly MainlineRow[] { return Object.freeze([...this.rows<MainlineRow>('Mainline')].sort((a,b)=>a.levelNo-b.levelNo)); }
    public getMainlineCount(): number { return this.tables.get('Mainline')!.size; }
    public getMainline(levelNo: number): MainlineRow { const line=this.getMainlines().find(row=>row.levelNo===levelNo); if(!line)throw new Error(`Unknown mainline ${levelNo}`);return line; }
    public getReward(id: string): RewardRow { return this.get('Rewards', id); }
    public getGuideStep(id: string): GuideStepRow { return this.get('GuideSteps', id); }
    public getGuideSteps(groupId: string): readonly GuideStepRow[] { return Object.freeze(this.rows<GuideStepRow>('GuideSteps').filter(row=>row.groupId===groupId)); }
}
