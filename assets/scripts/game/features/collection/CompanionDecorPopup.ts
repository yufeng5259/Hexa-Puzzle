import { Sprite, _decorator } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';
import { collectionConfig, showArt } from '../../CollectionConfig';
import { setDecorWorn } from '../../domain/Collection';
import { services } from '../../Services';

const { ccclass, property } = _decorator;

export interface CompanionDecorArgs { bee: string; }

/** 蜂友专属装饰（亲密 30，F038）：佩戴 / 取下。 */
@ccclass('CompanionDecorPopup')
@uiView({ bundle: 'meta', path: 'prefabs/popups/CompanionDecorPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class CompanionDecorPopup extends PopupBase<CompanionDecorArgs> {
    @property(LocalizedLabel) titleLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) subtitleLabel: LocalizedLabel = null!;
    @property(Sprite) portraitBefore: Sprite = null!;
    @property(Sprite) portraitAfter: Sprite = null!;
    @property(Sprite) decor: Sprite = null!;
    @property(LocalizedLabel) wornLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) descLabel: LocalizedLabel = null!;
    @property(LocalizedLabel) toggleLabel: LocalizedLabel = null!;

    /** Prefab-authored worn-state keys: "已佩戴" and "取下". */
    private wornKey = '';
    private takeOffKey = '';

    protected onOpen(): void {
        this.wornKey = this.wornLabel.key;
        this.takeOffKey = this.toggleLabel.key;
    }

    protected setInfo(): void {
        const cfg = collectionConfig();
        const bee = cfg.companions.find(c => c.id === this.args.bee)!;
        const name = services.i18n.t(bee.nameKey);
        this.titleLabel.setKey('hg.collection.decor_title', { name });
        this.descLabel.setKey('hg.collection.decor_title', { name });
        this.subtitleLabel.setParams({ count: cfg.affinity.milestones[cfg.affinity.milestones.length - 1] });
        void showArt(this, this.portraitBefore, bee.portrait);
        void showArt(this, this.portraitAfter, bee.portrait);
        void showArt(this, this.decor, bee.decor);
        this.render();
    }

    onToggleWear(_event: unknown, _data: string): void {
        const worn = !services.save.data.collection.decorWorn[this.args.bee];
        services.save.transact(draft => setDecorWorn(draft, collectionConfig(), this.args.bee, worn));
        this.render();
    }

    private render(): void {
        const worn = !!services.save.data.collection.decorWorn[this.args.bee];
        this.decor.node.active = worn;
        this.wornLabel.setKey(worn ? this.wornKey : 'block.3775287dfa71.text.a5a0f82fe8d6');
        this.toggleLabel.setKey(worn ? this.takeOffKey : 'hg.collection.put_on');
    }
}
