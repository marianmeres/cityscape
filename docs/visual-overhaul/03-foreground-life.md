<!--
GENERATED ANALYSIS — @marianmeres/cityscape · visual overhaul
Produced 2026-06-20 by inline scout → verify pass over the codebase.
Claims verified against the codebase at commit 5997d8f. Planning artifact; no code was changed.
-->

# Foreground Life — stylized headlight/taillight streaks

> The nearest band today is the shore promenade and its warm lamps
> ([shore.ts:83](../../src/cityscape/sky/shore.ts#L83)). Everything that _moves_ is sky-scale
> (drifting windows, birds, the moon) — there's no sign of human-scale life near the camera. The
> chosen treatment (over literal cars/people, which break the calm at this zoom) is **moving
> light**: sparse warm headlights + red taillights gliding along a near road, mirrored on the
> water. It reuses `glow`/`circle`/`line`/`rect` — **no new primitive** — and follows the existing
> sparse-director ethos exactly ([flyer.ts](../../src/cityscape/sky/flyer.ts)): one normalized
> `progress` per crosser, no per-particle bookkeeping.

## Summary of recommendations

| # | Recommendation                                                 | Value | Effort | Risk |
| - | -------------------------------------------------------------- | ----- | ------ | ---- |
| 1 | A near road/embankment anchor (foreground layer)               | high  | S–M    | low  |
| 2 | `TrafficDirector`: sparse head/tail-light crossers on the road | high  | M      | low  |
| 3 | Streak reflections on the water                                | med   | S      | low  |
| 4 | (Optional) tiny figures near shore lamps                       | low   | S      | med  |

## Findings & recommendations (detailed)

### 1. Road anchor

- **Observation** — light streaks need something to travel _on_, or they float. The skyline already
  layers cleanly: sky (0) → buildings (0.6–0.92) → birds (0.94) → water (1) → shore (1.1)
  ([skyline.ts:42–88](../../src/cityscape/generation/skyline.ts#L42)).
- **Proposed change** — add a foreground layer (`depth ≈ 1.15`, in front of shore) drawing a near
  **waterfront road**: a thin dark band with a faint center line at a fixed screen-y near the
  shoreline. v1 is a simple road; a **bridge** crossing the water is a more dramatic variant left
  for later (it gives an elevated, isolated light-line and pairs with a landmark).
- **Affected files** — new `src/cityscape/foreground/road.ts`;
  [skyline.ts](../../src/cityscape/generation/skyline.ts) (add the layer);
  [config.ts](../../src/cityscape/config.ts) (maybe a `roadVisible`/`trafficChance` knob).
- **Effort S–M / Value high / Risk low** — purely additive; an entity like `Shore`.

### 2. `TrafficDirector`

- **Proposed change** — model on [FlyerDirector](../../src/cityscape/sky/flyer.ts): schedule at
  most a handful of vehicles at once, cadence shortening as `trafficChance` rises. Each vehicle is
  a warm headlight `glow` + `circle` (leading) and a dimmer red taillight (trailing), plus a faint
  body, animated by one `progress` across the road. Direction/speed vary; lights are the subject,
  the body is barely there at night.
- **Affected files** — new `src/cityscape/foreground/traffic.ts`;
  [skyline.ts](../../src/cityscape/generation/skyline.ts); [config.ts](../../src/cityscape/config.ts)
  (`trafficChance`, group `Sky` or a new `Life`).
- **Effort M / Value high / Risk low** — deterministic via `rng.fork`; sparse and quiet by design.
- **Implementation notes** — warm headlight ≈ the shore `LAMP` tone
  ([shore.ts:26](../../src/cityscape/sky/shore.ts#L26)); taillight a desaturated red. Keep counts
  low — a calm trickle, not a freeway.

### 3. Streak reflections

- **Proposed change** — when the road sits at the waterfront, echo each streak as a wavy vertical
  smear on the water, reusing the lamp-reflection idiom already in
  [shore.ts:123](../../src/cityscape/sky/shore.ts#L123) and
  [water.ts:79](../../src/cityscape/sky/water.ts#L79).
- **Effort S / Value med / Risk low**.

### 4. (Optional) pedestrians

- A few static-ish 1–2px figures by the existing shore lamps. **Low value at this scale, mood
  risk** (can read as noise). Recommend deferring or dropping; listed for completeness.

## Open questions / decisions needed

- **Anchor** — waterfront road (recommended v1) vs a bridge (more dramatic, later) vs extending the
  shore promenade itself?
- **Landlocked stretches** — does the road persist through the countryside biome (a lonely highway
  with rare headlights — lovely) or only appear at the waterfront? Recommend a road that exists
  regardless, so traffic has continuity across the biome journey (depends on doc 02).
- **Pedestrians** — include the tiny figures or drop them? Recommend drop for v1.
