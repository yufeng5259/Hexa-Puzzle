import { Component, Label, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { reachableLevel } from '../../domain/Mainline';
import { SaveData } from '../../save/SaveData';
import { services } from '../../Services';
import { pop, stopFx } from '../../fx/Fx';
import { CompanionListPage } from '../collection/CompanionListPage';
import { SettingsPopup } from './SettingsPopup';

const { ccclass, property } = _decorator;

/** 顶部 HUD：主线可玩关号、花蜜、提示；随存档提交刷新（F019）。每个页面各有一份，挂在 Hud 节点上。 */
@ccclass('TopHud')
export class TopHud extends Component {
    @property(LocalizedLabel) levelLabel: LocalizedLabel = null!;
    @property(Label) honeyLabel: Label = null!;
    @property(Label) hintLabel: Label = null!;

    /** Enabled HUDs, most recently shown last: effects target the HUD the player is looking at. */
    private static readonly shown: TopHud[] = [];
    private shownHoney = -1;
    private readonly onSave = (data: Readonly<SaveData>): void => this.render(data);

    static current(): TopHud | null {
        return TopHud.shown[TopHud.shown.length - 1] ?? null;
    }

    onEnable(): void {
        TopHud.shown.push(this);
        this.shownHoney = -1;
        services.save.subscribe(true, this.onSave);
        this.render(services.save.data);
    }

    onDisable(): void {
        TopHud.shown.splice(TopHud.shown.indexOf(this), 1);
        services.save.subscribe(false, this.onSave);
        stopFx(this.honeyLabel.node);
    }

    onAvatar(_event: unknown, _data: string): void {
        void services.ui.open(CompanionListPage);
    }

    onSettings(_event: unknown, _data: string): void {
        void services.ui.open(SettingsPopup);
    }

    private render(data: Readonly<SaveData>): void {
        this.levelLabel.setParams({ level: reachableLevel(data, services.config.mainline) });
        this.honeyLabel.string = String(data.wallet.honey);
        // Honey arriving while this HUD is on screen: coin sound and a pop on the counter.
        if (this.shownHoney >= 0 && data.wallet.honey > this.shownHoney && TopHud.current() === this) {
            services.audio.play('coin');
            pop(this.honeyLabel.node, 1.25);
        }
        this.shownHoney = data.wallet.honey;
        this.hintLabel.string = String(data.wallet.hints);
    }
}
