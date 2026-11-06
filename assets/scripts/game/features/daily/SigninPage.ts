import { Node, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { claimSignin, dailyRules, signinClaimedCount, startDay } from '../../domain/Daily';
import { services } from '../../Services';
import { today } from '../../Today';
import { SigninCell } from './SigninCell';

const { ccclass, property } = _decorator;

/** 七日累计签到礼物（T32-01，F043）：每个新登录日多一格可领，按顺序领取，漏签不回退。 */
@ccclass('SigninPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/SigninPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class SigninPage extends ViewBase {
    @property([SigninCell]) days: SigninCell[] = [];
    @property(Node) claimButton: Node = null!;
    @property(LocalizedLabel) noteLabel: LocalizedLabel = null!;

    private readonly onSave = (): void => this.render();

    protected setInfo(): void {
        services.save.transact(draft => startDay(draft, today()));
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    onClaim(_event: unknown, _data: string): void {
        claimSignin(services.save, today());
    }

    private render(): void {
        const rules = dailyRules().signin;
        const claimed = signinClaimedCount(services.save.data);
        const reachable = services.save.data.daily.signinDays;
        this.days.forEach((cell, i) => {
            cell.show(i + 1, rules[i], i < claimed ? 'claimed' : i < reachable ? 'claimable' : 'waiting');
        });
        this.claimButton.active = claimed < reachable;
        this.noteLabel.setParams({ count: rules.length });
    }
}
