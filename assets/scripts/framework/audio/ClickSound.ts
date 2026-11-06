import { _decorator, Button, Component } from 'cc';

const { ccclass, property } = _decorator;

/** Plays a sound when the Button on this node is clicked. Added to every generated button. */
@ccclass('ClickSound')
export class ClickSound extends Component {
    /** Set once by the app before any view opens. */
    static player: ((key: string) => void) | null = null;

    @property key = 'click';

    onEnable(): void {
        this.node.on(Button.EventType.CLICK, this.onClick, this);
    }

    onDisable(): void {
        this.node.off(Button.EventType.CLICK, this.onClick, this);
    }

    private onClick(): void {
        if (!ClickSound.player) throw new Error('ClickSound.player not set');
        ClickSound.player(this.key);
    }
}
