import { Component, Node, UITransform, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** 设置开关行：开 / 关底图切换，滑块在底槽右端（开）或左端（关）。行 id 来自 Prefab 的 customEventData。 */
@ccclass('SettingRow')
export class SettingRow extends Component {
    @property(Node) baseOn: Node = null!;
    @property(Node) baseOff: Node = null!;
    @property(Node) knob: Node = null!;

    onToggled: (id: string) => void = () => {};
    private onX = 0;
    private offX = 0;

    /** The prefab places the knob in the "on" position; "off" mirrors its margin at the left end of the base. */
    onLoad(): void {
        const base = this.baseOn.getComponent(UITransform)!.width, knob = this.knob.getComponent(UITransform)!.width;
        const baseX = this.baseOn.position.x;
        this.onX = this.knob.position.x;
        const margin = baseX + base / 2 - (this.onX + knob / 2);
        this.offX = baseX - base / 2 + margin + knob / 2;
    }

    show(on: boolean): void {
        this.baseOn.active = on;
        this.baseOff.active = !on;
        this.knob.setPosition(on ? this.onX : this.offX, this.knob.position.y);
    }

    onToggle(_event: unknown, data: string): void {
        this.onToggled(data);
    }
}
