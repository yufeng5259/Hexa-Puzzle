import { _decorator, Component, Label } from 'cc';
import { I18n, TextParams } from './I18n';

const { ccclass, property, requireComponent } = _decorator;

/** BigHero LocalizedNode as a resident component: renders `key` with params and follows language changes. */
@ccclass('LocalizedLabel')
@requireComponent(Label)
export class LocalizedLabel extends Component {
    @property key = '';
    private params: TextParams | undefined;

    setParams(params: TextParams): void {
        this.params = params;
        this.render();
    }

    setKey(key: string, params?: TextParams): void {
        this.key = key;
        this.params = params;
        this.render();
    }

    onEnable(): void {
        I18n.current.onChanged(true, this.render, this);
        this.render();
    }

    onDisable(): void {
        I18n.current.onChanged(false, this.render, this);
    }

    private render(): void {
        if (!this.key) return;
        this.getComponent(Label)!.string = I18n.current.t(this.key, this.params);
    }
}
