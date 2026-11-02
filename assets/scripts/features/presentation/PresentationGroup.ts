import { _decorator, Component, Node } from 'cc';
import { requireBinding } from '../../framework/components/Binding';
import type { ResourceScope } from '../../framework/resources/ResourceScope';
import { CorePresentation, CorePresentationData } from './CorePresentation';
const { ccclass, property } = _decorator;

/** Refreshes the active layout's values and data-driven item instances. */
@ccclass('PresentationGroup')
export class PresentationGroup extends Component {
    @property([CorePresentation]) public layouts: CorePresentation[] = [];

    public async present(scope: ResourceScope, overrides: CorePresentationData = {}, excludedMounts: readonly Node[] = []): Promise<void> {
        if (scope.isReleased) throw new Error('PresentationGroup: borrowed resource scope is released');
        const seen = new Set<CorePresentation>();
        for (let i = 0; i < this.layouts.length; i++) {
            const layout = requireBinding('PresentationGroup', `layouts[${i}]`, this.layouts[i]);
            if (seen.has(layout)) throw new Error('PresentationGroup: duplicate layout binding');
            seen.add(layout);
        }
        await Promise.all(this.layouts.filter(layout => layout.enabled && layout.node.activeInHierarchy).map(layout => layout.present(scope, overrides, excludedMounts)));
    }
}
