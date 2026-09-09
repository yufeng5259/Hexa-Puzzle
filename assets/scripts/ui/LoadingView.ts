import { _decorator, BlockInputEvents, Component, Node, Sprite, tween, UIOpacity, UITransform, view } from 'cc';
import type { Locale } from '../i18n/I18nService';
import { bindAction, findImage, findNode, selectVariant, setLabelVisible, setText, setVisible } from './PrefabUi';
const { ccclass } = _decorator;
export interface LoadingViewModel {
  locale: Locale; startText: string; retryText: string; onRetry: () => void;
}
@ccclass('LoadingView')
export class LoadingView extends Component {
  private progress = 0;
  private progressFill: Sprite | null = null;
  private retryButton: Node | null = null;
  private blockInput: BlockInputEvents | null = null;
  private opacity: UIOpacity | null = null;
  private locale: Locale = 'zh-Hans';
  public setup(model: LoadingViewModel): void {
    this.locale = model.locale;
    this.setLocale(model.locale);
    this.progressFill = findImage(this.node, 'progress-fill');
    this.retryButton = findNode(this.node, 'hit_retry');
    this.blockInput = this.node.getComponent(BlockInputEvents) ?? this.node.addComponent(BlockInputEvents);
    this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    this.opacity.opacity = 255;
    if (this.progressFill) {
      this.progressFill.type = Sprite.Type.FILLED;
      this.progressFill.fillType = Sprite.FillType.HORIZONTAL;
      this.progressFill.fillStart = 0;
      this.progressFill.fillRange = 0;
    }
    setText(this.node, 'retry', model.retryText);
    bindAction(this.node, 'retry', model.onRetry);
    this.setProgress(0, model.startText);
    this.layout();
    this.showRetry(false);
  }
  public setLocale(locale: Locale): void {
    this.locale = locale;
    selectVariant(this.node, '13-loading', locale);
  }
  public setProgress(value: number, message?: string): void {
    this.progress = Math.max(this.progress, Math.min(1, Math.max(0, value)));
    if (this.progressFill) this.progressFill.fillRange = this.progress;
    setText(this.node, 'progress-value', `${Math.round(this.progress * 100)}%`);
    if (message) setText(this.node, 'loading', message);
  }
  public showError(message: string): void {
    setText(this.node, 'loading', message);
    this.showRetry(true);
    if (this.blockInput) this.blockInput.enabled = true;
  }
  public prepareRetry(): void {
    this.progress = 0;
    this.setProgress(0);
    this.showRetry(false);
    if (this.blockInput) this.blockInput.enabled = true;
    if (this.opacity) this.opacity.opacity = 255;
    this.node.active = true;
  }
  public disableInput(): void { if (this.blockInput) this.blockInput.enabled = false; }
  public fadeOut(duration = 0.18): Promise<void> {
    this.disableInput();
    if (!this.opacity) { this.node.active = false; return Promise.resolve(); }
    return new Promise((resolve) => tween(this.opacity!).to(duration, { opacity: 0 })
      .call(() => { this.node.active = false; resolve(); }).start());
  }
  public layout(): void {
    const size = view.getVisibleSize();
    const cover = Math.max(1, size.width / 720, size.height / 1280);
    this.node.getComponent(UITransform)?.setContentSize(Math.max(720, size.width), Math.max(1280, size.height));
    findImage(this.node, 'background')?.node.setScale(cover, cover, 1);
  }
  private showRetry(visible: boolean): void {
    if (this.retryButton) this.retryButton.active = visible;
    setVisible(this.node, 'img_retry', visible);
    setLabelVisible(this.node, 'retry', visible, this.locale);
  }
}
