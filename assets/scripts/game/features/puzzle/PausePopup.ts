import { _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { startAttempt } from '../../domain/Mainline';
import { services } from '../../Services';
import { ConfirmPopup } from '../common/ConfirmPopup';
import { SettingsPopup } from '../common/SettingsPopup';
import { PuzzlePage } from './PuzzlePage';
import { closePuzzlePage } from './PuzzleNav';

const { ccclass } = _decorator;

export interface PauseArgs { level: number; }

/** 局内暂停（T36-01，F013/F046）：继续、设置、重新开始（T38-01 确认）、保存回主界面（T37-01 确认）。 */
@ccclass('PausePopup')
@uiView({ bundle: 'puzzle', path: 'prefabs/popups/PausePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class PausePopup extends PopupBase<PauseArgs> {
    onResume(_event: unknown, _data: string): void {
        this.close();
    }

    onSettings(_event: unknown, _data: string): void {
        void services.ui.open(SettingsPopup);
    }

    onRestart(_event: unknown, _data: string): void {
        const level = this.args.level;
        ConfirmPopup.ask({
            titleKey: 'block.533290b5cce3.text.065c8903bb20', messageKey: 'block.533290b5cce3.text.c443ef8ffa25',
            confirmKey: 'block.533290b5cce3.text.51c07da06e63', cancelKey: 'block.533290b5cce3.text.ee92c5c44254',
            onConfirm: () => {
                services.save.transact(draft => { startAttempt(draft, level); });
                this.close();
                void services.ui.open(PuzzlePage, { level });
            },
        });
    }

    /** The attempt is already saved after every move; leaving keeps it for resume. */
    onExit(_event: unknown, _data: string): void {
        ConfirmPopup.ask({
            titleKey: 'block.288d0398c71e.text.065c8903bb20', messageKey: 'block.288d0398c71e.text.c443ef8ffa25',
            confirmKey: 'block.288d0398c71e.text.f431d66b83ad', cancelKey: 'block.288d0398c71e.text.ee92c5c44254',
            onConfirm: () => {
                this.close();
                closePuzzlePage();
            },
        });
    }
}
