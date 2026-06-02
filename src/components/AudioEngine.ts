/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class ReactorAudioEngine {
  private ctx: AudioContext | null = null;
  private coreHumNode: OscillatorNode | null = null;
  private coreHumGain: GainNode | null = null;
  private gearClickInterval: number | null = null;
  private alarmOscillator: OscillatorNode | null = null;
  private alarmGain: GainNode | null = null;
  private lastRpm = 0;
  private isSoundOn = false;

  constructor() {
    // Lazy init
  }

  toggleSound(on: boolean) {
    this.isSoundOn = on;
    if (on) {
      this.initContext();
      this.startCoreHum();
    } else {
      this.stopAllSounds();
    }
  }

  private initContext() {
    if (!this.ctx) {
      // Create context safely
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // High-fidelity mechanical click
  playClick() {
    if (!this.isSoundOn || !this.ctx) return;
    this.initContext();
    const now = this.ctx.currentTime;
    
    // Quick high frequency click followed by a wood block-style plop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Mechanical switch snap
  playSnap() {
    if (!this.isSoundOn || !this.ctx) return;
    this.initContext();
    const now = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(200, now);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.1);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.16);
    osc2.stop(now + 0.16);
  }

  // Continuous deep hum mimicking Nuclear Fission and water coolant vibrations
  private startCoreHum() {
    if (!this.ctx || this.coreHumNode) return;
    const now = this.ctx.currentTime;
    
    // Core oscillator (sub-bass hum)
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, now); // A1 note
    
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(27.5, now); // A0 deep sub
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(110, now);
    
    gain.gain.setValueAtTime(0.03, now);
    
    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    subOsc.start(now);
    
    this.coreHumNode = osc;
    this.coreHumGain = gain;
  }

  // Adjust deep atomic hum pitch based on current core temperature & fission rate!
  updateCoreHum(fissionRate: number, temp: number) {
    if (!this.isSoundOn || !this.ctx || !this.coreHumNode || !this.coreHumGain) return;
    
    const now = this.ctx.currentTime;
    // Fission rate scales core frequency up (e.g. 55Hz to 110Hz or 150Hz)
    const targetFreq = 50 + (fissionRate * 0.8) + (temp * 0.05);
    this.coreHumNode.frequency.setTargetAtTime(targetFreq, now, 0.1);
    
    // Gain scales on temperature & activity (more active = louder bubble sound)
    const targetGain = 0.02 + (fissionRate * 0.0003);
    this.coreHumGain.gain.setTargetAtTime(Math.min(targetGain, 0.12), now, 0.2);
  }

  // Periodic ticking / whirring sound representing mechanical gear spinning
  updateGearSounds(rpm: number) {
    this.lastRpm = rpm;
    if (!this.isSoundOn || !this.ctx) {
      this.clearGearInterval();
      return;
    }
    
    if (rpm < 50) {
      this.clearGearInterval();
      return;
    }
    
    // Calculate tick rate based on RPM (higher RPM = faster ticking)
    const intervalMs = Math.max(30, 800 - (rpm / 4.5));
    
    if (this.gearClickInterval) {
      // Don't restart if already running at a close rate
      return;
    }
    
    const tick = () => {
      if (!this.isSoundOn || !this.ctx || this.lastRpm < 50) {
        this.clearGearInterval();
        return;
      }
      
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      // Pitch goes up slightly with high RPM to sound like a whirring turbine gear
      osc.frequency.setValueAtTime(320 + (this.lastRpm * 0.05), now);
      
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
      
      // Reschedule next tick based on current real-time RPM
      const currentInterval = Math.max(30, 800 - (this.lastRpm / 4.5));
      this.gearClickInterval = window.setTimeout(tick, currentInterval);
    };
    
    this.gearClickInterval = window.setTimeout(tick, intervalMs);
  }

  private clearGearInterval() {
    if (this.gearClickInterval) {
      clearTimeout(this.gearClickInterval);
      this.gearClickInterval = null;
    }
  }

  // Meltdown Alert Pulsating Alarm Sound
  setAlarmActive(active: boolean) {
    if (!this.isSoundOn || !this.ctx) {
      this.stopAlarm();
      return;
    }
    
    if (active) {
      if (this.alarmOscillator) return; // already active
      const now = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      
      gain.gain.setValueAtTime(0, now);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      
      this.alarmOscillator = osc;
      this.alarmGain = gain;
      this.pulsateAlarm();
    } else {
      this.stopAlarm();
    }
  }

  private pulsateAlarm() {
    if (!this.alarmOscillator || !this.alarmGain || !this.ctx || !this.isSoundOn) return;
    
    const now = this.ctx.currentTime;
    // Oscillate pitch from 350 to 700 Hz
    this.alarmOscillator.frequency.cancelScheduledValues(now);
    this.alarmOscillator.frequency.setValueAtTime(350, now);
    this.alarmOscillator.frequency.linearRampToValueAtTime(700, now + 0.3);
    this.alarmOscillator.frequency.linearRampToValueAtTime(350, now + 0.6);
    
    // Pulsate volume
    this.alarmGain.gain.cancelScheduledValues(now);
    this.alarmGain.gain.setValueAtTime(0, now);
    this.alarmGain.gain.linearRampToValueAtTime(0.04, now + 0.1);
    this.alarmGain.gain.linearRampToValueAtTime(0.04, now + 0.3);
    this.alarmGain.gain.linearRampToValueAtTime(0, now + 0.6);
    
    // Keep pulsating recursively
    setTimeout(() => {
      this.pulsateAlarm();
    }, 600);
  }

  private stopAlarm() {
    if (this.alarmOscillator) {
      try {
        this.alarmOscillator.stop();
      } catch (e) {}
      this.alarmOscillator = null;
    }
    this.alarmGain = null;
  }

  // Emergency SCRAM steam release sound effect + mechanical gear slide
  playScramSound() {
    if (!this.isSoundOn || !this.ctx) return;
    this.initContext();
    const now = this.ctx.currentTime;
    
    // Generate steam noise (white noise approximation using random oscillator modulation or very fast sweeps)
    // Here we sweep sine/triangle frequencies incredibly fast with high master volume to reproduce a heavy jet of steam
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, now);
    osc.frequency.linearRampToValueAtTime(10, now + 1.2);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(100, now + 1.2);
    filter.Q.setValueAtTime(1, now);
    
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 1.3);
  }

  // Epic chord progression when the reactor starts safely or builds successfully!
  playEpicChords() {
    if (!this.isSoundOn || !this.ctx) return;
    this.initContext();
    const now = this.ctx.currentTime;
    
    // Play G Major & C Major celebratory arpeggios simulating victory music!
    const notes = [130.81, 164.81, 196.00, 261.63, 329.63, 392.00, 523.25]; // C chord notes
    notes.forEach((freq, idx) => {
      const noteDelay = idx * 0.08;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + noteDelay);
      
      gain.gain.setValueAtTime(0, now + noteDelay);
      gain.gain.linearRampToValueAtTime(0.08, now + noteDelay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + noteDelay + 0.5);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + noteDelay);
      osc.stop(now + noteDelay + 0.6);
    });
  }

  private stopAllSounds() {
    this.clearGearInterval();
    this.stopAlarm();
    if (this.coreHumNode) {
      try {
        this.coreHumNode.stop();
      } catch (e) {}
      this.coreHumNode = null;
    }
    this.coreHumGain = null;
  }
}

export const reactorAudio = new ReactorAudioEngine();
