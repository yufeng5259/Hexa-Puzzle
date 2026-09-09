import { AudioClip, AudioSource, Game, game, Node } from 'cc';
import type { GameSettingsService } from './GameSettingsService';

export class AudioService {
  private readonly musicSource: AudioSource;
  private readonly effectsSource: AudioSource;
  private musicStarted = false;
  private readonly pauseReasons = new Set<'background' | 'advertisement'>();
  private get suspended(): boolean { return this.pauseReasons.size > 0; }

  public constructor(node: Node, music: AudioClip, private readonly win: AudioClip, private readonly settings: GameSettingsService) {
    this.musicSource = node.addComponent(AudioSource);
    this.musicSource.clip = music;
    this.musicSource.loop = true;
    this.musicSource.volume = 0.45;
    this.effectsSource = node.addComponent(AudioSource);
    this.effectsSource.volume = 0.75;
    game.on(Game.EVENT_HIDE, this.pause, this);
    game.on(Game.EVENT_SHOW, this.resume, this);
  }

  public startMusic(): void {
    this.musicStarted = true;
    if (!this.suspended && this.settings.snapshot().musicEnabled && !this.musicSource.playing) this.musicSource.play();
  }

  public applySettings(): void {
    if (!this.settings.snapshot().musicEnabled) this.musicSource.stop();
    else if (this.musicStarted && !this.suspended && !this.musicSource.playing) this.musicSource.play();
  }

  public playWin(): void {
    if (!this.suspended && this.settings.snapshot().effectsEnabled) this.effectsSource.playOneShot(this.win, 0.75);
  }

  private pause(): void {
    this.setPaused('background', true);
  }

  private resume(): void {
    this.setPaused('background', false);
  }

  public setAdCovered(covered: boolean): void { this.setPaused('advertisement', covered); }

  private setPaused(reason: 'background' | 'advertisement', paused: boolean): void {
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    if (this.suspended) {
      if (this.musicSource.playing) this.musicSource.pause();
      this.effectsSource.stop();
    } else this.applySettings();
  }

  public destroy(): void {
    game.off(Game.EVENT_HIDE, this.pause, this);
    game.off(Game.EVENT_SHOW, this.resume, this);
    this.musicSource.stop();
    this.effectsSource.stop();
  }
}
