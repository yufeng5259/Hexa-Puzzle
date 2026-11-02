import { _decorator, Component, director, Director, instantiate, isValid, Node, Prefab } from 'cc';
import { requireBinding } from '../components/Binding';
import type { ResourceScope } from '../resources/ResourceScope';
import { BaseView } from './BaseView';
const { ccclass, property } = _decorator;
export type ViewLayer = 'page' | 'dialog' | 'guide';

/** Uses existing serialized layer nodes; this host never constructs UI hierarchy. */
@ccclass('ViewHost')
export class ViewHost extends Component {
    @property(Node) public pageLayer: Node | null = null;
    @property(Node) public dialogLayer: Node | null = null;
    @property(Node) public guideLayer: Node | null = null;
    private readonly views = new Set<BaseView>();
    public onLoad(): void {
        requireBinding('ViewHost', 'pageLayer', this.pageLayer);
        requireBinding('ViewHost', 'dialogLayer', this.dialogLayer);
        requireBinding('ViewHost', 'guideLayer', this.guideLayer);
    }
    public open(prefab: Prefab, layer: ViewLayer = 'page', scope?: ResourceScope): BaseView {
        let node: Node | null = null;
        try {
            if (!isValid(this, true) || !this.views) throw new Error('Cannot open a view on a destroyed ViewHost');
            requireBinding('ViewHost', 'prefab', prefab);
            const parent = requireBinding('ViewHost', `${layer}Layer`, this.layer(layer));
            node = instantiate(prefab);
            // Attach ownership and validate before entering an active hierarchy.
            node.active = false;
            const view = requireBinding('ViewHost', 'Prefab BaseView', node.getComponent(BaseView));
            if (scope) view.attachResourceScope(scope);
            view.validateBindings();
            node.parent = parent;
            const views = this.views;
            views.add(view);
            node.once(Node.EventType.NODE_DESTROYED, () => views.delete(view));
            view.show();
            return view;
        } catch (error) {
            if (node) {
                node.destroy();
                if (scope) director.once(Director.EVENT_AFTER_UPDATE, () => scope.release());
            } else scope?.release();
            throw error;
        }
    }
    public closeAll(): void {
        // A sibling's onDestroy may call after Cocos has destructed this component.
        const views = this.views;
        if (!views) return;
        for (const view of views) if (isValid(view, true)) view.close();
        views.clear();
    }
    public onDestroy(): void { this.closeAll(); }
    private layer(layer: ViewLayer): Node | null {
        if (layer === 'page') return this.pageLayer;
        if (layer === 'dialog') return this.dialogLayer;
        if (layer === 'guide') return this.guideLayer;
        throw new Error(`Unknown view layer: ${layer}`);
    }
}
