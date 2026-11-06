import { _decorator } from 'cc';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { claimTask, dailyRules, startDay, taskClaimed, tasksOf } from '../../domain/Daily';
import { services } from '../../Services';
import { today } from '../../Today';
import { SigninPage } from './SigninPage';
import { TaskRow } from './TaskRow';
import { WeeklyPage } from './WeeklyPage';

const { ccclass, property } = _decorator;

/** 每日三任务与周目标、签到入口（T29-01，F041）。 */
@ccclass('TasksPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/TasksPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class TasksPage extends ViewBase {
    @property([TaskRow]) rows: TaskRow[] = [];

    private readonly onSave = (): void => this.render();

    protected onOpen(): void {
        this.rows.forEach((row, i) => { row.onClaimTask = () => claimTask(services.save, today(), i); });
    }

    protected setInfo(): void {
        services.save.transact(draft => startDay(draft, today()));
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    onWeekly(_event: unknown, _data: string): void {
        void services.ui.open(WeeklyPage);
    }

    onSignin(_event: unknown, _data: string): void {
        void services.ui.open(SigninPage);
    }

    onMap(_event: unknown, _data: string): void {
        this.close();
    }

    private render(): void {
        const day = today();
        const rules = dailyRules().tasks;
        tasksOf(services.save.data, day).forEach((task, i) => {
            const rule = rules[task.kind];
            this.rows[i].show({ titleKey: rule.titleKey, progress: task.progress, target: rule.target, honey: rule.honey,
                claimed: taskClaimed(services.save.data, day, i) });
        });
    }
}
