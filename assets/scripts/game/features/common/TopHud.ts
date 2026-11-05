import { Component, Label, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { reachableLevel } from '../../domain/Mainline';
import { SaveData } from '../../save/SaveData';
import { services } from '../../Services';
import { CompanionListPage } from '../collection/CompanionListPage';
import { SettingsPopup } from './SettingsPopup';

const { ccclass, property } = _decorator;

/** 顶部 HUD：主线可玩关号、花蜜、提示；随存档提交刷新（F019）。每个页面各有一份，挂在 Hud 节点上。 */
@ccclass('TopHud')
export class TopHud extends Component {
    @property(LocalizedLabel) levelLabel: LocalizedLabel = null!;
    @property(Label) honeyLabel: Label = null!;
    @property(Label) hintLabel: Label = null!;

    private readonly onSave = (data: Readonly<SaveData>): void => this.render(data);

    onEnable(): void {
        services.save.subscribe(true, this.onSave);
        this.render(services.save.data);
    }

    onDisable(): void {
        services.save.subscribe(false, this.onSave);
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
        this.hintLabel.string = String(data.wallet.hints);
    }
}
