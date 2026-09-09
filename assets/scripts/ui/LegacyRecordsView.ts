import { _decorator, Component, resources, SpriteFrame } from 'cc';
import type { SaveData } from '../data/SaveTypes';
import type { I18nKey, Locale } from '../i18n/I18nService';
import { bindAction, nodes, selectVariant, setActionEnabled, setImage, setLabelVisible, setText, setVisible } from './PrefabUi';
const { ccclass } = _decorator;
type LegacyTab = 'classic' | 'novice';
const PAGE_SIZE = 4;
export interface LegacyRecordsViewModel {
  legacy: SaveData['legacy']; locale: Locale;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onClose: () => void;
}
interface LegacyRecordRow {
  index: number; completed: boolean; bestStars: number; bestMoves: number | null;
}
@ccclass('LegacyRecordsView')
export class LegacyRecordsView extends Component {
  private model: LegacyRecordsViewModel | null = null;
  private tab: LegacyTab = 'classic';
  private page = 0;
  private stars: SpriteFrame[] = [];
  public setup(model: LegacyRecordsViewModel): void {
    this.model = model;
    selectVariant(this.node, '12-legacy-records', model.locale);
    bindAction(this.node, 'close', model.onClose);
    bindAction(this.node, 'return', model.onClose);
    bindAction(this.node, 'classic', () => this.selectTab('classic'));
    bindAction(this.node, 'novice', () => this.selectTab('novice'));
    bindAction(this.node, 'previous', () => this.setPage(this.page - 1));
    bindAction(this.node, 'next', () => this.setPage(this.page + 1));
    this.render();
    void Promise.all(['star-gold', 'star-empty'].map((id) => new Promise<SpriteFrame>((resolve, reject) =>
      resources.load(`ui/toybox-v4/icons/${id}/spriteFrame`, SpriteFrame, (error, frame) => error ? reject(error) : resolve(frame))
    ))).then((frames) => { if (this.node.isValid) { this.stars = frames; this.render(); } })
      .catch((error) => console.error('[LegacyRecords] Star images unavailable', error));
  }
  private selectTab(tab: LegacyTab): void { this.tab = tab; this.page = 0; this.render(); }
  private setPage(page: number): void {
    this.page = Math.max(0, Math.min(Math.max(1, Math.ceil(this.rows().length / PAGE_SIZE)) - 1, Math.trunc(page)));
    this.render();
  }
  private render(): void {
    if (!this.model) return;
    const rows = this.rows();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    setVisible(this.node, 'img_classic-tab', this.tab === 'classic');
    setVisible(this.node, 'img_novice-tab', this.tab === 'novice');
    setLabelVisible(this.node, 'empty', rows.length === 0, this.model.locale);
    setText(this.node, 'empty', this.model.t('legacy.empty'));
    setText(this.node, 'page-indicator', `${this.page + 1}/${pages}`);
    setActionEnabled(this.node, 'previous', this.page > 0);
    setActionEnabled(this.node, 'next', this.page + 1 < pages);
    for (let slot = 0; slot < PAGE_SIZE; slot += 1) {
      const row = rows[this.page * PAGE_SIZE + slot];
      const id = `record-${slot + 1}`;
      for (const node of nodes(this.node)) {
        if (node.name.startsWith(`img_${id}-`)) node.active = Boolean(row);
        if (node.name.startsWith(`zh_${id}-`)) node.active = Boolean(row) && this.model.locale === 'zh-Hans';
        if (node.name.startsWith(`en_${id}-`)) node.active = Boolean(row) && this.model.locale === 'en';
      }
      if (!row) continue;
      setText(this.node, `${id}-number`, String(row.index + 1));
      setText(this.node, `${id}-moves`, row.bestMoves === null ? '-' : String(row.bestMoves));
      for (let star = 1; star <= 3; star += 1) {
        const frame = this.stars[star <= row.bestStars ? 0 : 1];
        if (frame) setImage(this.node, `${id}-star-${star}`, frame);
      }
    }
  }
  private rows(): LegacyRecordRow[] {
    const map = this.model?.legacy.maps[this.tab];
    if (!map) return [];
    return Object.keys(map.levels).sort((a, b) => Number(a) - Number(b)).map((key) => {
      const value = map.levels[key];
      return { index: Number(key), completed: value.completed, bestStars: value.bestStars, bestMoves: value.bestMoves };
    });
  }
}
