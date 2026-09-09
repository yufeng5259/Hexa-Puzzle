import { _decorator, Button, Color, Component, Label, Node } from 'cc';
import type { GameMode } from '../data/LevelTypes';
import type { I18nKey } from '../i18n/I18nService';
import { configureLabelNode, findNodeByPath } from './UiFactory';

const { ccclass } = _decorator;

export interface LevelItemViewModel {
  mode: GameMode;
  levelNumber: number;
  state: 'locked' | 'current' | 'completed';
  stars: number;
  unassisted: boolean;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onSelect: () => void;
}

@ccclass('LevelItemView')
export class LevelItemView extends Component {
  private boundSelect: (() => void) | null = null;

  public async setup(model: LevelItemViewModel): Promise<void> {
    this.label('number_label', String(model.levelNumber), 32, 76);
    for (const state of ['available', 'current', 'completed', 'locked'] as const) {
      this.nodeByPath(`button_bg_${state}`).active = state === model.state;
    }
    const lock = this.nodeByPath('lock_icon');
    lock.active = model.state === 'locked';
    const starsRoot = this.nodeByPath('stars_root');
    starsRoot.active = model.state !== 'locked' && model.mode === 'challenge';
    if (starsRoot.active) {
      for (let index = 1; index <= 3; index += 1) {
        this.nodeByPath(`stars_root/star_${index}_filled`).active = index <= model.stars;
        this.nodeByPath(`stars_root/star_${index}_empty`).active = index > model.stars;
      }
    }
    const badge = this.optionalNodeByPath('completion_badge');
    if (badge) {
      badge.active = model.state === 'completed' && model.mode === 'relaxed';
      const label = this.optionalNodeByPath('completion_badge/label');
      if (label && badge.active) configureLabelNode(label, {
        text: model.t(model.unassisted ? 'win.unassisted' : 'win.completed'),
        fontSize: 15,
        width: 86,
        color: new Color(255, 255, 255, 255),
      });
    }
    this.bind(model.state !== 'locked' ? model.onSelect : null);
  }

  private nodeByPath(path: string): Node {
    const node = findNodeByPath(this.node, path);
    if (!node) throw new Error(`Missing LevelItem node: ${path}`);
    return node;
  }

  private optionalNodeByPath(path: string): Node | null {
    return findNodeByPath(this.node, path);
  }

  private label(path: string, text: string, fontSize: number, width: number): Label {
    return configureLabelNode(this.nodeByPath(path), { text, fontSize, width, color: new Color(255, 255, 255, 255) });
  }

  private bind(handler: (() => void) | null): void {
    const button = this.node.getComponent(Button) ?? this.node.addComponent(Button);
    if (this.boundSelect) {
      this.node.off(Button.EventType.CLICK, this.boundSelect, this);
      this.boundSelect = null;
    }
    button.interactable = Boolean(handler);
    if (!handler) return;
    let selected = false;
    this.boundSelect = () => {
      if (selected) return;
      selected = true;
      handler();
    };
    this.node.on(Button.EventType.CLICK, this.boundSelect, this);
  }
}
