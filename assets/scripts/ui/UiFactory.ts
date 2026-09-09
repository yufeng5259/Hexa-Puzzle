import { Color, Graphics, Label, Node, UITransform } from 'cc';

export interface LabelBindOptions {
  text: string;
  fontSize?: number;
  color?: Color;
  width?: number;
  height?: number;
  lineHeight?: number;
  shrinkToFit?: boolean;
}

export function createLabel(name: string, text: string, fontSize: number, color = new Color(255, 255, 255, 255)): Node {
  const node = new Node(name);
  node.layer = 1 << 25;
  const transform = node.addComponent(UITransform);
  transform.setContentSize(Math.max(160, Math.min(520, text.length * fontSize)), fontSize * 1.4);
  configureLabelNode(node, { text, fontSize, color, shrinkToFit: true });
  return node;
}

export function findNodeByPath(root: Node, relativePath: string): Node | null {
  if (!relativePath) return root;
  const segments = relativePath.split('/').filter(Boolean);
  let current: Node | null = root;
  if (segments[0] === root.name) segments.shift();
  for (const segment of segments) {
    current = current?.getChildByName(segment) ?? null;
    if (!current) return null;
  }
  return current;
}

export function configureLabelNode(node: Node, options: LabelBindOptions): Label {
  const existing = node.getComponent(Label);
  if (existing) {
    existing.string = options.text;
    return existing;
  }
  const label = node.addComponent(Label);
  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  const fontSize = options.fontSize ?? label.fontSize ?? 24;
  const width = options.width ?? transform.contentSize.width;
  const height = options.height ?? transform.contentSize.height;
  if (width > 0 && height > 0) transform.setContentSize(width, height);
  label.string = options.text;
  label.fontSize = fontSize;
  label.lineHeight = options.lineHeight ?? Math.round(fontSize * 1.15);
  label.color = options.color ?? label.color;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.overflow = options.shrinkToFit === false ? Label.Overflow.CLAMP : Label.Overflow.SHRINK;
  label.enableWrapText = false;
  return label;
}

export function bindLabelByPath(root: Node, relativePath: string, options: LabelBindOptions): Label {
  const node = findNodeByPath(root, relativePath);
  if (!node) throw new Error(`Missing label node: ${relativePath}`);
  return configureLabelNode(node, options);
}

export function createPanel(name: string, width: number, height: number, color: Color): Node {
  const node = new Node(name);
  node.layer = 1 << 25;
  node.addComponent(UITransform).setContentSize(width, height);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = color;
  graphics.rect(-width / 2, -height / 2, width, height);
  graphics.fill();
  return node;
}
