import { _decorator } from 'cc';
import { TaskRow } from './TaskRow';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 每日奖励：三任务与周目标、七日礼物入口. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('TasksPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/TasksPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class TasksPage extends ViewBase {
    @property([TaskRow]) rows: TaskRow[] = [];

    onWeekly(_event: unknown, _data: string): void {
        throw new Error('TasksPage.onWeekly not implemented');
    }

    onSignin(_event: unknown, _data: string): void {
        throw new Error('TasksPage.onSignin not implemented');
    }

    onMap(_event: unknown, _data: string): void {
        throw new Error('TasksPage.onMap not implemented');
    }
}
