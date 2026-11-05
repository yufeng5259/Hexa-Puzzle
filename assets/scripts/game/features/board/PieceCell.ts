import { Component, Sprite, SpriteFrame, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** 拼块单格（对象池）. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('PieceCell')
export class PieceCell extends Component {
    @property(Sprite) body: Sprite = null!;
    @property([SpriteFrame]) frames: SpriteFrame[] = [];

}
