import { Component, Node, Sprite, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** 照片格：已收录（照片 + 勾，可带「新」）/ 待记录。照片图由 AlbumPage 加载。 */
@ccclass('PhotoCell')
export class PhotoCell extends Component {
    @property(Sprite) photo: Sprite = null!;
    @property(Node) doneNode: Node = null!;
    @property(Node) pendingNode: Node = null!;
    @property(Node) newNode: Node = null!;

    onPick: () => void = () => {};

    show(recorded: boolean, isNew: boolean): void {
        this.photo.node.active = this.doneNode.active = recorded;
        this.pendingNode.active = !recorded;
        this.newNode.active = recorded && isNew;
    }

    onSelect(_event: unknown, _data: string): void {
        this.onPick();
    }
}
