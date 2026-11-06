import { JsonAsset } from 'cc';
import { AudioConfig } from '../framework/audio/AudioService';
import { ClickSound } from '../framework/audio/ClickSound';
import { SaveData } from './save/SaveData';
import { services } from './Services';

/** Claims that are not player-visible rewards (their own screens play win / harvest sounds). */
const SILENT_CLAIMS = ['settle:', 'endless:', 'ad:'];

/**
 * Audio points (F047): button clicks, page music, popup opens, claims and honey arrival.
 * Called once by LoadingPage after the save exists.
 */
export async function startAudio(): Promise<void> {
    const config = await services.res.load('common', 'config/audio', JsonAsset);
    const audio = services.audio;
    audio.configure(config.json as AudioConfig);
    ClickSound.player = key => audio.play(key);
    const applySettings = (save: Readonly<SaveData>): void => audio.setEnabled(save.settings.music, save.settings.sfx);
    applySettings(services.save.data);
    services.save.subscribe(true, applySettings);
    services.save.onClaimed(true, key => { if (!SILENT_CLAIMS.some(p => key.startsWith(p))) audio.play('claim'); });
    services.ui.onViewShown = view => {
        if (view.meta.bgm) audio.playMusic(view.meta.bgm);
        else if (view.meta.transition === 'scale') audio.play('popup');
    };
    const current = services.ui.top(0);
    if (current?.meta.bgm) audio.playMusic(current.meta.bgm);
}

/** Light haptic on piece placement when the player has vibration on. */
export function placeFeedback(): void {
    services.audio.play('place');
    if (services.save.data.settings.vibrate) services.platform.vibrate('light');
}
