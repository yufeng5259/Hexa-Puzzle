import { Node, _decorator } from 'cc';
import { SigninCell } from './SigninCell';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 七日礼物：累计签到. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('SigninPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/SigninPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class SigninPage extends ViewBase {
    @property([SigninCell]) days: SigninCell[] = [];
    @property(Node) claimButton: Node = null!;

    onClaim(_event: unknown, _data: string): void {
        throw new Error('SigninPage.onClaim not implemented');
    }
}
