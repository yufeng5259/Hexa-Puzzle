import { _decorator, Component, Label } from 'cc';
import { requireBinding } from '../../../framework/components/Binding';
const { ccclass, property } = _decorator;

@ccclass('EnergyHud')
export class EnergyHud extends Component {
    @property(Label) public amountLabel: Label | null = null;
    @property(Label) public timerLabel: Label | null = null;
    public setEnergy(energy: number, maximum: number, seconds: number): void {
        requireBinding('EnergyHud', 'amountLabel', this.amountLabel).string = String(energy);
        const remaining = Math.max(0, Math.ceil(seconds));
        requireBinding('EnergyHud', 'timerLabel', this.timerLabel).string = energy >= maximum ? 'FULL'
            : `${Math.floor(remaining / 60)}:${('0' + String(remaining % 60)).slice(-2)}`;
    }
}
