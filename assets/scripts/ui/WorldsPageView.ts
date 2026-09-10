import { _decorator, Component, Node } from 'cc';
import type { LevelMapDefinition } from '../data/LevelTypes';
import type { I18nKey, Locale } from '../i18n/I18nService';
import { bindAction, selectVariant, setText } from './PrefabUi';
import { TopBarView } from './TopBarView';
const { ccclass } = _decorator;
export interface WorldsPageViewModel {
  maps: LevelMapDefinition[]; hints: number; locale: Locale;
  completedFor: (mapId: string) => number;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onBack: () => void; onSettings: () => void; onSelectWorld: (mapId: string) => void;
}
@ccclass('WorldsPageView')
export class WorldsPageView extends Component {
  private model: WorldsPageViewModel | null = null;
  public async setup(model: WorldsPageViewModel): Promise<Node[]> {
    this.model = model;
    const page = selectVariant(this.node, '02-worlds', model.locale);
    (this.node.getComponent(TopBarView) ?? this.node.addComponent(TopBarView)).setup(model);
    for (const map of model.maps) {
      const id = map.mode === 'challenge' || map.id === 'challenge' ? 'challenge' : 'classic';
      setText(page, `${id}-progress`, `${model.completedFor(map.id)}/${map.levelCount}`);
      bindAction(page, id, () => model.onSelectWorld(map.id));
    }
    bindAction(page, 'back', model.onBack);
    return [page];
  }
  public setLocale(locale: Locale): void {
    const model = this.model;
    if (!model) return;
    this.model = { ...model, locale };
    selectVariant(this.node, '02-worlds', locale);
  }
}
