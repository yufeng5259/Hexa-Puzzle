import { Label, Node, Sprite, SpriteFrame, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { chapterStep, claimChapter, gardenProgress, isChapterClaimed } from '../../domain/Garden';
import { services } from '../../Services';
import { today } from '../../Today';
import { JourneyCompletePopup } from './JourneyCompletePopup';
import { NextThemePopup } from './NextThemePopup';

const { ccclass, property } = _decorator;

/** 整园完工奖励（T16-01，F026）：100 花蜜 + 1 提示 + 整园合影，每园一次。 */
@ccclass('ChapterCompletePopup')
@uiView({ bundle: 'garden', path: 'prefabs/popups/ChapterCompletePopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class ChapterCompletePopup extends PopupBase {
    @property(LocalizedLabel) chapterNameLabel: LocalizedLabel = null!;
    @property(Sprite) photo: Sprite = null!;
    @property(Label) honeyLabel: Label = null!;
    @property(Label) hintLabel: Label = null!;
    @property(Node) claimButton: Node = null!;

    /** The prefab photo is the first garden's group photo; later gardens load meta/photos/<theme>_group. */
    private firstPhoto: SpriteFrame | null = null;
    private photoRequest = '';

    protected onOpen(): void {
        this.firstPhoto = this.photo.spriteFrame;
    }

    protected setInfo(): void {
        const save = services.save.data;
        const cfg = services.config.garden;
        const chapter = save.garden.chapter;
        const theme = cfg.themes[chapter];
        const total = cfg.maxLevel * cfg.buildingCount;
        this.chapterNameLabel.setParams({ name: services.i18n.t('hg.garden.theme.' + theme), value_1: gardenProgress(save), value_2: total });
        this.honeyLabel.string = '+' + cfg.chapterReward.honey;
        this.hintLabel.string = '+' + cfg.chapterReward.hints;
        this.claimButton.active = !isChapterClaimed(save, chapter);
        this.showPhoto(chapter, theme);
    }

    onClaim(_event: unknown, _data: string): void {
        claimChapter(services.save, services.config.garden, today());
        const step = chapterStep(services.save.data, services.config.garden);
        this.close();
        if (step === 'next') void services.ui.open(NextThemePopup);
        else if (step === 'journey') void services.ui.open(JourneyCompletePopup);
    }

    /** Close back to the garden; the reward stays claimable from its gift button. */
    onHome(_event: unknown, _data: string): void {
        this.close();
    }

    private showPhoto(chapter: number, theme: string): void {
        if (chapter === 0) {
            this.photoRequest = '';
            this.photo.spriteFrame = this.firstPhoto;
            return;
        }
        const path = `photos/${theme}_group/spriteFrame`;
        this.photoRequest = path;
        void services.res.load('meta', path, SpriteFrame).then(frame => {
            if (!this.isOpened || this.photoRequest !== path) return;
            this.photo.spriteFrame = this.lease.acquire(frame);
        });
    }
}
