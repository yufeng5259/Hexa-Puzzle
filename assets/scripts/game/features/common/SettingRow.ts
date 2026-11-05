import { Component, Node, _decorator } from 'cc';

const { ccclass, property } = _decorator;

/** Component on groups of SettingsPopup. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('SettingRow')
export class SettingRow extends Component {
    @property(Node) baseOn: Node = null!;
    @property(Node) baseOff: Node = null!;
    @property(Node) knob: Node = null!;

    onToggle(_event: unknown, _data: string): void {
        throw new Error('SettingRow.onToggle not implemented');
    }
}
