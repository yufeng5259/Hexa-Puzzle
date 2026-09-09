import { _decorator, Button, Color, Component, Label, Node } from 'cc';
import type { LevelMapDefinition } from '../data/LevelTypes';
import type { I18nKey } from '../i18n/I18nService';
import { configureLabelNode, findNodeByPath } from './UiFactory';

const { ccclass } = _decorator;

export interface WorldCardViewModel {
  map: LevelMapDefinition;
  completed: number;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  onSelect: () => void;
}

@ccclass('WorldCardView')
export class WorldCardView extends Component {
  public async setup(model: WorldCardViewModel): Promise<void> {
    const mode = model.map.mode ?? (model.map.id === 'challenge' ? 'challenge' : 'relaxed');
    const name = model.t(mode === 'challenge' ? 'world.challenge.name' : 'world.classic.name');
    this.label('name_label', /^[\x00-\x7F]+$/.test(name) ? name.toUpperCase() : name, 56, 400);
    this.label('progress_pill/progress_label', model.t('levels.progress', { earned: model.completed, total: model.map.levelCount }), 30, 130);
    this.label('rule_label', model.t(mode === 'challenge' ? 'world.challenge.rule' : 'world.classic.rule'), 22, 360);
    this.bind(model.onSelect);
  }

  private nodeByPath(path: string): Node {
    const node = findNodeByPath(this.node, path);
    if (!node) throw new Error(`Missing WorldCard node: ${path}`);
    return node;
  }

  private label(path: string, text: string, fontSize: number, width: number): Label {
    return configureLabelNode(this.nodeByPath(path), { text, fontSize, width, color: new Color(255, 255, 255, 255) });
  }

  private bind(handler: () => void): void {
    if (!this.node.getComponent(Button)) this.node.addComponent(Button);
    this.node.off(Button.EventType.CLICK);
    this.node.on(Button.EventType.CLICK, handler, this);
  }
}
