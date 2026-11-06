import { JsonAsset } from 'cc';
import { UIQueue } from '../framework/ui/UILayer';
import { ViewBase } from '../framework/ui/ViewBase';
import { TextParams } from '../framework/i18n/I18n';
import { debugLog } from '../framework/Log';
import { nextPrice } from './domain/Garden';
import { isCleared } from './domain/Mainline';
import { EndlessPage } from './features/endless/EndlessPage';
import { GardenPage } from './features/garden/GardenPage';
import { MapPage } from './features/map/MapPage';
import { PuzzlePage } from './features/puzzle/PuzzlePage';
import { PuzzleWinPopup } from './features/puzzle/PuzzleWinPopup';
import { GuideOverlay } from './features/common/GuideOverlay';
import { SaveData } from './save/SaveData';
import { services } from './Services';

export interface GuideStep {
    page: string;
    tipKey: string;
    stepKey: string;
    tip: number[];
    finger: number[];
    arrow: number[] | null;
}

type Context = 'map' | 'garden' | 'puzzle' | 'win' | 'endless';

/** First-round guide (F048, steps 1–7) and the endless first-clear guide (F049, step 8). */
interface StepRule {
    id: string;
    context: Context;
    done: (save: Readonly<SaveData>) => boolean;
}

const FTUE = 'ftue';
const ENDLESS = 'endless';
const marked = (save: Readonly<SaveData>, id: string): boolean => save.guide.done.indexOf(id) >= 0;
const built = (save: Readonly<SaveData>): number => save.garden.buildings.reduce((sum, level) => sum + level, 0);

const STEPS: StepRule[] = [
    { id: 'ftue.1', context: 'map', done: s => marked(s, 'ftue.1') || built(s) > 0 },
    { id: 'ftue.2', context: 'garden', done: s => built(s) >= 1 },
    { id: 'ftue.3', context: 'map', done: s => isCleared(s, 1) || s.attempt?.levelNumber === 1 },
    { id: 'ftue.4', context: 'puzzle', done: s => isCleared(s, 1) },
    { id: 'ftue.5', context: 'win', done: s => marked(s, 'ftue.5') || built(s) >= 2 },
    { id: 'ftue.6', context: 'garden', done: s => built(s) >= 2 },
    { id: 'ftue.7', context: 'map', done: s => marked(s, 'ftue.7') },
    { id: 'endless.1', context: 'endless', done: s => marked(s, 'endless.1') },
];
/** Step 7 is a closing message: it marks itself done after being shown this long. */
const LAST_MESSAGE_SECONDS = 3;

let steps: GuideStep[] = [];

/** Load step layouts and start following page changes. */
export async function startGuide(): Promise<void> {
    const config = await services.res.load('common', 'config/guide', JsonAsset);
    steps = (config.json as { steps: GuideStep[] }).steps;
    services.ui.onChanged(true, refreshGuide);
    services.save.subscribe(true, refreshGuide);
}

/** Mark a step done (also used by pages for event-driven steps, e.g. the first endless clear). */
export function completeGuide(id: string): void {
    if (marked(services.save.data, id)) return;
    services.save.transact(draft => { draft.guide.done.push(id); });
}

/** Skip the current sequence: the first-round guide as a whole, or the endless guide. */
export function skipGuide(id: string): void {
    const prefix = id.split('.')[0];
    services.save.transact(draft => {
        for (const step of STEPS) if (step.id.startsWith(prefix) && draft.guide.done.indexOf(step.id) < 0) draft.guide.done.push(step.id);
    });
}

function contextOf(view: ViewBase<any> | null): Context | null {
    if (view instanceof PuzzleWinPopup) return 'win';
    if (view instanceof MapPage) return 'map';
    if (view instanceof GardenPage) return 'garden';
    if (view instanceof PuzzlePage) return 'puzzle';
    if (view instanceof EndlessPage) return 'endless';
    return null;
}

function currentStep(save: Readonly<SaveData>, context: Context | null): number {
    const ftue = STEPS.findIndex(s => s.id.startsWith(FTUE) && !s.done(save));
    if (ftue >= 0 && STEPS[ftue].context === context) return ftue;
    const endless = STEPS.findIndex(s => s.id.startsWith(ENDLESS) && !s.done(save));
    if (endless >= 0 && context === 'endless') return endless;
    return -1;
}

/** Show the step that belongs to the visible view, or hide the overlay. */
function refreshGuide(): void {
    const save = services.save.data;
    const context = contextOf(services.ui.top(UIQueue.Popup) ?? services.ui.top(UIQueue.Page));
    if (context === 'garden') completeGuideSilently('ftue.1');
    if (context === 'garden' && isCleared(save, 1)) completeGuideSilently('ftue.5');
    const index = currentStep(services.save.data, context);
    const overlay = services.ui.find(GuideOverlay);
    if (index < 0) {
        if (overlay) overlay.close();
        return;
    }
    const rule = STEPS[index];
    debugLog('Guide', 'step', rule.id, 'on', context);
    if (overlay && overlay.isOpened && overlay.args.id === rule.id) return;
    void services.ui.open(GuideOverlay, { id: rule.id, index, total: STEPS.length, step: steps[index],
        autoCompleteSeconds: rule.id === 'ftue.7' ? LAST_MESSAGE_SECONDS : 0, authoredTip: steps[0].tip, tipParams: tipParams(rule.id) });
}

/** Live values for the step texts: honey before → after the next treehouse upgrade, the first level. */
function tipParams(id: string): TextParams {
    const save = services.save.data;
    if (id === 'ftue.2' || id === 'ftue.6') {
        const price = nextPrice(services.config.garden, save.garden.chapter, save.garden.buildings[0]) ?? 0;
        return { value_1: save.wallet.honey, value_2: save.wallet.honey - price };
    }
    return { level: 1 };
}

/** Marks without re-entering refresh synchronously through the save subscription. */
function completeGuideSilently(id: string): void {
    if (marked(services.save.data, id)) return;
    services.save.subscribe(false, refreshGuide);
    completeGuide(id);
    services.save.subscribe(true, refreshGuide);
}
