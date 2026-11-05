import { Node, _decorator } from 'cc';
import { PopupBase } from '../../../framework/ui/PopupBase';
import { UILayer, UIQueue } from '../../../framework/ui/UILayer';
import { uiView } from '../../../framework/ui/uiView';

const { ccclass, property } = _decorator;

export type HelpArticle = 'puzzle' | 'endless' | 'build';
const ARTICLES: HelpArticle[] = ['puzzle', 'endless', 'build'];

export interface HelpArgs {
    /** Open straight into an article (from the puzzle, endless or garden page); otherwise the catalog. */
    article?: HelpArticle;
}

/** 图示帮助（T40-01 目录 + T40-02/03/04 三篇，F046）。 */
@ccclass('HelpPopup')
@uiView({ bundle: 'common', path: 'prefabs/popups/HelpPopup', layer: UILayer.Popup, queue: UIQueue.Popup, transition: 'scale' })
export class HelpPopup extends PopupBase<HelpArgs> {
    @property(Node) catalog: Node = null!;
    @property([Node]) articles: Node[] = [];

    protected setInfo(): void {
        this.show(this.args?.article ?? null);
    }

    onOpenArticle(_event: unknown, data: string): void {
        this.show(data as HelpArticle);
    }

    /** "我来试试": back to the page the help was opened from. */
    onTry(_event: unknown, _data: string): void {
        this.close();
    }

    onCatalog(_event: unknown, _data: string): void {
        this.show(null);
    }

    private show(article: HelpArticle | null): void {
        this.catalog.active = article === null;
        this.articles.forEach((node, i) => { node.active = ARTICLES[i] === article; });
    }
}
