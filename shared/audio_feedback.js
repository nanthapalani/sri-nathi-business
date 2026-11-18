// ==========================================================================
// SRI NATHI ENTERPRISE - REAL-TIME WEB AUDIO API CHIME SYNTHESIZER
// Lightweight audio synthesizer for alerts, KDS order chimes, and test tones
// ==========================================================================

class SystemAudioFeedback {
  constructor() {
    this.audioCtx = null;
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Play a pleasant double-tone notification chime
  playChimeTone() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // Tone 1: High Bell Note (880 Hz - A5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Tone 2: Harmonic Harmony Note (1318.5 Hz - E6)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, now + 0.12);
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.5);

      console.log("[Audio Feedback] Played notification chime tone.");
    } catch (e) {
      console.warn("[Audio Feedback] Audio playback fallback notice:", e.message);
    }
  }
}

window.systemAudioFeedback = new SystemAudioFeedback();
