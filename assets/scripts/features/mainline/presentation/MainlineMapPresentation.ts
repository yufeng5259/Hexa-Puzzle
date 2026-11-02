import { _decorator, Button, Component, Label, Node } from 'cc';
import { requireBinding } from '../../../framework/components/Binding';
import type { ResourceScope } from '../../../framework/resources/ResourceScope';
import type { LevelCatalog } from '../../puzzle/data/LevelCatalog';
import { CorePresentation } from '../../presentation/CorePresentation';
import { MainlineLevelSelection } from './MainlineLevelSelection';
const { ccclass, property } = _decorator;

/** Eight source-art slots, with explicit paging over the 96 question identities. */
@ccclass('MainlineMapPresentation')
export class MainlineMapPresentation extends Component {
    @property(CorePresentation) public layout: CorePresentation | null = null;
    @property(Label) public pageLabel: Label | null = null;
    @property(Button) public previousButton: Button | null = null;
    @property(Button) public nextButton: Button | null = null;
    @property(Node) public actionTarget: Node | null = null;
    public page = 0;
    private revision = 0;

    public async present(scope: ResourceScope, catalog: LevelCatalog, page: number): Promise<void> {
        if (!Number.isInteger(page) || page < 1 || page > 12) throw new Error('MainlineMapPresentation: invalid page');
        const revision = ++this.revision;
        const layout = requireBinding('MainlineMapPresentation', 'layout', this.layout);
        const label = requireBinding('MainlineMapPresentation', 'pageLabel', this.pageLabel);
        const previous = requireBinding('MainlineMapPresentation', 'previousButton', this.previousButton);
        const next = requireBinding('MainlineMapPresentation', 'nextButton', this.nextButton);
        requireBinding('MainlineMapPresentation', 'actionTarget', this.actionTarget);
        if (layout.itemMounts.length !== 8) throw new Error('MainlineMapPresentation: expected eight level slots');
        const levels = Array.from({ length: 8 }, (_, index) => catalog.getMainline((page - 1) * 8 + index + 1));
        await layout.present(scope, { items: levels.map(level => ({ values: { number: level.mainlineNumber! }, accentAssetIds: [null, null, null] })) });
        if (revision !== this.revision || scope.isReleased || !this.node.activeInHierarchy) return;
        layout.mountedItems.forEach((item, index) => requireBinding('MainlineMapPresentation', `item[${index}].MainlineLevelSelection`,
            item.node.getComponent(MainlineLevelSelection)).configure(levels[index].mainlineNumber!));
        label.string = `${page} / 12`;
        label.node.active = true;
        previous.node.active = true;
        next.node.active = true;
        previous.interactable = page > 1;
        next.interactable = page < 12;
        this.page = page;
    }

    public onDisable(): void { this.revision++; }
}
