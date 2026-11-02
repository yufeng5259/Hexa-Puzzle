import { _decorator, EventTouch, isValid } from 'cc';
import { BaseView } from '../../../framework/ui/BaseView';
import { requireBinding } from '../../../framework/components/Binding';
import type { ResourceScope } from '../../../framework/resources/ResourceScope';
import type { LevelCatalog } from '../../puzzle/data/LevelCatalog';
import { MainlineMapPresentation } from '../presentation/MainlineMapPresentation';
const { ccclass, property } = _decorator;

/** Single map page with explicitly bound level presentation and serialized buttons. */
@ccclass('MainlineMapPageView')
export class MainlineMapPageView extends BaseView {
    @property(MainlineMapPresentation) public presentation: MainlineMapPresentation | null = null;

    public validateBindings(): void {
        const presentation = requireBinding('MainlineMapPageView', 'presentation', this.presentation);
        requireBinding('MainlineMapPageView', 'presentation.layout', presentation.layout);
        requireBinding('MainlineMapPageView', 'presentation.pageLabel', presentation.pageLabel);
        requireBinding('MainlineMapPageView', 'presentation.previousButton', presentation.previousButton);
        requireBinding('MainlineMapPageView', 'presentation.nextButton', presentation.nextButton);
        requireBinding('MainlineMapPageView', 'presentation.actionTarget', presentation.actionTarget);
    }

    public async render(scope: ResourceScope, catalog: LevelCatalog, page: number, fixture = false): Promise<void> {
        if (!isValid(this, true) || this.isClosed) return;
        const presentation = requireBinding('MainlineMapPageView', 'presentation', this.presentation);
        if (fixture) await requireBinding('MainlineMapPageView', 'presentation.layout', presentation.layout).present(scope);
        else await presentation.present(scope, catalog, page);
    }

    public onAction(_event?: EventTouch, actionId = ''): void {
        this.node.emit('view-action', { actionId, view: this });
    }
}
