import { Button, Label, Node, Sprite, SpriteFrame } from 'cc';
import type { Locale } from '../i18n/I18nService';

const labelVisibility = new WeakMap<Node, boolean>();

export function nodes(root: Node): Node[] {
  const result = [root];
  for (const child of root.children) result.push(...nodes(child));
  return result;
}
export function findNode(root: Node, name: string): Node | null {
  return nodes(root).find((node) => node.name === name) ?? null;
}
export function selectVariant(root: Node, page: string, locale: Locale): Node {
  const all = nodes(root);
  const selected = all.find((node) => node.name === `view_${page}`);
  if (!selected) throw new Error(`Missing Prefab variant: ${root.name}/${page}`);
  for (const node of all) {
    if (node.name.startsWith('view_')) node.active = node === selected;
    if (node.name.startsWith('zh_') || node.name.startsWith('img_zh_')) node.active = locale === 'zh-Hans' && labelVisibility.get(node) !== false;
    if (node.name.startsWith('en_') || node.name.startsWith('img_en_')) node.active = locale === 'en' && labelVisibility.get(node) !== false;
  }
  return selected;
}
export function setText(root: Node, id: string, text: string): void {
  for (const node of nodes(root)) {
    if (node.name !== `zh_${id}` && node.name !== `en_${id}`) continue;
    const label = node.getComponent(Label);
    if (label) label.string = text;
  }
}
export function setLabelVisible(root: Node, id: string, visible: boolean, locale: Locale): void {
  for (const node of nodes(root)) {
    if (node.name === `zh_${id}` || node.name === `en_${id}`) labelVisibility.set(node, visible);
    if (node.name === `zh_${id}`) node.active = visible && locale === 'zh-Hans';
    if (node.name === `en_${id}`) node.active = visible && locale === 'en';
  }
}
export function setVisible(root: Node, name: string, visible: boolean): void {
  for (const node of nodes(root)) if (node.name === name) node.active = visible;
}
export function findImage(root: Node, id: string): Sprite | null {
  return findNode(root, `img_${id}`)?.getComponent(Sprite) ?? null;
}
export function setImage(root: Node, id: string, frame: SpriteFrame): void {
  const sprite = findImage(root, id);
  if (sprite) sprite.spriteFrame = frame;
}
export function bindAction(root: Node, action: string, handler: () => void): Button[] {
  return nodes(root).filter((node) => node.name === `hit_${action}`).map((node) => {
    const button = node.getComponent(Button) ?? node.addComponent(Button);
    node.off(Button.EventType.CLICK);
    node.on(Button.EventType.CLICK, () => { if (button.interactable) handler(); });
    return button;
  });
}
export function setActionEnabled(root: Node, action: string, enabled: boolean): void {
  for (const node of nodes(root)) {
    if (node.name === `hit_${action}`) {
      const button = node.getComponent(Button);
      if (button) button.interactable = enabled;
    }
  }
}
