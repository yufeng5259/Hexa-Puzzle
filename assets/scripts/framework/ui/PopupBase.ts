import { _decorator, Node } from 'cc';
import { ViewBase } from './ViewBase';

const { ccclass, property } = _decorator;

/** BigHero PopupView: Root / Backdrop / Content, bound in the prefab (no children[] index access). */
@ccclass('PopupBase')
export class PopupBase<A = void> extends ViewBase<A> {
    @property(Node) backdrop: Node = null!;
    @property(Node) content: Node = null!;
}
