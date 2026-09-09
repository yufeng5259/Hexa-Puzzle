import { _decorator, Component, Node, resources, SpriteFrame } from 'cc';
import { clampPage, pageCount, pageLevelIndices } from '../app/PageFlow';
import type { LevelMapDefinition } from '../data/LevelTypes';
import type { SaveData } from '../data/SaveService';
import type { I18nKey, Locale } from '../i18n/I18nService';
import { bindAction, selectVariant, setActionEnabled, setImage, setLabelVisible, setText, setVisible } from './PrefabUi';
import { TopBarView } from './TopBarView';
const { ccclass } = _decorator;
function loadFrame(path: string): Promise<SpriteFrame> {
  return new Promise((resolve, reject) => resources.load(`ui/toybox-v4/${path}/spriteFrame`, SpriteFrame,
    (error, frame) => error ? reject(error) : resolve(frame)));
}
export interface LevelsPageViewModel {
  map: LevelMapDefinition; mapId: string; requestedPage: number; maxCompleted: number; save: SaveData; hints: number; locale: Locale;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onBack: () => void; onSettings: () => void; onPage: (page: number) => void; onSelectLevel: (levelIndex: number) => void;
}
@ccclass('LevelsPageView')
export class LevelsPageView extends Component {
  public async setup(model: LevelsPageViewModel): Promise<Node[]> {
    const challenge = model.map.mode === 'challenge' || model.mapId === 'challenge';
    const pageSize = model.map.pageSize ?? (challenge ? 10 : 20);
    const page = clampPage(model.requestedPage, model.map.levelCount, pageSize);
    const root = selectVariant(this.node, challenge ? '04-challenge-levels' : '03-classic-levels', model.locale);
    (this.node.getComponent(TopBarView) ?? this.node.addComponent(TopBarView)).setup(model);
    const progress = model.save.maps[model.mapId];
    const levelIds = model.map.levelIds;
    if (!progress || !levelIds || levelIds.length !== model.map.levelCount) throw new Error(`Missing stable level IDs for map: ${model.mapId}`);
    const pageLevels = pageLevelIndices(page, model.map.levelCount, pageSize);
    const complete = levelIds.filter((id) => progress.levels[id]?.completed).length;
    setText(root, 'classic-progress', `${complete}/${model.map.levelCount}`);
    setText(root, 'group-progress', `${complete} / ${model.map.levelCount}`);
    setText(root, 'group-title', model.locale === 'en' ? `Group ${page + 1}` : `第${['一', '二', '三'][page] ?? page + 1}组`);
    setText(root, 'group-rule', model.locale === 'en' ? `Pieces +${Math.max(1, 3 - page)} moves` : `拼块数 +${Math.max(1, 3 - page)} 步`);
    setText(root, 'page-indicator', `${page + 1}/${pageCount(model.map.levelCount, pageSize)}`);
    const [completedFrame, currentFrame, lockedFrame, gold, empty] = await Promise.all([
      loadFrame('levels/completed'), loadFrame('levels/current'), loadFrame('levels/locked'),
      loadFrame('icons/star-gold'), loadFrame('icons/star-empty'),
    ]);
    for (let slot = 0; slot < (challenge ? 10 : 20); slot += 1) {
      const id = `level-${('0' + (slot + 1)).slice(-2)}`;
      const levelIndex = pageLevels[slot];
      const exists = levelIndex !== undefined;
      const result = exists ? progress.levels[levelIds[levelIndex]] : undefined;
      const unlocked = exists && progress.unlockedLevelIds.indexOf(levelIds[levelIndex]) >= 0;
      setVisible(root, `img_${id}`, exists);
      setLabelVisible(root, `${id}-number`, exists, model.locale);
      setVisible(root, `img_${id}-lock`, exists && !unlocked);
      setVisible(root, `img_${id}-check`, exists && Boolean(result?.completed) && !challenge);
      setVisible(root, `hit_${id}`, exists);
      for (let star = 0; star < 3; star += 1) {
        setVisible(root, `img_${id}-star-${star}`, challenge && exists && Boolean(result?.completed));
        setImage(root, `${id}-star-${star}`, star < (result?.bestStars ?? 0) ? gold : empty);
      }
      if (!exists) continue;
      setText(root, `${id}-number`, String(levelIndex + 1));
      setImage(root, id, result?.completed ? completedFrame : unlocked ? currentFrame : lockedFrame);
      bindAction(root, id, () => model.onSelectLevel(levelIndex));
      setActionEnabled(root, id, unlocked);
    }
    bindAction(root, 'previous', () => model.onPage(page - 1));
    bindAction(root, 'next', () => model.onPage(page + 1));
    setActionEnabled(root, 'previous', page > 0);
    setActionEnabled(root, 'next', page + 1 < pageCount(model.map.levelCount, pageSize));
    bindAction(root, 'back', model.onBack);
    return [root];
  }
}
