import { Component, Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';

const { ccclass, property } = _decorator;

/** Component on groups of SigninPage. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('SigninCell')
export class SigninCell extends Component {
    @property([Sprite]) states: Sprite[] = [];
    @property(LocalizedLabel) dayLabel: LocalizedLabel = null!;
    @property(Label) honeyLabel: Label = null!;
    @property(Node) hint: Node = null!;
    @property(Label) hintLabel: Label = null!;
    @property(Node) check: Node = null!;
    @property(LocalizedLabel) stateLabel: LocalizedLabel = null!;

}
