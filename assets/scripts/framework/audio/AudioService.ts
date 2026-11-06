import { AudioClip, AudioSource } from 'cc';
import { debugLog } from '../Log';
import { ResLoader } from '../res/ResLoader';

/** Clip paths inside the audio bundle by key; an empty path means the sound is not made yet (silent). */
export interface AudioConfig {
    bgm: Record<string, string>;
    sfx: Record<string, string>;
}

const BUNDLE = 'audio';

/**
 * BigHero AudioService on 3.x: one AudioSource plays the looping BGM, sound effects use playOneShot on it.
 * Clips load lazily from the audio bundle on first use. Unknown keys are programming errors and throw.
 */
export class AudioService {
    private config: AudioConfig = { bgm: {}, sfx: {} };
    private readonly clips = new Map<string, Promise<AudioClip>>();
    private musicKey: string | null = null;
    private musicOn = true;
    private sfxOn = true;

    constructor(private readonly source: AudioSource, private readonly loader: ResLoader) {}

    configure(config: AudioConfig): void {
        this.config = config;
    }

    /** Player settings (F047): turning music off stops the BGM, turning it on resumes the current page's BGM. */
    setEnabled(music: boolean, sfx: boolean): void {
        this.sfxOn = sfx;
        if (music === this.musicOn) return;
        this.musicOn = music;
        if (!music) this.source.stop();
        else if (this.musicKey) this.startMusic(this.musicKey);
    }

    playMusic(key: string): void {
        if (key === this.musicKey && this.source.playing) return;
        this.musicKey = key;
        if (this.musicOn) this.startMusic(key);
    }

    stopMusic(): void {
        this.musicKey = null;
        this.source.stop();
    }

    play(key: string): void {
        const path = this.path(this.config.sfx, 'sfx', key);
        if (!this.sfxOn || !path) return;
        void this.clip(path).then(clip => { if (this.sfxOn) this.source.playOneShot(clip); });
    }

    private startMusic(key: string): void {
        const path = this.path(this.config.bgm, 'bgm', key);
        this.source.stop();
        if (!path) return;
        void this.clip(path).then(clip => {
            if (this.musicKey !== key || !this.musicOn) return;
            this.source.clip = clip;
            this.source.loop = true;
            this.source.play();
        });
    }

    private path(table: Record<string, string>, kind: string, key: string): string {
        const path = table[key];
        if (path === undefined) throw new Error(`Unknown ${kind} key: ${key}`);
        return path;
    }

    private clip(path: string): Promise<AudioClip> {
        let pending = this.clips.get(path);
        if (!pending) {
            debugLog('Audio', 'load', path);
            pending = this.loader.load(BUNDLE, path, AudioClip).then(clip => { clip.addRef(); return clip; });
            this.clips.set(path, pending);
        }
        return pending;
    }
}
