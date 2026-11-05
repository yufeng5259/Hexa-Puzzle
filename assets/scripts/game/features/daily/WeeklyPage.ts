import { Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 每周目标：活跃日、局数进度与周礼. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('WeeklyPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/WeeklyPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class WeeklyPage extends ViewBase {
    @property([Sprite]) dayChecks: Sprite[] = [];
    @property([Label]) dayLabels: Label[] = [];
    @property(LocalizedLabel) progressLabel: LocalizedLabel = null!;
    @property(Sprite) progressFill: Sprite = null!;
    @property(Label) rewardLabel: Label = null!;
    @property(Node) stamp: Node = null!;
    @property(Node) claimButton: Node = null!;
    @property(Node) claimedMark: Node = null!;

    onClaim(_event: unknown, _data: string): void {
        throw new Error('WeeklyPage.onClaim not implemented');
    }
}
