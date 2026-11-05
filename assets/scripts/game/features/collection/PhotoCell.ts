import { Component, Node, Sprite, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** Component on groups of AlbumPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('PhotoCell')
export class PhotoCell extends Component {
    @property(Sprite) photo: Sprite = null!;
    @property(Node) doneNode: Node = null!;
    @property(Node) pendingNode: Node = null!;
    @property(Node) newNode: Node = null!;

    onSelect(_event: unknown, _data: string): void {
        throw new Error('PhotoCell.onSelect not implemented');
    }
}
