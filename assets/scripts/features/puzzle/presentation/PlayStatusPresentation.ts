import { _decorator, Button, CCString, Component, Label, Node } from 'cc';
import type { PuzzleSessionSnapshot } from '../session/PuzzleSession';
const { ccclass, property } = _decorator;

/** Authored text slots for the current, non-persistent play batch. No reward authority. */
@ccclass('PlayStatusPresentation')
export class PlayStatusPresentation extends Component {
    @property(CCString) public kind = '';
    @property([Label]) public labels: Label[] = [];
    @property([CCString]) public keys: string[] = [];
    @property([Button]) public unavailableButtons: Button[] = [];
    @property([Node]) public unavailableNodes: Node[] = [];

    public present(snapshot: PuzzleSessionSnapshot | null, mainlineNumber?: number | null): void {
        if (this.labels.length !== this.keys.length || this.labels.some(label => !label))
            throw new Error('PlayStatusPresentation: incomplete authored text bindings');
        const complete = snapshot?.status === 'completed';
        const values: Record<string, string> = {
            honey: '—', inventory: '—', playerLevel: '试玩', amount: '+0', history: '未记录历史成绩',
            preview: '玩法试玩 · 本次不保存或发放奖励',
            pauseMessage: '摆放保留至本次运行结束', exitCaption: '返回主界面',
            exitMessage: '本次运行内可继续\n关闭程序后不保留',
            restartMessage: '清空本次摆放与步数\n重新开始这一关',
            resultTitle: complete ? '拼图完成' : '结算样式预览',
            resultMessage: complete ? '已完成拼图 · 本次未发放奖励' : '演示数据 · 尚未发放奖励',
            level: mainlineNumber ? `第 ${mainlineNumber} 关` : snapshot ? snapshot.levelId : '',
            failNumber: String(snapshot?.moves || 0), failUnit: '步已使用',
            failMessage: '步数已用完，可免费重试或返回',
            next: mainlineNumber === 96 ? '返回地图' : '下一关',
            unavailableAd: '广告暂未接入', localSave: '尚未接入存档',
        };
        this.labels.forEach((label, index) => {
            const key = this.keys[index];
            if (!(key in values)) throw new Error('PlayStatusPresentation: unknown text slot ' + key);
            label.string = values[key];
        });
        this.unavailableButtons.forEach(button => { button.interactable = false; });
        this.unavailableNodes.forEach(node => { node.active = false; });
    }
}
