import { Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { depart } from '../../domain/Garden';
import { services } from '../../Services';
import { today } from '../../Today';
import { StoryPopup } from '../collection/StoryPopup';

const { ccclass, property } = _decorator;

/** 下一主题（T17-01 清风水湾 / T17-02 云上蜂谷，F027）：免费出发，新园五栋从 0 级开始。 */
@ccclass('NextThemePopup')
@uiView({ bundle: 'garden', path: 'prefabs/popups/NextThemePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class NextThemePopup extends PopupBase {
    @property(LocalizedLabel) themeNameLabel: LocalizedLabel = null!;
    @property(Sprite) preview: Sprite = null!;
    /** Index = next chapter − 1 (0 = water, 1 = cloud). */
    @property([SpriteFrame]) previewFrames: SpriteFrame[] = [];

    protected setInfo(): void {
        const next = services.save.data.garden.chapter + 1;
        this.themeNameLabel.setKey('hg.garden.theme.' + services.config.garden.themes[next]);
        this.preview.spriteFrame = this.previewFrames[next - 1];
    }

    /** Depart re-checks the reward receipt and the expected chapter, so a double tap moves only once. */
    onGo(_event: unknown, _data: string): void {
        const chapter = services.save.data.garden.chapter;
        const next = services.save.transact(draft => depart(draft, services.config.garden, chapter, today()));
        this.close();
        // F027: the chapter story follows the departure; closing it returns to the new garden.
        void services.ui.open(StoryPopup, { storyId: 'chapter.' + next });
    }

    onHome(_event: unknown, _data: string): void {
        this.close();
    }
}
