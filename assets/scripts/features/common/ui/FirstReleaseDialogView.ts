import { _decorator, Button, Color, Graphics, Label, Node, Sprite, UITransform } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;
export interface DialogOptions {
    title: string; body: string; primary?: string; secondary?: string; primaryAction?: string; secondaryAction?: string;
    settings?: { music: boolean; sound: boolean; vibration: boolean; language: string };
    rewards?: { coins: number; hints: number };
    closable?: boolean;
}
@ccclass('FirstReleaseDialogView')
export class FirstReleaseDialogView extends BaseView {
    @property(Graphics) public shadeGraphics: Graphics | null = null;
    @property(Label) public titleLabel: Label | null = null;
    @property(Label) public bodyLabel: Label | null = null;
    @property(Label) public primaryLabel: Label | null = null;
    @property(Label) public secondaryLabel: Label | null = null;
    @property(Button) public primaryButton: Button | null = null;
    @property(Button) public secondaryButton: Button | null = null;
    @property(Button) public closeButton: Button | null = null;
    @property(Node) public closeArtCover: Node | null = null;
    @property(Node) public settingsRoot: Node | null = null;
    @property(Node) public rewardsRoot: Node | null = null;
    @property(Label) public rewardCoinsLabel: Label | null = null;
    @property(Label) public rewardHintsLabel: Label | null = null;
    @property(Sprite) public rewardCoinsIcon: Sprite | null = null;
    @property(Sprite) public rewardHintsIcon: Sprite | null = null;
    @property([Label]) public settingLabels: Label[] = [];
    private options: DialogOptions = { title: '', body: '' };
    public validateBindings(): void {
        super.validateBindings();
        for (const key of ['shadeGraphics','titleLabel','bodyLabel','primaryLabel','secondaryLabel','primaryButton','secondaryButton','closeButton','settingsRoot','rewardsRoot','rewardCoinsLabel','rewardHintsLabel','rewardCoinsIcon','rewardHintsIcon'] as const)
            requireBinding('FirstReleaseDialogView', key, this[key]);
        if (this.settingLabels.length !== 4) throw new Error('FirstReleaseDialogView: four settings labels required');
    }
    protected onShown(): void {
        const graphics = this.shadeGraphics!, ui = graphics.node.getComponent(UITransform)!;
        graphics.clear(); graphics.fillColor = new Color(8, 26, 36, 175);
        graphics.rect(-ui.width / 2, -ui.height / 2, ui.width, ui.height); graphics.fill();
    }
    public configure(options: DialogOptions): void {
        this.options = options; this.titleLabel!.string = options.title; this.bodyLabel!.string = options.body;
        this.primaryLabel!.string = options.primary ?? '确定'; this.secondaryLabel!.string = options.secondary ?? '';
        this.secondaryButton!.node.active = !!options.secondary;
        this.closeButton!.node.active = options.closable !== false;
        requireBinding('FirstReleaseDialogView','closeArtCover',this.closeArtCover).active = options.closable === false;
        this.rewardsRoot!.active = !!options.rewards;
        this.rewardCoinsLabel!.string = String(options.rewards?.coins ?? 0);
        this.rewardHintsLabel!.string = String(options.rewards?.hints ?? 0);
        this.bodyLabel!.node.setPosition(0, options.rewards ? 130 : 75, 0);
        this.bodyLabel!.getComponent(UITransform)!.setContentSize(580, options.rewards ? 180 : 440);
        this.settingsRoot!.active = !!options.settings; this.bodyLabel!.node.active = !options.settings;
        if (options.settings) {
            const settings = options.settings;
            this.settingLabels[0].string = settings.music ? '开启' : '关闭';
            this.settingLabels[1].string = settings.sound ? '开启' : '关闭';
            this.settingLabels[2].string = settings.vibration ? '开启' : '关闭';
            this.settingLabels[3].string = settings.language === 'zh-CN' ? '简体中文' : settings.language;
        }
    }
    public onDialogAction(_event?: unknown, action = ''): void {
        if (this.options.closable === false && action !== 'primary') return;
        const mapped = action === 'primary' ? this.options.primaryAction ?? 'dialog:close'
            : action === 'secondary' ? this.options.secondaryAction ?? 'dialog:close' : action;
        this.node.emit('view-action', { actionId: mapped, view: this });
    }
    public getTarget(id: string): Node | null { return id === 'result.home' || id === 'welcome.claim' ? this.primaryButton!.node : null; }
}
