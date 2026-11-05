import { Label, Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 限步失败救局（拼图局之上）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('ChallengeFailPopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/ChallengeFailPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class ChallengeFailPopup extends PopupBase {
    @property(Label) remainLabel: Label = null!;
    @property(Node) adButton: Node = null!;
    @property(LocalizedLabel) adLabel: LocalizedLabel = null!;

    onRetry(_event: unknown, _data: string): void {
        throw new Error('ChallengeFailPopup.onRetry not implemented');
    }

    onContinueAd(_event: unknown, _data: string): void {
        throw new Error('ChallengeFailPopup.onContinueAd not implemented');
    }

    onMap(_event: unknown, _data: string): void {
        throw new Error('ChallengeFailPopup.onMap not implemented');
    }
}
