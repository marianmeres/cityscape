/**
 * Tiny WebAudio feedback for the shapes puzzle — a short click when a piece snaps in and a
 * two-note chime when the figure is solved. Synthesised (no assets), muteable, and created lazily
 * on the first user gesture so it respects autoplay policy. Browser-only (lives in the audio layer,
 * outside the pure core).
 *
 * @module
 */

/** A minimal click/chime synth for placement feedback. */
export class ShapesAudio {
	#ctx: AudioContext | null = null;
	#muted: boolean;

	constructor(muted = false) {
		this.#muted = muted;
	}

	/** Whether sound is currently muted. */
	get muted(): boolean {
		return this.#muted;
	}

	/** Mute / unmute. */
	setMuted(muted: boolean): void {
		this.#muted = muted;
	}

	/** Create/resume the audio context — call from a user gesture (click, pointerdown). */
	resume(): void {
		try {
			this.#ctx ??= new AudioContext();
			if (this.#ctx.state === "suspended") void this.#ctx.resume();
		} catch {
			// No WebAudio available — feedback is silently skipped.
		}
	}

	/** A short, soft click for a piece snapping into place. */
	click(): void {
		this.#blip(620, 0.05, 0.16, "triangle");
	}

	/** A small rising two-note chime when the figure is completed. */
	solved(): void {
		this.#blip(523.25, 0.16, 0.18, "sine", 0); // C5
		this.#blip(783.99, 0.22, 0.18, "sine", 0.09); // G5
	}

	/** Release the audio context. */
	destroy(): void {
		try {
			void this.#ctx?.close();
		} catch {
			// ignore
		}
		this.#ctx = null;
	}

	#blip(
		freq: number,
		dur: number,
		peak: number,
		type: OscillatorType,
		delay = 0,
	): void {
		if (this.#muted) return;
		this.resume();
		const ctx = this.#ctx;
		if (!ctx) return;
		const t0 = ctx.currentTime + delay;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(0.0001, t0);
		gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
		gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		osc.connect(gain).connect(ctx.destination);
		osc.start(t0);
		osc.stop(t0 + dur + 0.02);
	}
}
