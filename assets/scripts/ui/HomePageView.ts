import { _decorator, Component, Node } from 'cc';
import type { HomeCtaResolution } from '../app/HomeCta';
import type { AppRoute } from '../app/PageFlow';
import type { I18nKey, Locale } from '../i18n/I18nService';
import { bindAction, selectVariant, setActionEnabled, setLabelVisible, setText } from './PrefabUi';
import { TopBarView } from './TopBarView';
const { ccclass } = _decorator;
export interface HomePageViewModel {
  cta: HomeCtaResolution; hints: number; dailyAvailable: boolean; locale: Locale;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onSettings: () => void; onPlay: (route: AppRoute) => void; onWorlds: () => void; onDaily: () => boolean;
}
@ccclass('HomePageView')
export class HomePageView extends Component {
  private model: HomePageViewModel | null = null;
  public async setup(model: HomePageViewModel): Promise<Node[]> {
    this.model = model;
    (this.node.getComponent(TopBarView) ?? this.node.addComponent(TopBarView)).setup(model);
    bindAction(this.node, 'play', () => model.onPlay(model.cta.route));
    bindAction(this.node, 'worlds', model.onWorlds);
    bindAction(this.node, 'daily', () => { if (model.onDaily()) this.setDailyAvailable(false); });
    this.setDailyAvailable(model.dailyAvailable);
    return this.node.children.filter((node) => node.name.startsWith('view_'));
  }
  public setDailyAvailable(available: boolean): void {
    const model = this.model;
    if (!model) return;
    selectVariant(this.node, available ? '01-home' : '14-home-claimed', model.locale);
    setText(this.node, 'play-title', model.t(model.cta.labelKey));
    setLabelVisible(this.node, 'continue-level', Boolean(model.cta.subtitleKey), model.locale);
    setLabelVisible(this.node, 'claim-tomorrow', !available, model.locale);
    if (model.cta.subtitleKey) {
      const mode = model.t(model.cta.mapId === 'challenge' ? 'world.challenge.name' : 'world.classic.name');
      setText(this.node, 'continue-level', model.cta.subtitleParams
        ? model.t('home.levelWithMode', { mode, level: model.cta.subtitleParams.level }) : model.t(model.cta.subtitleKey));
    }
    setActionEnabled(this.node, 'daily', available);
  }
}
