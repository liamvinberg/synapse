import { audioTuning } from '@/game/config/tuning';

export class GameAudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private running = false;

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.addUnlockListeners();
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.removeUnlockListeners();

    if (this.audioContext !== null) {
      const context = this.audioContext;
      this.audioContext = null;
      this.masterGain = null;
      void context.close();
    }
  }

  private readonly unlockAudio = (): void => {
    void this.ensureContext();
  };

  private async ensureContext(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.audioContext === null) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = audioTuning.masterVolume;
      this.masterGain.connect(this.audioContext.destination);
    }

    await this.audioContext.resume();
  }

  private addUnlockListeners(): void {
    window.addEventListener('keydown', this.unlockAudio, { passive: true });
    window.addEventListener('mousedown', this.unlockAudio, { passive: true });
    window.addEventListener('pointerdown', this.unlockAudio, { passive: true });
    window.addEventListener('touchstart', this.unlockAudio, { passive: true });
  }

  private removeUnlockListeners(): void {
    window.removeEventListener('keydown', this.unlockAudio);
    window.removeEventListener('mousedown', this.unlockAudio);
    window.removeEventListener('pointerdown', this.unlockAudio);
    window.removeEventListener('touchstart', this.unlockAudio);
  }
}

export const gameAudio = new GameAudioEngine();
