import { Button, Color, Graphics, Label, Node, UITransform, Vec3 } from 'cc';

export function createLabel(name: string, text: string, fontSize: number, color = new Color(255, 255, 255, 255)): Node {
  const node = new Node(name);
  node.layer = 1 << 25;
  const transform = node.addComponent(UITransform);
  transform.setContentSize(Math.max(120, text.length * fontSize), fontSize * 1.4);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = Math.round(fontSize * 1.2);
  label.color = color;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  return node;
}

export function createButton(name: string, text: string, width = 140, height = 58): Node {
  const node = new Node(name);
  node.layer = 1 << 25;
  node.addComponent(Button).transition = Button.Transition.SCALE;
  const transform = node.addComponent(UITransform);
  transform.setContentSize(width, height);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = new Color(29, 42, 52, 245);
  graphics.roundRect(-width / 2, -height / 2, width, height, 7);
  graphics.fill();
  graphics.strokeColor = new Color(119, 222, 237, 255);
  graphics.lineWidth = 2;
  graphics.stroke();
  const label = createLabel(`${name}-label`, text, 24);
  label.setParent(node);
  label.setPosition(Vec3.ZERO);
  return node;
}

export function createPanel(name: string, width: number, height: number, color: Color): Node {
  const node = new Node(name);
  node.layer = 1 << 25;
  node.addComponent(UITransform).setContentSize(width, height);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = color;
  graphics.roundRect(-width / 2, -height / 2, width, height, 8);
  graphics.fill();
  return node;
}
