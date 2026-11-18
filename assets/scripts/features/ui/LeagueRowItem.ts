import { _decorator, Color, Label, Sprite } from 'cc';
import { VirtualListItem } from '../../framework/ui/VirtualListItem';
const { ccclass, property } = _decorator;

/** What one S26 ranking row shows; paint() loads its pictures (the page owns the frames). */
export interface LeagueRowData {
    readonly rank: number;
    readonly name: string;
    readonly score: string;
    readonly initial: string;
    readonly bg: Color;
    readonly me: boolean;
    /** Loads the avatar / prize pictures; alive() turns false once the row is bound to another value. */
    readonly paint?: (row: LeagueRowItem, alive: () => boolean) => void;
}

/** One ranking row (tools/v2/build-ui.mjs buildLeagueRow): texts set here, pictures through paint(). */
@ccclass('LeagueRowItem')
export class LeagueRowItem extends VirtualListItem {
    @property(Label) public rankLabel: Label | null = null;
    @property(Label) public nameLabel: Label | null = null;
    @property(Label) public scoreLabel: Label | null = null;
    @property(Label) public initialLabel: Label | null = null;
    @property(Sprite) public avatarBg: Sprite | null = null;
    @property(Sprite) public avatarSprite: Sprite | null = null;
    @property(Sprite) public giftSprite: Sprite | null = null;
    @property(Sprite) public rowSprite: Sprite | null = null;
    /** Avatar ring (normal; the page swaps in the "self" ring for the player's row). */
    @property(Sprite) public frameSprite: Sprite | null = null;

    protected onBind(value: unknown): void {
        const row = value as LeagueRowData;
        if (this.rankLabel) this.rankLabel.string = String(row.rank);
        if (this.nameLabel) this.nameLabel.string = row.name;
        if (this.scoreLabel) this.scoreLabel.string = row.score;
        if (this.initialLabel) { this.initialLabel.string = row.initial; this.initialLabel.node.active = true; }
        if (this.avatarBg) this.avatarBg.color = row.bg;
        if (this.avatarSprite) this.avatarSprite.node.active = false;
        if (this.giftSprite) this.giftSprite.node.active = false;
        if (this.rowSprite) this.rowSprite.node.active = !row.me;
        if (this.selectedMarker) this.selectedMarker.active = row.me;
        row.paint?.(this, this.requestIdentity());
    }
}
