import { Label, Node, Sprite, _decorator } from 'cc';
import { HexBoard } from '../board/HexBoard';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

/** 无尽模式局内：37 格三轴消除. Generated skeleton; structure in docs/开发方案/Prefab结构.md. */
@ccclass('EndlessPage')
@uiView({ bundle: 'endless', path: 'prefabs/pages/EndlessPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class EndlessPage extends ViewBase {
    @property(Label) scoreLabel: Label = null!;
    @property(Label) bestLabel: Label = null!;
    @property(HexBoard) board: HexBoard = null!;
    @property(Node) comboRoot: Node = null!;
    @property([Sprite]) comboWords: Sprite[] = [];
    @property(Label) gainLabel: Label = null!;
    @property(Node) undoButton: Node = null!;
    @property(Label) undoCountLabel: Label = null!;
    @property([Node]) traySlots: Node[] = [];

    onRecords(_event: unknown, _data: string): void {
        throw new Error('EndlessPage.onRecords not implemented');
    }

    onSupply(_event: unknown, _data: string): void {
        throw new Error('EndlessPage.onSupply not implemented');
    }

    onUndo(_event: unknown, _data: string): void {
        throw new Error('EndlessPage.onUndo not implemented');
    }

    onPause(_event: unknown, _data: string): void {
        throw new Error('EndlessPage.onPause not implemented');
    }

    onHelp(_event: unknown, _data: string): void {
        throw new Error('EndlessPage.onHelp not implemented');
    }

    onHarvest(_event: unknown, _data: string): void {
        throw new Error('EndlessPage.onHarvest not implemented');
    }
}
