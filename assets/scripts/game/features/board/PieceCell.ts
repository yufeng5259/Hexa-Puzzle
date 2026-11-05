import { Component, Sprite, SpriteFrame, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** 拼块单格（对象池）：frames 为 5 色 × 无花/落地，下标 color*2 + (landed ? 1 : 0)。 */
@ccclass('PieceCell')
export class PieceCell extends Component {
    @property(Sprite) body: Sprite = null!;
    @property([SpriteFrame]) frames: SpriteFrame[] = [];

    setLook(color: number, landed: boolean): void {
        this.body.spriteFrame = this.frames[color * 2 + (landed ? 1 : 0)];
    }
}
