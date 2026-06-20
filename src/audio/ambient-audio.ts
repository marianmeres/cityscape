/**
 * The ambient audio adapter — a WebAudio synth that *listens* to the simulation's
 * {@link AmbientEventBus} and renders sound. No audio assets: a low drone pad plus short
 * synthesised cues (a distant horn, a gust of wind, a low rumble, a faint chime). Muted by
 * default; nothing is created until enabled, and a user gesture resumes the context (browser
 * autoplay policy). This is the *only* audio code — the sim stays DOM-free and silent.
 *
 * @module
 */

import type { AmbientEvent, AmbientEventBus } from "../cityscape/events.ts";

/** Synthesised, asset-free ambient sound driven by {@link AmbientEvent}s. */
export class AmbientAudio {
	#bus: AmbientEventBus;
	#unsub: () => void;
	#ctx: AudioContext | null = null;
	#master: GainNode | null = null;
	#droneGain: GainNode | null = null;
	#noise: AudioBuffer | null = null;
	#enabled = false;
	#volume = 0.5;

	constructor(bus: AmbientEventBus) {
		this.#bus = bus;
		this.#unsub = bus.on((e) => this.#cue(e));
	}

	/** Enable/disable sound. Enabling lazily builds the audio graph + drone. */
	setEnabled(on: boolean): void {
		this.#enabled = on;
		if (on) {
			this.#ensure();
			this.#ctx?.resume().catch(() => {});
		}
		this.#applyGain();
	}

	/** Master volume `0..1`. */
	setVolume(v: number): void {
		this.#volume = Math.max(0, Math.min(1, v));
		this.#applyGain();
	}

	/** Resume the audio context (call from a user gesture). */
	resume(): void {
		this.#ctx?.resume().catch(() => {});
	}

	/** Tear down listeners and the audio graph. */
	destroy(): void {
		this.#unsub();
		this.#ctx?.close().catch(() => {});
		this.#ctx = null;
	}

	#applyGain(): void {
		if (!this.#master || !this.#ctx) return;
		const target = this.#enabled ? this.#volume : 0;
		const now = this.#ctx.currentTime;
		this.#master.gain.cancelScheduledValues(now);
		this.#master.gain.setTargetAtTime(target, now, 0.4);
	}

	#ensure(): void {
		if (this.#ctx) return;
		const Ctx = globalThis.AudioContext ??
			(globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!Ctx) return;
		const ctx = new Ctx();
		this.#ctx = ctx;
		this.#master = ctx.createGain();
		this.#master.gain.value = 0;
		this.#master.connect(ctx.destination);

		// Pre-render a second of white noise for wind cues.
		const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		this.#noise = buf;

		this.#startDrone();
		this.#applyGain();
	}

	/** A calm, slowly-modulated drone pad — a few detuned low oscillators through a lowpass. */
	#startDrone(): void {
		const ctx = this.#ctx!;
		const drone = ctx.createGain();
		drone.gain.value = 0.16;
		this.#droneGain = drone;

		const lp = ctx.createBiquadFilter();
		lp.type = "lowpass";
		lp.frequency.value = 420;
		lp.Q.value = 0.7;
		drone.connect(lp).connect(this.#master!);

		for (const f of [55, 82.5, 110]) {
			const osc = ctx.createOscillator();
			osc.type = "sine";
			osc.frequency.value = f;
			osc.detune.value = (Math.random() - 0.5) * 8;
			const g = ctx.createGain();
			g.gain.value = 0.5;
			osc.connect(g).connect(drone);
			osc.start();
		}

		// Slow LFO breathing the filter cutoff so the pad never sits still.
		const lfo = ctx.createOscillator();
		lfo.frequency.value = 0.05;
		const lfoGain = ctx.createGain();
		lfoGain.gain.value = 140;
		lfo.connect(lfoGain).connect(lp.frequency);
		lfo.start();
	}

	#cue(e: AmbientEvent): void {
		if (!this.#enabled || !this.#ctx || !this.#master) return;
		const ctx = this.#ctx;
		const pan = ctx.createStereoPanner();
		pan.pan.value = Math.max(-1, Math.min(1, e.pan));
		pan.connect(this.#master);
		switch (e.type) {
			case "horn":
				return this.#horn(ctx, pan, e.intensity);
			case "wind":
				return this.#wind(ctx, pan, e.intensity);
			case "rumble":
				return this.#rumble(ctx, pan, e.intensity);
			case "chime":
				return this.#chime(ctx, pan, e.intensity);
		}
	}

	#horn(ctx: AudioContext, out: AudioNode, intensity: number): void {
		const now = ctx.currentTime;
		const g = ctx.createGain();
		const lp = ctx.createBiquadFilter();
		lp.type = "lowpass";
		lp.frequency.value = 1200;
		g.connect(lp).connect(out);
		const peak = 0.12 * intensity;
		g.gain.setValueAtTime(0, now);
		g.gain.linearRampToValueAtTime(peak, now + 0.06);
		g.gain.setValueAtTime(peak, now + 0.5);
		g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
		for (const f of [277, 350]) {
			const o = ctx.createOscillator();
			o.type = "sawtooth";
			o.frequency.value = f;
			o.connect(g);
			o.start(now);
			o.stop(now + 1.15);
		}
	}

	#wind(ctx: AudioContext, out: AudioNode, intensity: number): void {
		if (!this.#noise) return;
		const now = ctx.currentTime;
		const src = ctx.createBufferSource();
		src.buffer = this.#noise;
		src.loop = true;
		const bp = ctx.createBiquadFilter();
		bp.type = "bandpass";
		bp.frequency.value = 520;
		bp.Q.value = 0.8;
		const g = ctx.createGain();
		src.connect(bp).connect(g).connect(out);
		const peak = 0.09 * intensity;
		const dur = 3.2;
		g.gain.setValueAtTime(0, now);
		g.gain.linearRampToValueAtTime(peak, now + 1.0);
		g.gain.linearRampToValueAtTime(0, now + dur);
		bp.frequency.setValueAtTime(420, now);
		bp.frequency.linearRampToValueAtTime(760, now + dur);
		src.start(now);
		src.stop(now + dur + 0.1);
	}

	#rumble(ctx: AudioContext, out: AudioNode, intensity: number): void {
		const now = ctx.currentTime;
		const o = ctx.createOscillator();
		o.type = "sine";
		o.frequency.value = 42;
		const g = ctx.createGain();
		o.connect(g).connect(out);
		const peak = 0.14 * intensity;
		g.gain.setValueAtTime(0, now);
		g.gain.linearRampToValueAtTime(peak, now + 0.5);
		g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
		o.start(now);
		o.stop(now + 2.5);
	}

	#chime(ctx: AudioContext, out: AudioNode, intensity: number): void {
		const now = ctx.currentTime;
		for (const [f, t] of [[880, 0], [1320, 0.04]] as const) {
			const o = ctx.createOscillator();
			o.type = "sine";
			o.frequency.value = f;
			const g = ctx.createGain();
			o.connect(g).connect(out);
			const peak = 0.06 * intensity;
			g.gain.setValueAtTime(0, now + t);
			g.gain.linearRampToValueAtTime(peak, now + t + 0.01);
			g.gain.exponentialRampToValueAtTime(0.0001, now + t + 1.6);
			o.start(now + t);
			o.stop(now + t + 1.7);
		}
	}
}
