import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { showArt, storyConfig } from '../../CollectionConfig';
import { isStoryOpen, markStoryRead } from '../../domain/Collection';
import { isJourneyComplete } from '../../domain/Garden';
import { services } from '../../Services';

const { ccclass, property } = _decorator;

export interface StoryArgs { storyId: string; }

/**
 * 章节剧情 / 蜂友故事（F037）：三步文字与配图来自 story.json；只记录已读，不发奖。
 * 章节剧情主按钮「继续」，蜂友故事主按钮「回蜂友成长」；两者都只关闭本弹窗回到来源。
 */
@ccclass('StoryPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/StoryPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class StoryPopup extends PopupBase<StoryArgs> {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) subtitleLabel: LocalizedLabel = null!;
    @property(Sprite) image: Sprite = null!;
    @property([Sprite]) stepIcons: Sprite[] = [];
    @property([LocalizedLabel]) stepLabels: LocalizedLabel[] = [];
    @property(LocalizedLabel) continueLabel: LocalizedLabel = null!;

    /** Prefab-authored keys of the companion variant (subtitle "亲密{count}解锁", button "回蜂友成长"). */
    private companionSubtitleKey = '';
    private companionButtonKey = '';

    protected onOpen(): void {
        this.companionSubtitleKey = this.subtitleLabel.key;
        this.companionButtonKey = this.continueLabel.key;
    }

    protected setInfo(): void {
        const story = storyConfig().stories.find(s => s.id === this.args.storyId);
        if (!story) throw new Error('Unknown story ' + this.args.storyId);
        const save = services.save.data;
        if (!isStoryOpen(save, story, isJourneyComplete(save, services.config.garden))) throw new Error('Story not unlocked: ' + story.id);
        this.titleLabel.setKey(story.titleKey);
        story.steps.forEach((key, i) => this.stepLabels[i].setKey(key));
        const chapter = story.kind === 'chapter';
        if (chapter) this.subtitleLabel.setKey('hg.collection.chapter_subtitle');
        else this.subtitleLabel.setKey(this.companionSubtitleKey, { count: story.unlock.affinity! });
        this.continueLabel.setKey(chapter ? 'hg.collection.continue' : this.companionButtonKey);
        void showArt(this, this.image, story.image);
        if (save.collection.storiesRead.indexOf(story.id) < 0) services.save.transact(draft => markStoryRead(draft, story.id));
    }

    onContinue(_event: unknown, _data: string): void {
        this.close();
    }
}
