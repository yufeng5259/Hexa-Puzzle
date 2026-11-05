import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/** BigHero ItemGridCell: list cell prefab roots extend this and render one data item. */
@ccclass('ItemGridCell')
export class ItemGridCell<T = unknown> extends Component {
    onRefresh(_data: T, _index: number): void {}
}
