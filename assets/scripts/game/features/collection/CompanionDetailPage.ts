import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { ViewBase } from '../../../framework/ui/ViewBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { collectionConfig, showArt } from '../../CollectionConfig';
import { affinityOf, follow, isCompanionOpen } from '../../domain/Collection';
import { services } from '../../Services';
import { Toast } from '../common/Toast';
import { TasksPage } from '../daily/TasksPage';
import { AffinityNode } from './AffinityNode';
import { CompanionDecorPopup } from './CompanionDecorPopup';
import { StoryPopup } from './StoryPopup';

const { ccclass, property } = _decorator;

export interface CompanionDetailArgs { bee: string; }

/** 蜂友成长（F036）：亲密 x/30、5 招手 / 15 故事 / 30 专属装饰、设为跟随。 */
@ccclass('CompanionDetailPage')
@uiView({ bundle: 'meta', path: 'prefabs/pages/CompanionDetailPage', layer: UILayer.Page, queue: UIQueue.Page, transition: 'fade' })
export class CompanionDetailPage extends ViewBase<CompanionDetailArgs> {
    @property(LocalizedLabel) subtitleLabel: LocalizedLabel = null!;
    @property(Sprite) portrait: Sprite = null!;
    @property(LocalizedLabel) nameLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) affinityLabel: LocalizedLabel = null!;
    @property(Sprite) affinityFill: Sprite = null!;
    @property([AffinityNode]) milestones: AffinityNode[] = [];
    @property(LocalizedLabel) followLabel: LocalizedLabel = null!;

    /** Prefab-authored keys: milestone 0 shows the reached text, milestone 1 the locked template; follow button "正在跟随". */
    private doneKey = '';
    private lockedKey = '';
    private followingKey = '';
    private readonly onSave = (): void => this.render();

    protected onOpen(): void {
        this.doneKey = this.milestones[0].conditionLabel.key;
        this.lockedKey = this.milestones[1].conditionLabel.key;
        this.followingKey = this.followLabel.key;
        this.milestones.forEach((node, i) => { node.onPick = () => this.pick(i); });
    }

    protected setInfo(): void {
        const cfg = collectionConfig();
        const bee = cfg.companions.find(c => c.id === this.args.bee)!;
        if (!isCompanionOpen(services.save.data, cfg, bee.id)) throw new Error('Companion not open: ' + bee.id);
        this.nameLabel.setKey(bee.nameKey);
        this.subtitleLabel.setParams({ value_1: '+' + cfg.affinity.perTask, value_2: cfg.affinity.dailyMax });
        void showArt(this, this.portrait, bee.portrait);
        this.render();
    }

    protected changeListener(enabled: boolean): void {
        services.save.subscribe(enabled, this.onSave);
    }

    onFollow(_event: unknown, _data: string): void {
        if (services.save.data.collection.follow === this.args.bee) return;
        services.save.transact(draft => follow(draft, collectionConfig(), this.args.bee));
    }

    onTasks(_event: unknown, _data: string): void {
        void services.ui.open(TasksPage);
    }

    private pick(index: number): void {
        const cfg = collectionConfig();
        const milestone = cfg.affinity.milestones[index];
        const bee = cfg.companions.find(c => c.id === this.args.bee)!;
        if (affinityOf(services.save.data, bee.id) < milestone) {
            Toast.show('hg.collection.milestone_locked', { count: milestone });
            return;
        }
        if (index === 0) Toast.show('hg.collection.wave', { name: services.i18n.t(bee.nameKey) });
        else if (index === 1) void services.ui.open(StoryPopup, { storyId: 'bee.' + bee.id });
        else void services.ui.open(CompanionDecorPopup, { bee: bee.id });
    }

    private render(): void {
        const cfg = collectionConfig();
        const save = services.save.data;
        const affinity = affinityOf(save, this.args.bee);
        this.affinityLabel.setParams({ value_1: affinity, value_2: cfg.affinity.max });
        this.affinityFill.fillRange = affinity / cfg.affinity.max;
        this.milestones.forEach((node, i) => {
            const m = cfg.affinity.milestones[i];
            node.show(affinity >= m, this.doneKey, this.lockedKey, m);
        });
        this.followLabel.setKey(save.collection.follow === this.args.bee ? this.followingKey : 'hg.collection.set_follow');
    }
}
