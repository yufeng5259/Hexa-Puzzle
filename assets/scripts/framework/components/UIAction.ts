import { _decorator, Component, EventHandler } from 'cc';
const { ccclass, property } = _decorator;

export interface UIActionEvent { actionId: string; source: UIAction; customEventData: string }

/** Serialized button target; business behavior is supplied by the composition layer later. */
@ccclass('UIAction')
export class UIAction extends Component {
    @property public actionId = '';
    @property([EventHandler]) public handlers: EventHandler[] = [];
    public onClick(_event?: unknown, customEventData = ''): void {
        if (!this.actionId) throw new Error('UIAction requires actionId');
        const payload: UIActionEvent = { actionId: this.actionId, source: this, customEventData };
        this.node.emit('ui-action', payload);
        EventHandler.emitEvents(this.handlers, payload);
    }
}
