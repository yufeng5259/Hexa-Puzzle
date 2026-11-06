import { Component, Label, Node, Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { SigninRule } from '../../domain/Daily';

const { ccclass, property } = _decorator;

export type SigninCellState = 'claimable' | 'claimed' | 'waiting';
const STATES: SigninCellState[] = ['claimable', 'claimed', 'waiting'];
const STATE_KEYS: Record<SigninCellState, string> = {
    claimable: 'hg.daily.signin_claimable', claimed: 'hg.daily.signin_claimed', waiting: 'hg.daily.signin_waiting',
};

/** 七日礼物格：states[] 依次为 可领 / 已领 / 未到 的底图（第 7 天为大礼盒 / 野餐帽 / 大礼盒）。 */
@ccclass('SigninCell')
export class SigninCell extends Component {
    @property([Sprite]) states: Sprite[] = [];
    @property(LocalizedLabel) dayLabel: LocalizedLabel = null!;
    @property(Label) honeyLabel: Label = null!;
    @property(Node) hint: Node = null!;
    @property(Label) hintLabel: Label = null!;
    @property(Node) check: Node = null!;
    @property(LocalizedLabel) stateLabel: LocalizedLabel = null!;

    show(day: number, rule: SigninRule, state: SigninCellState): void {
        this.states.forEach((sprite, i) => { sprite.node.active = STATES[i] === state; });
        this.dayLabel.setParams({ count: day });
        this.honeyLabel.string = '+' + rule.honey;
        this.hint.active = !!rule.hints;
        if (rule.hints) this.hintLabel.string = '+' + rule.hints;
        this.check.active = state === 'claimed';
        this.stateLabel.setKey(STATE_KEYS[state]);
    }
}
