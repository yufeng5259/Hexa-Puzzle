import { Node, tween, Tween, UIOpacity, Vec3 } from 'cc';

export interface HapticsAdapter {
  impact(kind: 'light' | 'medium' | 'error' | 'success'): void;
}

export type FeedbackKind = 'pickup' | 'valid-preview' | 'wrong-valid' | 'invalid-return' | 'correct-drop' | 'complete';

export class FeedbackPresenter {
  public constructor(private readonly haptics: HapticsAdapter | null = null) {}

  public stopNode(node: Node): void {
    Tween.stopAllByTarget(node);
  }

  public pulse(node: Node, kind: FeedbackKind): void {
    this.stopNode(node);
    const base = node.scale.clone();
    const multiplier = kind === 'invalid-return' ? 0.94 : kind === 'complete' ? 1.12 : 1.06;
    const raised = new Vec3(base.x * multiplier, base.y * multiplier, base.z);
    const hapticKind = kind === 'invalid-return' ? 'error' : kind === 'complete' ? 'success' : 'light';
    this.impact(hapticKind);
    tween(node).to(0.08, { scale: raised }).to(0.12, { scale: base }).start();
  }

  public fadeIn(node: Node, duration = 0.18): void {
    let opacity = node.getComponent(UIOpacity);
    if (!opacity) opacity = node.addComponent(UIOpacity);
    opacity.opacity = 0;
    tween(opacity).to(duration, { opacity: 255 }).start();
  }

  private impact(kind: 'light' | 'medium' | 'error' | 'success'): void {
    try { this.haptics?.impact(kind); } catch { /* haptics are optional */ }
  }
}
