/**
 * The naturescape ambient audio adapter — a WebAudio synth that *listens* to the simulation's
 * {@link AmbientEventBus} and renders sound. No audio assets: a soft airy pad plus short
 * synthesised cues (birdsong chirps, a breeze swell, a water trickle, a grass rustle). Muted by
 * default; nothing is created until enabled, and a user gesture resumes the context (browser
 * autoplay policy). This is the *only* audio code for the nature domain — the sim stays DOM-free
 * and silent. Mirrors the cityscape's `AmbientAudio` with a nature voice.
 *
 * @module
 */

import type { AmbientEvent, AmbientEventBus } from "../naturescape/events.ts";

/** Synthesised, asset-free ambient nature sound driven by {@link AmbientEvent}s. */
export class NatureAudio {
	#bus: AmbientEventBus;
	#unsub: () => void;
	#ctx: AudioContext | null = null;
	#master: GainNode | null = null;
	#noise: AudioBuffer | null = null;
	#enabled = false;
	#volume = 0.5;

	constructor(bus: AmbientEventBus) {
		this.#bus = bus;
		this.#unsub = bus.on((e) => this.#cue(e));
	}

	/** Enable/disable sound. Enabling lazily builds the audio graph + pad. */
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

		// Pre-render a second of white noise for breeze/water/rustle cues.
		const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		this.#noise = buf;

		this.#startPad();
		this.#applyGain();
	}

	/** A soft, airy pad — a few high-ish detuned oscillators through a gentle lowpass. */
	#startPad(): void {
		const ctx = this.#ctx!;
		const pad = ctx.createGain();
		pad.gain.value = 0.1;

		const lp = ctx.createBiquadFilter();
		lp.type = "lowpass";
		lp.frequency.value = 900;
		lp.Q.value = 0.6;
		pad.connect(lp).connect(this.#master!);

		for (const f of [196, 261.6, 329.6]) { // a calm G–C–E airiness
			const osc = ctx.createOscillator();
			osc.type = "triangle";
			osc.frequency.value = f;
			osc.detune.value = (Math.random() - 0.5) * 6;
			const g = ctx.createGain();
			g.gain.value = 0.4;
			osc.connect(g).connect(pad);
			osc.start();
		}

		// Slow LFO breathing the cutoff so the pad never sits still.
		const lfo = ctx.createOscillator();
		lfo.frequency.value = 0.06;
		const lfoGain = ctx.createGain();
		lfoGain.gain.value = 220;
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
			case "birdsong":
				return this.#birdsong(ctx, pan, e.intensity);
			case "breeze":
				return this.#breeze(ctx, pan, e.intensity);
			case "water":
				return this.#water(ctx, pan, e.intensity);
			case "rustle":
				return this.#rustle(ctx, pan, e.intensity);
		}
	}

	/** A short two- or three-note chirp with quick pitch sweeps. */
	#birdsong(ctx: AudioContext, out: AudioNode, intensity: number): void {
		const now = ctx.currentTime;
		const notes = 2 + Math.floor(Math.random() * 2);
		for (let i = 0; i < notes; i++) {
			const t = now + i * 0.11;
			const o = ctx.createOscillator();
			o.type = "sine";
			const f0 = 1800 + Math.random() * 1400;
			o.frequency.setValueAtTime(f0, t);
			o.frequency.exponentialRampToValueAtTime(
				f0 * (1.3 + Math.random() * 0.4),
				t + 0.05,
			);
			o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.1);
			const g = ctx.createGain();
			const peak = 0.05 * intensity;
			g.gain.setValueAtTime(0, t);
			g.gain.linearRampToValueAtTime(peak, t + 0.01);
			g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
			o.connect(g).connect(out);
			o.start(t);
			o.stop(t + 0.14);
		}
	}

	/** A soft swell of wind through leaves (bandpass noise rising and falling). */
	#breeze(ctx: AudioContext, out: AudioNode, intensity: number): void {
		if (!this.#noise) return;
		const now = ctx.currentTime;
		const src = ctx.createBufferSource();
		src.buffer = this.#noise;
		src.loop = true;
		const bp = ctx.createBiquadFilter();
		bp.type = "bandpass";
		bp.frequency.value = 720;
		bp.Q.value = 0.7;
		const g = ctx.createGain();
		src.connect(bp).connect(g).connect(out);
		const peak = 0.08 * intensity;
		const dur = 3.6;
		g.gain.setValueAtTime(0, now);
		g.gain.linearRampToValueAtTime(peak, now + 1.2);
		g.gain.linearRampToValueAtTime(0, now + dur);
		bp.frequency.setValueAtTime(560, now);
		bp.frequency.linearRampToValueAtTime(980, now + dur);
		src.start(now);
		src.stop(now + dur + 0.1);
	}

	/** A gentle water trickle — a handful of short high blips through a resonant filter. */
	#water(ctx: AudioContext, out: AudioNode, intensity: number): void {
		const now = ctx.currentTime;
		const drops = 4 + Math.floor(Math.random() * 4);
		for (let i = 0; i < drops; i++) {
			const t = now + i * (0.06 + Math.random() * 0.06);
			const o = ctx.createOscillator();
			o.type = "sine";
			const f = 900 + Math.random() * 900;
			o.frequency.setValueAtTime(f, t);
			o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.04);
			const g = ctx.createGain();
			const peak = 0.04 * intensity;
			g.gain.setValueAtTime(0, t);
			g.gain.linearRampToValueAtTime(peak, t + 0.005);
			g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
			o.connect(g).connect(out);
			o.start(t);
			o.stop(t + 0.1);
		}
	}

	/** A brief grass/leaf rustle (a short, soft burst of high-passed noise). */
	#rustle(ctx: AudioContext, out: AudioNode, intensity: number): void {
		if (!this.#noise) return;
		const now = ctx.currentTime;
		const src = ctx.createBufferSource();
		src.buffer = this.#noise;
		const hp = ctx.createBiquadFilter();
		hp.type = "highpass";
		hp.frequency.value = 2400;
		const g = ctx.createGain();
		src.connect(hp).connect(g).connect(out);
		const peak = 0.05 * intensity;
		g.gain.setValueAtTime(0, now);
		g.gain.linearRampToValueAtTime(peak, now + 0.04);
		g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
		src.start(now);
		src.stop(now + 0.6);
	}
}
