import { Component, Node, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** 地图侧栏入口：图标、文字、红点。入口 id 来自 Prefab 的 customEventData，点击回调由 MapPage 设置。 */
@ccclass('MapEntry')
export class MapEntry extends Component {
    @property(Node) redDot: Node = null!;

    onOpen: (id: string) => void = () => {};

    onClick(_event: unknown, data: string): void {
        this.onOpen(data);
    }
}
