function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}
function lerp(a, b, t) {
    return a + (b - a) * t;
}
function inverseLerp(a, b, v) {
    return a === b ? 0 : (v - a) / (b - a);
}
function smoothstep(edge0, edge1, x) {
    const t = clamp(inverseLerp(edge0, edge1, x), 0, 1);
    return t * t * (3 - 2 * t);
}
function wrap(v, range) {
    if (range <= 0) return 0;
    return (v % range + range) % range;
}
function cosinePulse(t) {
    return 0.5 - 0.5 * Math.cos(wrap(t, 1) * Math.PI * 2);
}
class FixedStepper {
    stepMs;
    maxSteps;
    elapsed = 0;
    #acc = 0;
    constructor(stepMs = 1000 / 60, maxSteps = 5){
        if (stepMs <= 0) throw new RangeError("stepMs must be > 0");
        this.stepMs = stepMs;
        this.maxSteps = Math.max(1, Math.floor(maxSteps));
    }
    advance(deltaMs, fn) {
        if (!(deltaMs > 0)) return {
            steps: 0,
            alpha: this.#acc / this.stepMs
        };
        this.#acc += deltaMs;
        let steps = 0;
        while(this.#acc >= this.stepMs && steps < this.maxSteps){
            fn(this.stepMs);
            this.elapsed += this.stepMs;
            this.#acc -= this.stepMs;
            steps++;
        }
        if (this.#acc >= this.stepMs) this.#acc = 0;
        return {
            steps,
            alpha: this.#acc / this.stepMs
        };
    }
    reset() {
        this.#acc = 0;
        this.elapsed = 0;
    }
}
class Engine {
    stepper;
    #opts;
    #running = false;
    #last = null;
    #cancel = null;
    #maxFrameDelta;
    constructor(opts){
        this.#opts = opts;
        this.stepper = new FixedStepper(opts.fixedStepMs, opts.maxStepsPerFrame ?? 5);
        this.#maxFrameDelta = opts.maxFrameDeltaMs ?? 250;
    }
    get running() {
        return this.#running;
    }
    start() {
        if (this.#running) return;
        this.#running = true;
        this.#last = null;
        this.#schedule();
    }
    stop() {
        this.#running = false;
        this.#cancel?.();
        this.#cancel = null;
    }
    pause() {
        this.stop();
    }
    resume() {
        if (this.#running) return;
        this.start();
    }
    #schedule() {
        this.#cancel = this.#opts.scheduler(this.#frame);
    }
    #frame = (time)=>{
        if (!this.#running) return;
        if (this.#last == null) this.#last = time;
        const delta = clamp(time - this.#last, 0, this.#maxFrameDelta);
        this.#last = time;
        const { alpha } = this.stepper.advance(delta, this.#opts.step);
        this.#opts.render(alpha);
        this.#schedule();
    };
}
function createPointerState() {
    return {
        x: 0,
        y: 0,
        inside: false,
        down: false
    };
}
function parallaxSway(pointer, viewportWidth, maxPx) {
    if (!pointer.inside || viewportWidth <= 0) return 0;
    const centered = pointer.x / viewportWidth * 2 - 1;
    return clamp(centered, -1, 1) * maxPx;
}
const HASH_KEY = "cfg";
function encodeToHash(obj) {
    return `${HASH_KEY}=${encodeURIComponent(JSON.stringify(obj))}`;
}
function decodeFromHash(hash) {
    if (!hash) return null;
    const clean = hash.replace(/^#/, "");
    for (const part of clean.split("&")){
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        if (part.slice(0, eq) !== HASH_KEY) continue;
        try {
            const parsed = JSON.parse(decodeURIComponent(part.slice(eq + 1)));
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch  {
            return null;
        }
    }
    return null;
}
const navy = {
    name: "navy",
    label: "Navy night",
    warm: {
        skyTop: "#0a1030",
        skyMid: "#141d44",
        skyBottom: "#26305f",
        horizonGlow: "#3a4a86",
        buildingFar: "#2b376b",
        buildingNear: "#0a1026",
        window: "#ffd9a0",
        moon: "#eef2ff",
        star: "#dfe8ff"
    },
    cool: {
        skyTop: "#05070f",
        skyMid: "#0a1022",
        skyBottom: "#121a3c",
        horizonGlow: "#1d2a55",
        buildingFar: "#1b2450",
        buildingNear: "#060912",
        window: "#bfe0ff",
        moon: "#eaf0ff",
        star: "#cfe0ff"
    }
};
const vaporwave = {
    name: "vaporwave",
    label: "Vaporwave",
    warm: {
        skyTop: "#241544",
        skyMid: "#3c1f63",
        skyBottom: "#7a3a86",
        horizonGlow: "#ff7ab0",
        buildingFar: "#3a2a5e",
        buildingNear: "#160a26",
        window: "#ff9ad5",
        moon: "#ffb6d5",
        star: "#ffd6f0"
    },
    cool: {
        skyTop: "#160d33",
        skyMid: "#241552",
        skyBottom: "#42206e",
        horizonGlow: "#9a4ad0",
        buildingFar: "#281d4a",
        buildingNear: "#0c0618",
        window: "#7af0ff",
        moon: "#d8b6ff",
        star: "#bfe0ff"
    }
};
const ink = {
    name: "ink",
    label: "Ink",
    warm: {
        skyTop: "#06080e",
        skyMid: "#0b0f1a",
        skyBottom: "#161d28",
        horizonGlow: "#27313f",
        buildingFar: "#1a212d",
        buildingNear: "#04060a",
        window: "#e8d6b4",
        moon: "#f2f5fa",
        star: "#ffffff"
    },
    cool: {
        skyTop: "#04050a",
        skyMid: "#080b13",
        skyBottom: "#10151e",
        horizonGlow: "#1c242f",
        buildingFar: "#141a24",
        buildingNear: "#020308",
        window: "#cdd8e6",
        moon: "#eef2f8",
        star: "#eaf2ff"
    }
};
const dawn = {
    name: "dawn",
    label: "Pre-dawn",
    warm: {
        skyTop: "#0c1a2c",
        skyMid: "#1a3450",
        skyBottom: "#b67a4e",
        horizonGlow: "#e6a35c",
        buildingFar: "#244257",
        buildingNear: "#081420",
        window: "#ffe0b0",
        moon: "#fff0d6",
        star: "#dff0ff"
    },
    cool: {
        skyTop: "#08121f",
        skyMid: "#102536",
        skyBottom: "#2a516e",
        horizonGlow: "#4f7ea0",
        buildingFar: "#1a3346",
        buildingNear: "#050d16",
        window: "#bfe0ff",
        moon: "#eaf4ff",
        star: "#cfe6ff"
    }
};
const PALETTES = {
    navy,
    vaporwave,
    ink,
    dawn
};
const PALETTE_NAMES = [
    "navy",
    "vaporwave",
    "ink",
    "dawn"
];
function getPalette(name) {
    return PALETTES[name] ?? navy;
}
const CONFIG_SCHEMA = [
    {
        key: "cameraSpeed",
        label: "Speed",
        group: "Camera",
        type: "range",
        min: 0,
        max: 120,
        step: 1,
        default: 22,
        unit: "u/s",
        help: "Scroll speed. 0 holds the city still."
    },
    {
        key: "cameraDirection",
        label: "Direction",
        group: "Camera",
        type: "select",
        default: "right",
        options: [
            {
                value: "right",
                label: "→ right"
            },
            {
                value: "left",
                label: "← left"
            }
        ]
    },
    {
        key: "zoom",
        label: "Zoom",
        group: "Camera",
        type: "range",
        min: 0.5,
        max: 2,
        step: 0.05,
        default: 1,
        help: "Camera distance. Higher zooms in (bigger buildings, fewer on screen)."
    },
    {
        key: "cameraHeight",
        label: "Vertical aim",
        group: "Camera",
        type: "range",
        min: -0.25,
        max: 0.25,
        step: 0.01,
        default: 0,
        help: "Pan the camera up (more sky) or down (more water)."
    },
    {
        key: "verticalDrift",
        label: "Vertical drift",
        group: "Camera",
        type: "range",
        min: 0,
        max: 0.1,
        step: 0.005,
        default: 0.02,
        help: "Amount of slow automatic up/down float. 0 holds still."
    },
    {
        key: "pointerParallax",
        label: "Pointer parallax",
        group: "Camera",
        type: "toggle",
        default: true,
        help: "Layers sway slightly toward the pointer (horizontally and vertically)."
    },
    {
        key: "seed",
        label: "Seed",
        group: "World",
        type: "seed",
        default: "cityscape",
        help: "Same seed + settings reproduces the exact city."
    },
    {
        key: "parallaxLayers",
        label: "Depth layers",
        group: "World",
        type: "range",
        min: 2,
        max: 6,
        step: 1,
        default: 4,
        help: "Number of parallax building bands."
    },
    {
        key: "spawnDensity",
        label: "Density",
        group: "World",
        type: "range",
        min: 0.4,
        max: 1.8,
        step: 0.05,
        default: 1,
        help: "How tightly buildings pack in."
    },
    {
        key: "waterLevel",
        label: "Water",
        group: "World",
        type: "range",
        min: 0,
        max: 0.5,
        step: 0.02,
        default: 0.33,
        help: "Fraction of the bottom that is calm water (sea/river). 0 = no water."
    },
    {
        key: "shoreHeight",
        label: "Shore",
        group: "World",
        type: "range",
        min: 0,
        max: 0.07,
        step: 0.005,
        default: 0.025,
        help: "Lit shore/embankment band between the city and the water."
    },
    {
        key: "palette",
        label: "Palette",
        group: "Mood",
        type: "select",
        default: "navy",
        options: PALETTE_NAMES.map((n)=>({
                value: n,
                label: PALETTES[n].label
            }))
    },
    {
        key: "moodCycleSeconds",
        label: "Mood cycle",
        group: "Mood",
        type: "range",
        min: 15,
        max: 600,
        step: 5,
        default: 90,
        unit: "s",
        help: "Seconds for one warm→cool→warm breath."
    },
    {
        key: "darkness",
        label: "Darkness",
        group: "Mood",
        type: "range",
        min: 0,
        max: 1,
        step: 0.02,
        default: 0.42
    },
    {
        key: "colorTemperature",
        label: "Temperature",
        group: "Mood",
        type: "range",
        min: 0,
        max: 1,
        step: 0.02,
        default: 0.5,
        help: "Bias the cycle toward warm (0) or cool (1)."
    },
    {
        key: "windowLightChance",
        label: "Lit windows",
        group: "Lights",
        type: "range",
        min: 0,
        max: 1,
        step: 0.02,
        default: 0.45
    },
    {
        key: "windowToggleRate",
        label: "Flicker",
        group: "Lights",
        type: "range",
        min: 0,
        max: 1,
        step: 0.02,
        default: 0.22,
        help: "How often windows switch. Low stays calm."
    },
    {
        key: "moonChance",
        label: "Moon",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.6
    },
    {
        key: "starDensity",
        label: "Stars",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.6
    },
    {
        key: "cloudChance",
        label: "Clouds",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.4
    },
    {
        key: "birdChance",
        label: "Birds",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.25
    },
    {
        key: "flyerChance",
        label: "Planes & co.",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.3,
        help: "Rare crossers: planes, satellites, shooting stars."
    },
    {
        key: "audioEnabled",
        label: "Ambient sound",
        group: "Audio",
        type: "toggle",
        default: false,
        help: "Synthesised drone + sparse city sounds. Off by default."
    },
    {
        key: "audioVolume",
        label: "Volume",
        group: "Audio",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5
    },
    {
        key: "showStats",
        label: "Show stats",
        group: "Debug",
        type: "toggle",
        default: false
    }
];
function buildDefaults(schema = CONFIG_SCHEMA) {
    const out = {};
    for (const f of schema)out[f.key] = f.default;
    return out;
}
const DEFAULT_CONFIG = buildDefaults();
const GROUP_ORDER = [
    "Camera",
    "World",
    "Mood",
    "Lights",
    "Sky",
    "Audio",
    "Debug"
];
function normalizeConfig(input) {
    const src = input && typeof input === "object" ? input : {};
    const out = {};
    for (const f of CONFIG_SCHEMA){
        const raw = src[f.key];
        out[f.key] = normalizeField(f, raw);
    }
    return out;
}
function normalizeField(f, raw) {
    switch(f.type){
        case "range":
            {
                const n = typeof raw === "number" ? raw : Number(raw);
                if (!Number.isFinite(n)) return f.default;
                return Math.min(f.max, Math.max(f.min, n));
            }
        case "select":
            {
                const s = String(raw);
                return f.options.some((o)=>o.value === s) ? s : f.default;
            }
        case "toggle":
            return typeof raw === "boolean" ? raw : raw === "true" || raw === 1 ? true : raw === undefined ? f.default : Boolean(raw);
        case "seed":
            return raw == null ? f.default : String(raw);
    }
}
function rgb(r1, g, b, a = 1) {
    return {
        r: clamp(Math.round(r1), 0, 255),
        g: clamp(Math.round(g), 0, 255),
        b: clamp(Math.round(b), 0, 255),
        a: clamp(a, 0, 1)
    };
}
function fromHex(hex) {
    let h = hex.trim().replace(/^#/, "");
    if (h.length === 3 || h.length === 4) {
        h = h.split("").map((c)=>c + c).join("");
    }
    const r1 = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return rgb(r1, g, b, a);
}
function withAlpha(c, a) {
    return {
        r: c.r,
        g: c.g,
        b: c.b,
        a: clamp(a, 0, 1)
    };
}
function fadeAlpha(c, factor) {
    return withAlpha(c, c.a * factor);
}
function toCss(c) {
    return `rgba(${c.r},${c.g},${c.b},${round3(c.a)})`;
}
function luminance(c) {
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}
function srgbToLinear(c) {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linearToSrgb(x) {
    const c = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return clamp(Math.round(c * 255), 0, 255);
}
function toOklab(c) {
    const r1 = srgbToLinear(c.r);
    const g = srgbToLinear(c.g);
    const b = srgbToLinear(c.b);
    const l = Math.cbrt(0.4122214708 * r1 + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r1 + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r1 + 0.2817188376 * g + 0.6299787005 * b);
    return {
        L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    };
}
function fromOklab(o, alpha) {
    const l_ = o.L + 0.3963377774 * o.a + 0.2158037573 * o.b;
    const m_ = o.L - 0.1055613458 * o.a - 0.0638541728 * o.b;
    const s_ = o.L - 0.0894841775 * o.a - 1.291485548 * o.b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    return {
        r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
        a: clamp(alpha, 0, 1)
    };
}
function mix(a, b, t) {
    const k = clamp(t, 0, 1);
    const oa = toOklab(a);
    const ob = toOklab(b);
    return fromOklab({
        L: oa.L + (ob.L - oa.L) * k,
        a: oa.a + (ob.a - oa.a) * k,
        b: oa.b + (ob.b - oa.b) * k
    }, a.a + (b.a - a.a) * k);
}
function darken(c, amount) {
    return mix(c, rgb(0, 0, 0, c.a), amount);
}
function lighten(c, amount) {
    return mix(c, rgb(255, 255, 255, c.a), amount);
}
function round3(n) {
    return Math.round(n * 1000) / 1000;
}
function hash1(i, seed) {
    let h = (i ^ seed) >>> 0;
    h = Math.imul(h ^ h >>> 16, 0x45d9f3b);
    h = Math.imul(h ^ h >>> 16, 0x45d9f3b);
    h = (h ^ h >>> 16) >>> 0;
    return h / 4294967296;
}
function createNoise1D(seed, octaves = 1, persistence = 0.5) {
    const oct = Math.max(1, Math.floor(octaves));
    const single = (x)=>{
        const i = Math.floor(x);
        const f = x - i;
        const a = hash1(i, seed);
        const b = hash1(i + 1, seed);
        return a + (b - a) * smoothstep(0, 1, f);
    };
    const at = (x)=>{
        if (oct === 1) return single(x);
        let sum = 0;
        let amp = 1;
        let freq = 1;
        let norm = 0;
        for(let o = 0; o < oct; o++){
            sum += single(x * freq + o * 1000) * amp;
            norm += amp;
            amp *= persistence;
            freq *= 2;
        }
        return sum / norm;
    };
    return {
        at,
        signed: (x)=>at(x) * 2 - 1
    };
}
function parse(c) {
    return {
        skyTop: fromHex(c.skyTop),
        skyMid: fromHex(c.skyMid),
        skyBottom: fromHex(c.skyBottom),
        horizonGlow: fromHex(c.horizonGlow),
        buildingFar: fromHex(c.buildingFar),
        buildingNear: fromHex(c.buildingNear),
        window: fromHex(c.window),
        moon: fromHex(c.moon),
        star: fromHex(c.star)
    };
}
class MoodEngine {
    mood;
    #palette;
    #warm;
    #cool;
    #noise;
    constructor(config, seed){
        this.#palette = getPalette(config.palette);
        this.#warm = parse(this.#palette.warm);
        this.#cool = parse(this.#palette.cool);
        this.#noise = createNoise1D(seed ^ 0x6d0a17, 2);
        this.mood = {
            phase: 0,
            warmth: 1,
            darkness: config.darkness,
            sky: [
                {
                    at: 0,
                    color: this.#warm.skyTop
                },
                {
                    at: 0.6,
                    color: this.#warm.skyMid
                },
                {
                    at: 1,
                    color: this.#warm.skyBottom
                }
            ],
            horizonGlow: this.#warm.horizonGlow,
            buildingFar: this.#warm.buildingFar,
            buildingNear: this.#warm.buildingNear,
            haze: this.#warm.skyMid,
            window: this.#warm.window,
            windowGlow: withAlpha(this.#warm.window, 0.5),
            moon: this.#warm.moon,
            star: this.#warm.star
        };
        this.update(0, config);
    }
    setPalette(name) {
        this.#palette = getPalette(name);
        this.#warm = parse(this.#palette.warm);
        this.#cool = parse(this.#palette.cool);
    }
    update(timeMs, config) {
        const cycleMs = Math.max(1, config.moodCycleSeconds * 1000);
        const cyclePos = timeMs / cycleMs;
        const breath = cosinePulse(cyclePos);
        const wander = (this.#noise.at(cyclePos * 0.5) - 0.5) * 0.18;
        const t = clamp(0.5 + (breath - 0.5) * 0.74 + (config.colorTemperature - 0.5) * 0.8 + wander, 0, 1);
        const warmth = 1 - t;
        const darkBreath = cosinePulse(cyclePos * 0.5 + 0.3) - 0.5;
        const darkness = clamp(config.darkness + darkBreath * 0.12, 0, 0.95);
        const m = this.mood;
        const w = this.#warm;
        const c = this.#cool;
        const blend = (k)=>mix(w[k], c[k], t);
        const skyTop = darken(blend("skyTop"), darkness * 0.55);
        const skyMid = darken(blend("skyMid"), darkness * 0.5);
        const skyBottom = darken(blend("skyBottom"), darkness * 0.42);
        m.phase = cyclePos % 1;
        m.warmth = warmth;
        m.darkness = darkness;
        m.sky[0].color = skyTop;
        m.sky[1].color = skyMid;
        m.sky[2].color = skyBottom;
        m.horizonGlow = darken(blend("horizonGlow"), darkness * 0.35);
        m.buildingFar = darken(blend("buildingFar"), darkness * 0.5);
        m.buildingNear = darken(blend("buildingNear"), darkness * 0.55);
        m.haze = skyMid;
        m.window = blend("window");
        m.windowGlow = withAlpha(m.window, 0.5);
        m.moon = darken(blend("moon"), darkness * 0.2);
        m.star = blend("star");
    }
}
function silhouetteColor(mood, depth) {
    const base = mix(mood.buildingFar, mood.buildingNear, depth);
    const haze = (1 - depth) * 0.55;
    return mix(base, mood.haze, haze);
}
class AmbientEventBus {
    #listeners = new Set();
    on(fn) {
        this.#listeners.add(fn);
        return ()=>this.#listeners.delete(fn);
    }
    emit(event) {
        for (const fn of this.#listeners)fn(event);
    }
}
const TYPE_WEIGHTS = {
    wind: 5,
    rumble: 2.5,
    horn: 1.5,
    chime: 1
};
const TYPES = Object.keys(TYPE_WEIGHTS);
const WEIGHTS = TYPES.map((t)=>TYPE_WEIGHTS[t]);
class AmbientDirector {
    #rng;
    #bus;
    #timer;
    constructor(rng, bus){
        this.#rng = rng;
        this.#bus = bus;
        this.#timer = this.#nextInterval();
    }
    #nextInterval() {
        return this.#rng.float(7000, 22000);
    }
    update(dt, _config) {
        this.#timer -= dt;
        if (this.#timer > 0) return;
        this.#timer = this.#nextInterval();
        const type = this.#rng.weighted(TYPES, WEIGHTS);
        this.#bus.emit({
            type,
            intensity: this.#rng.float(0.25, type === "wind" ? 0.7 : 0.55),
            pan: this.#rng.float(-0.8, 0.8)
        });
    }
}
function hashSeed(input) {
    let h = 0x811c9dc5;
    for(let i = 0; i < input.length; i++){
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
function normalizeSeed(seed) {
    if (typeof seed === "string") return hashSeed(seed);
    return Math.floor(seed) >>> 0 || (seed === 0 ? 0 : hashSeed(String(seed)));
}
function createRng(seed) {
    const seed32 = normalizeSeed(seed);
    let a = seed32 >>> 0;
    const next = ()=>{
        a |= 0;
        a = a + 0x6d2b79f5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const rng = {
        seed: seed32,
        next,
        int (min, max) {
            if (max < min) [min, max] = [
                max,
                min
            ];
            return min + Math.floor(next() * (max - min + 1));
        },
        float (min, max) {
            return min + next() * (max - min);
        },
        bool (p = 0.5) {
            return next() < p;
        },
        pick (arr) {
            if (arr.length === 0) throw new RangeError("pick() on empty array");
            return arr[Math.floor(next() * arr.length)];
        },
        weighted (arr, weights) {
            if (arr.length === 0) throw new RangeError("weighted() on empty array");
            let total = 0;
            for (const w of weights)total += Math.max(0, w);
            if (total <= 0) return arr[Math.floor(next() * arr.length)];
            let roll = next() * total;
            for(let i = 0; i < arr.length; i++){
                roll -= Math.max(0, weights[i] ?? 0);
                if (roll < 0) return arr[i];
            }
            return arr[arr.length - 1];
        },
        fork (salt = 0) {
            const saltN = typeof salt === "string" ? hashSeed(salt) : salt >>> 0;
            return createRng(Math.imul(seed32 ^ saltN, 0x9e3779b1) >>> 0);
        }
    };
    return rng;
}
class Camera {
    scroll;
    speed;
    minParallax;
    width = 0;
    height = 0;
    zoom = 1;
    sway = 0;
    offsetY = 0;
    swayY = 0;
    constructor(opts = {}){
        this.speed = opts.speed ?? 24;
        this.minParallax = opts.minParallax ?? 0.18;
        this.scroll = opts.scroll ?? 0;
    }
    get unit() {
        return Math.max(1, this.height) * this.zoom;
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
    }
    step(dt) {
        this.scroll += this.speed * (dt / 1000) / this.unit;
    }
    parallaxAt(depth) {
        return lerp(this.minParallax, 1, depth);
    }
    project(localX, depth) {
        const p = this.parallaxAt(depth);
        return (localX - this.scroll * p) * this.unit + this.sway * p;
    }
    viewLeft(depth) {
        return this.scroll * this.parallaxAt(depth);
    }
    viewRight(depth) {
        return this.viewLeft(depth) + this.width / this.unit;
    }
    isVisible(x, width, depth, margin = 0) {
        const left = this.project(x, depth);
        const right = this.project(x + width, depth);
        return right >= -margin && left <= this.width + margin;
    }
}
class DisplayListBuilder {
    width;
    height;
    offsetY = 0;
    commands = [];
    constructor(width, height){
        this.width = width;
        this.height = height;
    }
    reset(width, height) {
        this.width = width;
        this.height = height;
        this.offsetY = 0;
        this.commands.length = 0;
        return this;
    }
    push(cmd) {
        this.commands.push(cmd);
        return this;
    }
    rect(x, y, w, h, color) {
        this.commands.push({
            kind: "rect",
            x,
            y,
            w,
            h,
            color
        });
        return this;
    }
    polygon(points, color) {
        this.commands.push({
            kind: "polygon",
            points,
            color
        });
        return this;
    }
    circle(x, y, r1, color) {
        this.commands.push({
            kind: "circle",
            x,
            y,
            r: r1,
            color
        });
        return this;
    }
    gradient(x, y, w, h, stops, vertical = true) {
        this.commands.push({
            kind: "gradient",
            x,
            y,
            w,
            h,
            stops,
            vertical
        });
        return this;
    }
    line(x1, y1, x2, y2, width, color) {
        this.commands.push({
            kind: "line",
            x1,
            y1,
            x2,
            y2,
            width,
            color
        });
        return this;
    }
    glow(x, y, r1, color, intensity = 1) {
        this.commands.push({
            kind: "glow",
            x,
            y,
            r: r1,
            color,
            intensity
        });
        return this;
    }
    text(x, y, text, size, color) {
        this.commands.push({
            kind: "text",
            x,
            y,
            text,
            size,
            color
        });
        return this;
    }
}
class World {
    camera;
    layers = [];
    #builder;
    constructor(camera = new Camera()){
        this.camera = camera;
        this.#builder = new DisplayListBuilder(0, 0);
    }
    addLayer(layer) {
        this.layers.push(layer);
        this.layers.sort((a, b)=>a.depth - b.depth);
        return layer;
    }
    layer(name) {
        return this.layers.find((l)=>l.name === name);
    }
    resize(width, height) {
        this.camera.resize(width, height);
    }
    stepCamera(dt) {
        this.camera.step(dt);
    }
    updateEntities(ctx) {
        for(let i = 0; i < this.layers.length; i++)this.layers[i].update(ctx);
    }
    collect(width, height) {
        const out = this.#builder.reset(width, height);
        const ctx = {
            out,
            camera: this.camera,
            width,
            height
        };
        for(let i = 0; i < this.layers.length; i++)this.layers[i].draw(ctx);
        out.offsetY = this.camera.offsetY + this.camera.swayY;
        return out;
    }
}
const WARM_TINT = rgb(255, 196, 120);
const COOL_TINT = rgb(196, 220, 255);
function cellHash(n) {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}
class WindowGrid {
    cols;
    rows;
    lit;
    #padX;
    #padY;
    #fill;
    #toggle = 0;
    #salt = 0;
    constructor(cols, rows, opts = {}){
        this.cols = Math.max(0, Math.floor(cols));
        this.rows = Math.max(0, Math.floor(rows));
        this.lit = new Uint8Array(this.cols * this.rows);
        this.#padX = opts.padX ?? 0.14;
        this.#padY = opts.padY ?? 0.08;
        this.#fill = opts.fill ?? 0.62;
    }
    seed(rng, litChance) {
        for(let i = 0; i < this.lit.length; i++){
            this.lit[i] = rng.next() < litChance ? 1 : 0;
        }
        this.#toggle = rng.float(400, 2600);
        this.#salt = Math.floor(rng.next() * 9973);
    }
    update(dt, rng, config) {
        if (this.lit.length === 0 || config.windowToggleRate <= 0) return;
        this.#toggle -= dt * config.windowToggleRate;
        if (this.#toggle > 0) return;
        this.#toggle = rng.float(500, 3200);
        const i = rng.int(0, this.lit.length - 1);
        this.lit[i] = rng.next() < config.windowLightChance ? 1 : 0;
    }
    draw(out, x, y, w, h, color, depth) {
        if (this.lit.length === 0 || w <= 0 || h <= 0) return;
        const ix = x + w * this.#padX;
        const iy = y + h * this.#padY;
        const iw = w * (1 - this.#padX * 2);
        const ih = h * (1 - this.#padY * 2);
        const cellW = iw / this.cols;
        const cellH = ih / this.rows;
        const winW = Math.max(0.6, cellW * this.#fill);
        const winH = Math.max(0.6, cellH * this.#fill);
        const offX = (cellW - winW) / 2;
        const offY = (cellH - winH) / 2;
        const glow = depth > 0.55 && winW > 1.4;
        for(let r1 = 0; r1 < this.rows; r1++){
            for(let c = 0; c < this.cols; c++){
                const idx = r1 * this.cols + c;
                if (this.lit[idx] === 0) continue;
                const wx = ix + c * cellW + offX;
                const wy = iy + r1 * cellH + offY;
                const hTint = cellHash(idx + this.#salt);
                const hBright = cellHash(idx * 2 + this.#salt + 7);
                const toward = hTint < 0.5 ? WARM_TINT : COOL_TINT;
                const tinted = mix(color, toward, Math.abs(hTint - 0.5) * 2 * 0.28);
                const bright = 0.6 + hBright * 0.4;
                const cell = withAlpha(tinted, color.a * bright);
                if (glow) {
                    out.glow(wx + winW / 2, wy + winH / 2, winW * 1.7, fadeAlpha(cell, 0.45), 0.55);
                }
                out.rect(wx, wy, winW, winH, cell);
            }
        }
    }
}
const ANTENNA_LIGHT = rgb(255, 70, 64);
class Building {
    depth;
    bounds = {
        x: 0,
        width: 0
    };
    alive = true;
    #spec;
    #localX = 0;
    #baseline = 0.95;
    #shoreOffset = 0;
    #width = 0;
    #heightFrac = 0;
    #rng;
    #grid = new WindowGrid(0, 0);
    #color = rgb(0, 0, 0);
    #window = rgb(255, 255, 255);
    #time = 0;
    #phase = 0;
    constructor(depth, rng){
        this.depth = depth;
        this.#rng = rng;
    }
    get kind() {
        return this.#spec.kind;
    }
    reset(spec, localX, shoreOffset, scale, litChance) {
        this.#spec = spec;
        this.#localX = localX;
        this.#shoreOffset = shoreOffset;
        this.#width = spec.width * scale;
        this.#heightFrac = clamp(spec.height * scale, 0.02, 0.96);
        this.bounds.x = localX;
        this.bounds.width = this.#width;
        this.alive = true;
        this.#phase = this.#rng.next();
        this.#grid = new WindowGrid(spec.cols, spec.rows);
        this.#grid.seed(this.#rng, litChance);
    }
    flash() {
        this.#grid.seed(this.#rng, 0.85);
    }
    update(ctx) {
        this.#time = ctx.time;
        const cfg = ctx.env.config;
        this.#baseline = clamp(1 - cfg.waterLevel - cfg.shoreHeight - this.#shoreOffset, 0.1, 1);
        const mood = ctx.env.mood;
        this.#color = silhouetteColor(mood, this.depth);
        this.#window = mood.window;
        this.#grid.update(ctx.dt, this.#rng, ctx.env.config);
    }
    draw(ctx) {
        const sx = ctx.camera.project(this.#localX, this.depth);
        const sw = this.#width * ctx.camera.unit;
        if (sx + sw < -4 || sx > ctx.width + 4) return;
        const groundY = ctx.height * this.#baseline;
        const bh = this.#heightFrac * ctx.camera.unit;
        const topY = groundY - bh;
        const out = ctx.out;
        const spec = this.#spec;
        const win = drawBody(out, sx, topY, sw, bh, this.#color, spec.setbacks);
        this.#grid.draw(out, win.x, win.y, win.w, win.h, this.#window, this.depth);
        drawRoof(out, spec.roof, sx, topY, sw, spec.roofScale, this.#color, this.#time, this.#phase, this.depth);
    }
}
function drawBody(out, x, y, w, h, color, setbacks) {
    if (setbacks <= 0) {
        out.rect(x, y, w, h, color);
        return {
            x,
            y,
            w,
            h
        };
    }
    const segs = setbacks + 1;
    const segH = h / segs;
    let curX = x;
    let curW = w;
    let yBottom = y + h;
    for(let i = 0; i < segs; i++){
        const yTop = yBottom - segH;
        out.rect(curX, yTop, curW, segH + 0.5, color);
        curX += curW * 0.16;
        curW *= 0.68;
        yBottom = yTop;
    }
    return {
        x,
        y: y + h - segH,
        w,
        h: segH
    };
}
function drawRoof(out, roof, x, topY, w, scale, color, time, phase, depth) {
    const cx = x + w / 2;
    switch(roof){
        case "flat":
            return;
        case "antenna":
            {
                const len = w * (0.5 + scale * 0.9);
                out.line(cx, topY, cx, topY - len, Math.max(1, w * 0.04), color);
                if (depth > 0.4) {
                    const on = (time + phase * 1700) % 1700 < 240;
                    if (on) out.glow(cx, topY - len, w * 0.18, ANTENNA_LIGHT, 1);
                    out.circle(cx, topY - len, Math.max(0.8, w * 0.045), on ? ANTENNA_LIGHT : darken(ANTENNA_LIGHT, 0.6));
                }
                return;
            }
        case "tank":
            {
                const tw = w * 0.34 * scale + w * 0.18;
                const th = w * 0.22 * scale + 3;
                out.rect(cx - tw / 2, topY - th, tw, th, color);
                out.line(cx + tw * 0.1, topY - th, cx + tw * 0.1, topY - th - th * 0.7, Math.max(1, w * 0.03), color);
                return;
            }
        case "spire":
            {
                const sh = w * (0.6 + scale * 1.1);
                const sw = Math.max(2, w * 0.16);
                out.polygon([
                    cx - sw / 2,
                    topY,
                    cx + sw / 2,
                    topY,
                    cx,
                    topY - sh
                ], color);
                return;
            }
        case "dome":
            {
                const r1 = w * 0.32;
                out.circle(cx, topY, r1, color);
                out.rect(x + w * 0.18, topY, w * 0.64, r1, color);
                return;
            }
        case "pitched":
            {
                const ph = w * 0.28 * (0.6 + scale);
                out.polygon([
                    x,
                    topY,
                    x + w,
                    topY,
                    cx,
                    topY - ph
                ], color);
                return;
            }
        case "chimneys":
            {
                for(let i = 0; i < 2; i++){
                    const ratio = 0.62 + i * 0.2;
                    const chx = x + w * ratio;
                    const chW = Math.max(2, w * 0.06);
                    const chH = w * (0.3 + scale * 0.35);
                    out.rect(chx, topY - chH, chW, chH, color);
                    drawSmoke(out, chx + chW / 2, topY - chH, w, time, phase + i * 0.41);
                }
                return;
            }
        case "sawtooth":
            {
                const teeth = Math.max(3, Math.round(w / 26));
                const tw = w / teeth;
                const th = w * 0.08 * (0.6 + scale);
                for(let i = 0; i < teeth; i++){
                    const tx = x + i * tw;
                    out.polygon([
                        tx,
                        topY,
                        tx + tw,
                        topY,
                        tx + tw,
                        topY - th
                    ], color);
                }
                return;
            }
    }
}
function drawSmoke(out, x, y, w, time, phase) {
    const puff = rgb(46, 52, 68);
    for(let k = 0; k < 3; k++){
        const t = ((time * 0.00006 + phase + k * 0.34) % 1 + 1) % 1;
        const py = y - t * w * 0.9;
        const px = x + Math.sin((t + phase) * 6.283) * w * 0.12;
        const r1 = w * (0.08 + t * 0.16);
        const a = (1 - t) * 0.2;
        out.circle(px, py, r1, withAlpha(puff, a));
    }
}
class Layer {
    name;
    depth;
    entities = [];
    constructor(name, depth){
        this.name = name;
        this.depth = depth;
    }
    add(entity) {
        this.entities.push(entity);
    }
    clear() {
        this.entities.length = 0;
    }
    update(ctx) {
        const list = this.entities;
        for(let i = 0; i < list.length; i++)list[i].update(ctx);
        let w = 0;
        for(let i = 0; i < list.length; i++){
            if (list[i].alive) list[w++] = list[i];
        }
        list.length = w;
    }
    draw(ctx) {
        const list = this.entities;
        for(let i = 0; i < list.length; i++)list[i].draw(ctx);
    }
}
class SkyBackdrop {
    depth = 0;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #mood;
    #horizon = 0.72;
    update(ctx) {
        this.#mood = ctx.env.mood;
        this.#horizon = 1 - ctx.env.config.waterLevel - ctx.env.config.shoreHeight;
    }
    draw(ctx) {
        const { out, width, height } = ctx;
        const mood = this.#mood;
        out.gradient(0, 0, width, height, mood.sky, true);
        out.rect(0, -height * 0.3, width, height * 0.3, mood.sky[0].color);
        const glow = mood.horizonGlow;
        const band = height * 0.5;
        out.gradient(0, height * this.#horizon - band * 0.6, width, band, [
            {
                at: 0,
                color: withAlpha(glow, 0)
            },
            {
                at: 0.6,
                color: withAlpha(glow, 0.45)
            },
            {
                at: 1,
                color: withAlpha(rgb(glow.r, glow.g, glow.b), 0)
            }
        ], true);
    }
}
class Starfield {
    depth = 0.02;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #tileW;
    #stars;
    #density;
    #time = 0;
    #mood;
    constructor(rng, count = 220, tileW = 1600){
        this.#tileW = tileW;
        this.#density = 1;
        this.#stars = Array.from({
            length: count
        }, ()=>({
                x: rng.float(0, tileW),
                yFrac: rng.float(0.02, 0.62),
                size: rng.float(0.5, 1.7),
                base: rng.float(0.3, 1),
                tw: rng.float(0, 6.283)
            }));
    }
    update(ctx) {
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
        this.#density = ctx.env.config.starDensity;
    }
    draw(ctx) {
        const { out, width, height } = ctx;
        if (this.#density <= 0) return;
        const scroll = ctx.camera.scroll * ctx.camera.parallaxAt(this.depth) * ctx.camera.unit;
        const shown = Math.floor(this.#stars.length * this.#density);
        const star = this.#mood.star;
        const t = this.#time * 0.002;
        for(let i = 0; i < shown; i++){
            const s = this.#stars[i];
            const sx = wrap(s.x - scroll, this.#tileW);
            if (sx > width) continue;
            const twinkle = 0.65 + 0.35 * Math.sin(t + s.tw);
            out.circle(sx, s.yFrac * height, s.size, withAlpha(star, s.base * twinkle));
        }
    }
}
class Moon {
    depth = 0.03;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #roll;
    #xFrac;
    #yFrac;
    #radiusFrac;
    #phase;
    #drift = 0;
    #opacity = 0;
    #mood;
    constructor(rng){
        this.#roll = rng.next();
        this.#xFrac = rng.float(0.12, 0.82);
        this.#yFrac = rng.float(0.12, 0.34);
        this.#radiusFrac = rng.float(0.04, 0.07);
        this.#phase = rng.float(-0.8, 0.8);
    }
    update(ctx) {
        this.#mood = ctx.env.mood;
        this.#drift += ctx.dt * 0.000004;
        const target = this.#roll < ctx.env.config.moonChance ? 1 : 0;
        this.#opacity += (target - this.#opacity) * Math.min(1, ctx.dt * 0.0008);
    }
    draw(ctx) {
        if (this.#opacity < 0.01) return;
        const { out, width, height } = ctx;
        const moon = withAlpha(this.#mood.moon, this.#mood.moon.a * this.#opacity);
        const r1 = this.#radiusFrac * Math.min(width, height);
        const x = (this.#xFrac + Math.sin(this.#drift) * 0.02) * width;
        const y = this.#yFrac * height;
        out.glow(x, y, r1 * 3.4, withAlpha(moon, 0.18 * this.#opacity), 0.7);
        out.circle(x, y, r1, moon);
        if (Math.abs(this.#phase) > 0.06) {
            const shadow = shadowColor(this.#mood, this.#opacity);
            out.circle(x + this.#phase * r1 * 1.25, y, r1 * 1.02, shadow);
        }
    }
}
function shadowColor(mood, opacity) {
    const sky = mix(mood.sky[0].color, mood.sky[1].color, 0.4);
    return withAlpha(sky, opacity);
}
class CloudField {
    depth = 0.12;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #tileW;
    #clouds;
    #chance = 0.4;
    #time = 0;
    #mood;
    constructor(rng, count = 7, tileW = 2200){
        this.#tileW = tileW;
        this.#clouds = Array.from({
            length: count
        }, ()=>{
            const scale = rng.float(0.6, 1.6);
            const puffCount = rng.int(3, 6);
            const puffs = [];
            for(let i = 0; i < puffCount; i++){
                puffs.push({
                    dx: rng.float(-1, 1) * 40 * scale,
                    dy: rng.float(-1, 1) * 10 * scale,
                    r: rng.float(14, 30) * scale
                });
            }
            return {
                x: rng.float(0, tileW),
                yFrac: rng.float(0.08, 0.4),
                scale,
                drift: rng.float(-0.004, 0.004),
                alpha: rng.float(0.06, 0.16),
                puffs
            };
        });
    }
    update(ctx) {
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
        this.#chance = ctx.env.config.cloudChance;
    }
    draw(ctx) {
        if (this.#chance <= 0) return;
        const { out, width, height } = ctx;
        const scroll = ctx.camera.scroll * ctx.camera.parallaxAt(this.depth) * ctx.camera.unit;
        const shown = Math.floor(this.#clouds.length * Math.min(1, this.#chance + 0.05));
        const tone = mix(this.#mood.haze, this.#mood.horizonGlow, 0.3);
        for(let i = 0; i < shown; i++){
            const c = this.#clouds[i];
            const cx = wrap(c.x - scroll + c.drift * this.#time, this.#tileW);
            if (cx > width + 80) continue;
            const cy = c.yFrac * height;
            const col = withAlpha(tone, c.alpha);
            for (const p of c.puffs)out.circle(cx + p.dx, cy + p.dy, p.r, col);
        }
    }
}
const NAV_RED = rgb(255, 80, 70);
const NAV_GREEN = rgb(90, 255, 120);
class FlyerDirector {
    depth = 0.06;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #rng;
    #timer;
    #flyer = null;
    #time = 0;
    #mood;
    constructor(rng){
        this.#rng = rng;
        this.#timer = rng.float(8000, 20000);
    }
    update(ctx) {
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
        const chance = ctx.env.config.flyerChance;
        if (this.#flyer) {
            this.#flyer.progress += this.#flyer.speed * ctx.dt;
            if (this.#flyer.progress > 1) this.#flyer = null;
            return;
        }
        if (chance <= 0) return;
        this.#timer -= ctx.dt * (0.25 + chance);
        if (this.#timer > 0) return;
        this.#timer = this.#rng.float(12000, 32000);
        this.#flyer = this.#spawn();
    }
    #spawn() {
        const type = this.#rng.weighted([
            "plane",
            "satellite",
            "shooting-star"
        ], [
            3,
            2,
            2
        ]);
        const dir = this.#rng.bool() ? 1 : -1;
        const x0 = dir > 0 ? -0.05 : 1.05;
        const x1 = dir > 0 ? 1.05 : -0.05;
        if (type === "shooting-star") {
            const sx = this.#rng.float(0.1, 0.9);
            return {
                type,
                progress: 0,
                speed: this.#rng.float(0.0014, 0.0022),
                x0: sx,
                y0: this.#rng.float(0.05, 0.2),
                x1: sx + this.#rng.float(-0.25, 0.25),
                y1: this.#rng.float(0.35, 0.55)
            };
        }
        const y = this.#rng.float(0.08, type === "plane" ? 0.3 : 0.22);
        return {
            type,
            progress: 0,
            speed: type === "plane" ? this.#rng.float(0.00012, 0.0002) : this.#rng.float(0.00008, 0.00014),
            x0,
            y0: y,
            x1,
            y1: y + this.#rng.float(-0.03, 0.03)
        };
    }
    draw(ctx) {
        const f = this.#flyer;
        if (!f) return;
        const { out, width, height } = ctx;
        const t = f.progress;
        const x = (f.x0 + (f.x1 - f.x0) * t) * width;
        const y = (f.y0 + (f.y1 - f.y0) * t) * height;
        const star = this.#mood.star;
        if (f.type === "shooting-star") {
            const tailLen = 26 + 40 * Math.sin(Math.min(1, t) * Math.PI);
            const dx = (f.x1 - f.x0) * width;
            const dy = (f.y1 - f.y0) * height;
            const len = Math.hypot(dx, dy) || 1;
            const tx = x - dx / len * tailLen;
            const ty = y - dy / len * tailLen;
            const a = Math.sin(Math.min(1, t) * Math.PI);
            out.line(tx, ty, x, y, 2, withAlpha(star, 0.5 * a));
            out.circle(x, y, 1.8, withAlpha(star, a));
            return;
        }
        if (f.type === "satellite") {
            const blink = 0.55 + 0.45 * Math.sin(this.#time * 0.006);
            out.circle(x, y, 1.4, withAlpha(star, blink));
            return;
        }
        out.circle(x, y, 1.6, withAlpha(star, 0.5));
        const on = this.#time % 1100 < 320;
        if (on) {
            out.circle(x - 4, y, 1.4, NAV_RED);
            out.circle(x + 4, y, 1.4, NAV_GREEN);
        }
    }
}
class BirdDirector {
    depth = 0.5;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #rng;
    #timer;
    #flock = null;
    #time = 0;
    #mood;
    constructor(rng){
        this.#rng = rng;
        this.#timer = rng.float(3000, 12000);
    }
    update(ctx) {
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
        const chance = ctx.env.config.birdChance;
        if (this.#flock) {
            this.#flock.progress += this.#flock.speed * ctx.dt;
            if (this.#flock.progress > 1.2) this.#flock = null;
            return;
        }
        if (chance <= 0) return;
        this.#timer -= ctx.dt * (0.3 + chance);
        if (this.#timer > 0) return;
        this.#timer = this.#rng.float(6000, 20000);
        const dir = this.#rng.bool() ? 1 : -1;
        this.#flock = {
            yFrac: this.#rng.float(0.18, 0.5),
            dir,
            speed: this.#rng.float(0.00018, 0.0003),
            progress: 0,
            size: this.#rng.float(5, 9),
            count: this.#rng.int(3, 7)
        };
    }
    draw(ctx) {
        const f = this.#flock;
        if (!f) return;
        const { out, width, height } = ctx;
        const color = withAlpha(darken(this.#mood.buildingNear, 0.1), 0.8);
        const flap = Math.sin(this.#time * 0.012);
        const headX = f.dir > 0 ? f.progress * (width + 200) - 100 : width + 100 - f.progress * (width + 200);
        for(let i = 0; i < f.count; i++){
            const off = i * f.size * 2.4;
            const bx = headX - f.dir * off;
            const by = f.yFrac * height + Math.abs(i - (f.count - 1) / 2) * f.size * 0.9;
            drawBird(out, bx, by, f.size, flap, color);
        }
    }
}
function drawBird(out, x, y, size, flap, color) {
    const wing = clamp(0.4 + flap * 0.5, 0.1, 0.9) * size;
    out.line(x - size, y + wing, x, y, Math.max(1, size * 0.18), color);
    out.line(x, y, x + size, y + wing, Math.max(1, size * 0.18), color);
}
class Water {
    depth = 1;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #mood;
    #level = 0.33;
    #time = 0;
    #shimmer;
    #reflections;
    constructor(rng){
        this.#shimmer = Array.from({
            length: 6
        }, ()=>rng.float(0.04, 0.7));
        this.#reflections = Array.from({
            length: 5
        }, ()=>({
                xFrac: rng.float(0.05, 0.95),
                width: rng.float(0.01, 0.04)
            }));
    }
    update(ctx) {
        this.#mood = ctx.env.mood;
        this.#level = ctx.env.config.waterLevel;
        this.#time = ctx.time;
    }
    draw(ctx) {
        if (this.#level <= 0.001) return;
        const { out, width, height } = ctx;
        const mood = this.#mood;
        const waterY = (1 - this.#level) * height;
        const waterH = height - waterY;
        if (waterH <= 0) return;
        const top = darken(mix(mood.horizonGlow, mood.buildingNear, 0.5), 0.1);
        const bottom = darken(mood.buildingNear, 0.35);
        out.gradient(0, waterY, width, waterH, [
            {
                at: 0,
                color: top
            },
            {
                at: 1,
                color: bottom
            }
        ], true);
        out.rect(0, height, width, height * 0.3, bottom);
        out.line(0, waterY, width, waterY, 1, withAlpha(mood.horizonGlow, 0.5));
        out.gradient(0, waterY, width, waterH * 0.55, [
            {
                at: 0,
                color: withAlpha(mood.horizonGlow, 0.32)
            },
            {
                at: 1,
                color: withAlpha(mood.horizonGlow, 0)
            }
        ], true);
        const reflTone = lighten(mood.window, 0.05);
        for (const r1 of this.#reflections){
            const x = r1.xFrac * width;
            const w = Math.max(1, r1.width * width);
            const wob = Math.sin(this.#time * 0.0008 + r1.xFrac * 7) * w * 0.4;
            out.gradient(x + wob, waterY, w, waterH * 0.7, [
                {
                    at: 0,
                    color: withAlpha(reflTone, 0.16)
                },
                {
                    at: 1,
                    color: withAlpha(reflTone, 0)
                }
            ], true);
        }
        const shimmer = lighten(mood.horizonGlow, 0.15);
        for(let i = 0; i < this.#shimmer.length; i++){
            const f = this.#shimmer[i];
            const y = waterY + f * waterH;
            const pulse = 0.5 + 0.5 * Math.sin(this.#time * 0.0012 + i * 1.7);
            const a = (1 - f) * 0.08 * pulse;
            out.line(0, y, width, y, 1, withAlpha(shimmer, a));
        }
    }
}
const LIGHT_SPACING = 0.16;
const LAMP = rgb(255, 198, 120);
class Shore {
    depth = 1;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #mood;
    #water = 0.33;
    #shore = 0.025;
    #time = 0;
    #lampPhase;
    constructor(rng){
        this.#lampPhase = rng.float(0, 1);
    }
    update(ctx) {
        this.#mood = ctx.env.mood;
        this.#water = ctx.env.config.waterLevel;
        this.#shore = ctx.env.config.shoreHeight;
        this.#time = ctx.time;
    }
    draw(ctx) {
        if (this.#shore <= 0.001) return;
        const { out, width, height } = ctx;
        const mood = this.#mood;
        const waterY = (1 - this.#water) * height;
        const bandH = this.#shore * height;
        const shoreTopY = waterY - bandH;
        const landTop = darken(mix(mood.buildingNear, mood.horizonGlow, 0.32), 0.05);
        const landBot = darken(mood.buildingNear, 0.12);
        out.gradient(0, shoreTopY, width, bandH, [
            {
                at: 0,
                color: landTop
            },
            {
                at: 1,
                color: landBot
            }
        ], true);
        out.line(0, waterY, width, waterY, 1, withAlpha(lighten(mood.horizonGlow, 0.12), 0.6));
        const cam = ctx.camera;
        const leftWU = cam.viewLeft(0.92);
        const rightWU = leftWU + width / cam.unit;
        const lampH = Math.max(4, bandH * 1.1);
        const r1 = Math.max(1, bandH * 0.18);
        let x = Math.ceil((leftWU - 0.16) / 0.16) * 0.16;
        for(; x <= rightWU + 0.16; x += LIGHT_SPACING){
            const sx = cam.project(x, 0.92);
            if (sx < -8 || sx > width + 8) continue;
            drawLamp(out, sx, shoreTopY, bandH, lampH, r1);
            drawLampReflection(out, sx, waterY, height - waterY, r1, this.#time, this.#lampPhase);
        }
    }
}
function drawLamp(out, x, shoreTopY, bandH, lampH, r1) {
    const bulbY = shoreTopY - lampH;
    out.line(x, shoreTopY + bandH * 0.2, x, bulbY, Math.max(1, r1 * 0.4), darken(LAMP, 0.6));
    out.glow(x, bulbY, r1 * 4, withAlpha(LAMP, 0.5), 0.8);
    out.circle(x, bulbY, r1, LAMP);
}
function drawLampReflection(out, x, waterY, waterH, r1, time, phase) {
    if (waterH <= 0) return;
    const reflH = waterH * 0.6;
    const wob = Math.sin(time * 0.0011 + x * 0.05 + phase * 6) * r1 * 0.8;
    const w = r1 * 1.6;
    out.gradient(x - w / 2 + wob, waterY, w, reflH, [
        {
            at: 0,
            color: withAlpha(LAMP, 0.32)
        },
        {
            at: 1,
            color: withAlpha(LAMP, 0)
        }
    ], true);
}
function gridFor(rng, width, height, density = 1) {
    const cols = clamp(Math.round(width * 77 * density + rng.float(-1, 1)), 2, 8);
    const rows = clamp(Math.round(height * 46 * density + rng.float(-1, 1)), 1, 30);
    return {
        cols,
        rows
    };
}
const BUILDING_GENERATORS = {
    skyscraper (rng) {
        const height = rng.float(0.42, 0.74);
        const width = height * rng.float(0.18, 0.32);
        const { cols, rows } = gridFor(rng, width, height);
        return {
            kind: "skyscraper",
            width,
            height,
            roof: rng.weighted([
                "antenna",
                "flat",
                "spire",
                "tank"
            ], [
                4,
                3,
                2,
                1
            ]),
            roofScale: rng.float(0.5, 1),
            cols,
            rows,
            setbacks: rng.weighted([
                0,
                1,
                2
            ], [
                3,
                3,
                2
            ])
        };
    },
    tower (rng) {
        const height = rng.float(0.32, 0.56);
        const width = height * rng.float(0.3, 0.52);
        const { cols, rows } = gridFor(rng, width, height);
        return {
            kind: "tower",
            width,
            height,
            roof: rng.weighted([
                "flat",
                "tank",
                "dome",
                "antenna"
            ], [
                4,
                2,
                2,
                2
            ]),
            roofScale: rng.float(0.5, 1),
            cols,
            rows,
            setbacks: 0
        };
    },
    midrise (rng) {
        const height = rng.float(0.16, 0.34);
        const width = height * rng.float(0.85, 1.8);
        const { cols, rows } = gridFor(rng, width, height);
        return {
            kind: "midrise",
            width,
            height,
            roof: rng.weighted([
                "flat",
                "antenna",
                "tank"
            ], [
                5,
                2,
                2
            ]),
            roofScale: rng.float(0.4, 0.8),
            cols,
            rows,
            setbacks: 0
        };
    },
    house (rng) {
        const height = rng.float(0.06, 0.13);
        const width = height * rng.float(1.3, 2.4);
        return {
            kind: "house",
            width,
            height,
            roof: rng.weighted([
                "pitched",
                "flat"
            ], [
                3,
                2
            ]),
            roofScale: rng.float(0.5, 1),
            cols: rng.int(2, 5),
            rows: rng.int(1, 2),
            setbacks: 0
        };
    },
    factory (rng) {
        const height = rng.float(0.12, 0.22);
        const width = height * rng.float(2.2, 4.2);
        return {
            kind: "factory",
            width,
            height,
            roof: rng.weighted([
                "chimneys",
                "sawtooth"
            ], [
                3,
                2
            ]),
            roofScale: rng.float(0.6, 1),
            cols: rng.int(4, 9),
            rows: rng.int(1, 2),
            setbacks: 0
        };
    },
    landmark (rng) {
        const height = rng.float(0.56, 0.88);
        const width = height * rng.float(0.16, 0.28);
        const { cols, rows } = gridFor(rng, width, height, 0.8);
        return {
            kind: "landmark",
            width,
            height,
            roof: rng.weighted([
                "spire",
                "dome"
            ], [
                3,
                2
            ]),
            roofScale: rng.float(0.7, 1),
            cols,
            rows,
            setbacks: rng.weighted([
                0,
                1
            ], [
                2,
                3
            ])
        };
    }
};
function generateBuilding(kind, rng) {
    return BUILDING_GENERATORS[kind](rng);
}
const RULES = {
    downtown: {
        kinds: [
            "skyscraper",
            "tower",
            "landmark"
        ],
        kindWeights: [
            5,
            3,
            1
        ],
        gap: [
            -0.006,
            0.018
        ],
        run: [
            3,
            7
        ],
        next: [
            "downtown",
            "commercial",
            "park"
        ],
        nextWeights: [
            2,
            4,
            2
        ]
    },
    commercial: {
        kinds: [
            "tower",
            "midrise",
            "skyscraper"
        ],
        kindWeights: [
            3,
            4,
            1
        ],
        gap: [
            0.006,
            0.028
        ],
        run: [
            3,
            6
        ],
        next: [
            "commercial",
            "downtown",
            "residential",
            "park"
        ],
        nextWeights: [
            2,
            3,
            3,
            1
        ]
    },
    residential: {
        kinds: [
            "house",
            "midrise"
        ],
        kindWeights: [
            5,
            2
        ],
        gap: [
            0.01,
            0.04
        ],
        run: [
            4,
            8
        ],
        next: [
            "residential",
            "commercial",
            "park",
            "industrial"
        ],
        nextWeights: [
            3,
            3,
            2,
            2
        ]
    },
    industrial: {
        kinds: [
            "factory",
            "midrise"
        ],
        kindWeights: [
            4,
            1
        ],
        gap: [
            0.018,
            0.056
        ],
        run: [
            2,
            5
        ],
        next: [
            "industrial",
            "park",
            "residential"
        ],
        nextWeights: [
            2,
            3,
            3
        ]
    },
    park: {
        kinds: [
            null
        ],
        kindWeights: [
            1
        ],
        gap: [
            0.07,
            0.15
        ],
        run: [
            1,
            2
        ],
        next: [
            "downtown",
            "commercial",
            "residential",
            "industrial"
        ],
        nextWeights: [
            3,
            3,
            3,
            2
        ]
    }
};
class DistrictStream {
    #rng;
    #district;
    #remaining;
    constructor(rng, start = "commercial"){
        this.#rng = rng;
        this.#district = start;
        this.#remaining = this.#rollRun(start);
    }
    get district() {
        return this.#district;
    }
    #rollRun(d) {
        const [lo, hi] = RULES[d].run;
        return this.#rng.int(lo, hi);
    }
    next() {
        if (this.#remaining <= 0) {
            const rule = RULES[this.#district];
            this.#district = this.#rng.weighted(rule.next, rule.nextWeights);
            this.#remaining = this.#rollRun(this.#district);
        }
        this.#remaining--;
        const rule = RULES[this.#district];
        const kind = this.#rng.weighted(rule.kinds, rule.kindWeights);
        return {
            kind,
            gap: this.#rollGap(rule),
            district: this.#district
        };
    }
    #rollGap(rule) {
        const r1 = this.#rng.next();
        if (r1 < 0.16) return this.#rng.float(-0.006, 0.004);
        if (r1 > 0.84) {
            return this.#rng.float(rule.gap[1], rule.gap[1] + 0.12);
        }
        return this.#rng.float(rule.gap[0], rule.gap[1]);
    }
}
const SUBSTITUTE = {
    skyscraper: "tower",
    landmark: "tower",
    tower: "midrise",
    midrise: "house",
    house: "house",
    factory: "midrise"
};
class LayerSpawner {
    layer;
    depth;
    #shoreOffset;
    #scale;
    #rng;
    #streamR;
    #streamL;
    #pool = [];
    #right = 0;
    #left = 0;
    #init = false;
    #exclude;
    constructor(layer, rng, opts){
        this.layer = layer;
        this.depth = opts.depth;
        this.#shoreOffset = opts.shoreOffset;
        this.#scale = opts.scale;
        this.#rng = rng;
        this.#exclude = new Set(opts.excludeKinds ?? []);
        this.#streamR = new DistrictStream(rng.fork("right"));
        this.#streamL = new DistrictStream(rng.fork("left"));
    }
    #allow(kind) {
        let k = kind;
        for(let i = 0; i < 6 && this.#exclude.has(k); i++){
            const next = SUBSTITUTE[k];
            if (next === k) break;
            k = next;
        }
        return k;
    }
    sync(camera, width, env) {
        if (!this.#init) {
            this.#left = this.#right = camera.viewLeft(this.depth);
            this.#init = true;
        }
        const litChance = env.config.windowLightChance;
        let guard = 0;
        while(camera.project(this.#right, this.depth) < width + 340 && guard++ < 400){
            this.#placeRight(litChance);
        }
        guard = 0;
        while(camera.project(this.#left, this.depth) > -340 && guard++ < 400){
            this.#placeLeft(litChance);
        }
        this.#recycle(camera, width);
    }
    get pooled() {
        return this.#pool.length;
    }
    #obtain() {
        return this.#pool.pop() ?? new Building(this.depth, this.#rng.fork(this.layer.entities.length + 1));
    }
    #placeRight(litChance) {
        const slot = this.#streamR.next();
        const gap = slot.gap * this.#scale;
        if (slot.kind === null) {
            this.#right += gap;
            return;
        }
        const spec = generateBuilding(this.#allow(slot.kind), this.#rng);
        const leftEdge = this.#right + gap;
        const b = this.#obtain();
        b.reset(spec, leftEdge, this.#shoreOffset, this.#scale, litChance);
        this.layer.add(b);
        this.#right = leftEdge + b.bounds.width;
    }
    #placeLeft(litChance) {
        const slot = this.#streamL.next();
        const gap = slot.gap * this.#scale;
        if (slot.kind === null) {
            this.#left -= gap;
            return;
        }
        const spec = generateBuilding(this.#allow(slot.kind), this.#rng);
        const b = this.#obtain();
        const width = spec.width * this.#scale;
        const leftEdge = this.#left - gap - width;
        b.reset(spec, leftEdge, this.#shoreOffset, this.#scale, litChance);
        this.layer.add(b);
        this.#left = leftEdge;
    }
    #recycle(camera, width) {
        const list = this.layer.entities;
        let w = 0;
        let removed = false;
        for(let i = 0; i < list.length; i++){
            const b = list[i];
            const l = camera.project(b.bounds.x, this.depth);
            const r1 = camera.project(b.bounds.x + b.bounds.width, this.depth);
            if (r1 < -680 || l > width + 680) {
                if (b instanceof Building) this.#pool.push(b);
                removed = true;
            } else {
                list[w++] = b;
            }
        }
        list.length = w;
        if (removed) this.#recomputeEdges(camera);
    }
    #recomputeEdges(camera) {
        const list = this.layer.entities;
        if (list.length === 0) {
            this.#left = this.#right = camera.viewLeft(this.depth);
            return;
        }
        let lo = Infinity;
        let hi = -Infinity;
        for (const b of list){
            if (b.bounds.x < lo) lo = b.bounds.x;
            const right = b.bounds.x + b.bounds.width;
            if (right > hi) hi = right;
        }
        this.#left = lo;
        this.#right = hi;
    }
}
function buildSkyline(world, config, rng) {
    const sky = new Layer("sky", 0);
    sky.add(new SkyBackdrop());
    sky.add(new Starfield(rng.fork("stars")));
    sky.add(new Moon(rng.fork("moon")));
    sky.add(new FlyerDirector(rng.fork("flyer")));
    sky.add(new CloudField(rng.fork("clouds")));
    world.addLayer(sky);
    const n = Math.max(1, Math.round(config.parallaxLayers));
    const spawners = [];
    for(let i = 0; i < n; i++){
        const f = n === 1 ? 1 : i / (n - 1);
        const depth = lerp(0.6, 0.92, f);
        const scale = lerp(0.78, 1.05, f);
        const shoreOffset = (1 - f) * 0.05;
        const layer = new Layer(`buildings-${i}`, depth);
        world.addLayer(layer);
        const isFront = i === n - 1;
        spawners.push(new LayerSpawner(layer, rng.fork(`layer-${i}`), {
            depth,
            shoreOffset,
            scale,
            excludeKinds: isFront ? [
                "skyscraper"
            ] : undefined
        }));
    }
    const birds = new Layer("birds", 0.94);
    birds.add(new BirdDirector(rng.fork("birds")));
    world.addLayer(birds);
    const water = new Layer("water", 1);
    water.add(new Water(rng.fork("water")));
    world.addLayer(water);
    const shore = new Layer("shore", 1.1);
    shore.add(new Shore(rng.fork("shore")));
    world.addLayer(shore);
    return {
        spawners
    };
}
class Cityscape {
    config;
    events = new AmbientEventBus();
    time = 0;
    #world;
    #mood;
    #director;
    #spawners;
    #env;
    #seed = 0;
    constructor(config){
        this.config = config;
        this.#build();
    }
    get world() {
        return this.#world;
    }
    #build() {
        this.#seed = normalizeSeed(this.config.seed);
        const rng = createRng(this.#seed);
        this.#mood = new MoodEngine(this.config, this.#seed);
        this.#director = new AmbientDirector(rng.fork("ambient"), this.events);
        this.#world = new World(new Camera({
            speed: signedSpeed(this.config),
            minParallax: 0.18
        }));
        this.#env = {
            config: this.config,
            mood: this.#mood.mood,
            bus: this.events
        };
        const skyline = buildSkyline(this.#world, this.config, rng.fork("skyline"));
        this.#spawners = skyline.spawners;
    }
    resize(width, height) {
        this.#world.resize(width, height);
        if (width > 0 && height > 0) this.#tick(0);
    }
    update(dtMs) {
        if (!(dtMs > 0)) return;
        this.time += dtMs;
        this.#tick(dtMs);
    }
    #tick(dtMs) {
        const cam = this.#world.camera;
        cam.speed = signedSpeed(this.config);
        cam.zoom = this.config.zoom;
        const h = cam.height;
        const bob = Math.sin(this.time * 0.00013) * this.config.verticalDrift * h;
        cam.offsetY = clamp(this.config.cameraHeight * h + bob, -0.25 * h, 0.25 * h);
        this.#mood.update(this.time, this.config);
        if (dtMs > 0) this.#director.update(dtMs, this.config);
        cam.step(dtMs);
        for (const sp of this.#spawners)sp.sync(cam, cam.width, this.#env);
        this.#world.updateEntities({
            dt: dtMs,
            time: this.time,
            width: cam.width,
            height: cam.height,
            env: this.#env
        });
    }
    collect(width, height) {
        return this.#world.collect(width, height);
    }
    setConfig(patch) {
        const next = normalizeConfig({
            ...this.config,
            ...patch
        });
        const structural = next.seed !== this.config.seed || next.parallaxLayers !== this.config.parallaxLayers;
        const paletteChanged = next.palette !== this.config.palette;
        Object.assign(this.config, next);
        if (structural) {
            const cam = this.#world.camera;
            const { width, height } = cam;
            this.#build();
            this.resize(width, height);
        } else if (paletteChanged) {
            this.#mood.setPalette(this.config.palette);
        }
    }
    setSway(px, py = 0) {
        this.#world.camera.sway = px;
        this.#world.camera.swayY = py;
    }
    poke(screenX, _screenY) {
        const buildingLayers = this.#world.layers.filter((l)=>l.name.startsWith("buildings-"));
        for(let i = buildingLayers.length - 1; i >= 0; i--){
            const layer = buildingLayers[i];
            const cam = this.#world.camera;
            for (const e of layer.entities){
                if (!(e instanceof Building)) continue;
                const l = cam.project(e.bounds.x, layer.depth);
                const r1 = cam.project(e.bounds.x + e.bounds.width, layer.depth);
                if (screenX >= l && screenX <= r1) {
                    e.flash();
                    return;
                }
            }
        }
    }
}
function signedSpeed(config) {
    return config.cameraSpeed * (config.cameraDirection === "left" ? -1 : 1);
}
function createCityscape(config = {}) {
    return new Cityscape(normalizeConfig({
        ...DEFAULT_CONFIG,
        ...config
    }));
}
class CanvasRenderer {
    #ctx;
    #canvas;
    #dpr = 1;
    #width = 0;
    #height = 0;
    constructor(canvas){
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("CanvasRenderer: 2D context unavailable");
        this.#canvas = canvas;
        this.#ctx = ctx;
    }
    resize(width, height, dpr = 1) {
        this.#width = width;
        this.#height = height;
        this.#dpr = dpr;
        this.#canvas.width = Math.max(1, Math.round(width * dpr));
        this.#canvas.height = Math.max(1, Math.round(height * dpr));
        this.#canvas.style.width = `${width}px`;
        this.#canvas.style.height = `${height}px`;
    }
    render(list) {
        const ctx = this.#ctx;
        ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, list.offsetY * this.#dpr);
        if (list.commands.length === 0 || list.commands[0].kind !== "gradient") {
            ctx.clearRect(0, -list.offsetY, this.#width, this.#height);
        }
        for (const cmd of list.commands)this.#draw(ctx, cmd);
        ctx.globalCompositeOperation = "source-over";
    }
    #draw(ctx, cmd) {
        switch(cmd.kind){
            case "rect":
                ctx.fillStyle = toCss(cmd.color);
                ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h);
                return;
            case "polygon":
                {
                    const p = cmd.points;
                    if (p.length < 6) return;
                    ctx.fillStyle = toCss(cmd.color);
                    ctx.beginPath();
                    ctx.moveTo(p[0], p[1]);
                    for(let i = 2; i < p.length; i += 2)ctx.lineTo(p[i], p[i + 1]);
                    ctx.closePath();
                    ctx.fill();
                    return;
                }
            case "circle":
                ctx.fillStyle = toCss(cmd.color);
                ctx.beginPath();
                ctx.arc(cmd.x, cmd.y, Math.max(0, cmd.r), 0, Math.PI * 2);
                ctx.fill();
                return;
            case "gradient":
                {
                    const g = cmd.vertical ? ctx.createLinearGradient(cmd.x, cmd.y, cmd.x, cmd.y + cmd.h) : ctx.createLinearGradient(cmd.x, cmd.y, cmd.x + cmd.w, cmd.y);
                    for (const s of cmd.stops)g.addColorStop(clamp01(s.at), toCss(s.color));
                    ctx.fillStyle = g;
                    ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h);
                    return;
                }
            case "line":
                ctx.strokeStyle = toCss(cmd.color);
                ctx.lineWidth = cmd.width;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(cmd.x1, cmd.y1);
                ctx.lineTo(cmd.x2, cmd.y2);
                ctx.stroke();
                return;
            case "glow":
                {
                    const r1 = Math.max(0.5, cmd.r);
                    const g = ctx.createRadialGradient(cmd.x, cmd.y, 0, cmd.x, cmd.y, r1);
                    const c = cmd.color;
                    g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${c.a * cmd.intensity})`);
                    g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
                    ctx.globalCompositeOperation = "lighter";
                    ctx.fillStyle = g;
                    ctx.fillRect(cmd.x - r1, cmd.y - r1, r1 * 2, r1 * 2);
                    ctx.globalCompositeOperation = "source-over";
                    return;
                }
            case "text":
                ctx.fillStyle = toCss(cmd.color);
                ctx.font = `${cmd.size}px ui-monospace, monospace`;
                ctx.textBaseline = "top";
                ctx.fillText(cmd.text, cmd.x, cmd.y);
                return;
        }
    }
}
function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
class AmbientAudio {
    #bus;
    #unsub;
    #ctx = null;
    #master = null;
    #droneGain = null;
    #noise = null;
    #enabled = false;
    #volume = 0.5;
    constructor(bus){
        this.#bus = bus;
        this.#unsub = bus.on((e)=>this.#cue(e));
    }
    setEnabled(on) {
        this.#enabled = on;
        if (on) {
            this.#ensure();
            this.#ctx?.resume().catch(()=>{});
        }
        this.#applyGain();
    }
    setVolume(v) {
        this.#volume = Math.max(0, Math.min(1, v));
        this.#applyGain();
    }
    resume() {
        this.#ctx?.resume().catch(()=>{});
    }
    destroy() {
        this.#unsub();
        this.#ctx?.close().catch(()=>{});
        this.#ctx = null;
    }
    #applyGain() {
        if (!this.#master || !this.#ctx) return;
        const target = this.#enabled ? this.#volume : 0;
        const now = this.#ctx.currentTime;
        this.#master.gain.cancelScheduledValues(now);
        this.#master.gain.setTargetAtTime(target, now, 0.4);
    }
    #ensure() {
        if (this.#ctx) return;
        const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        this.#ctx = ctx;
        this.#master = ctx.createGain();
        this.#master.gain.value = 0;
        this.#master.connect(ctx.destination);
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for(let i = 0; i < data.length; i++)data[i] = Math.random() * 2 - 1;
        this.#noise = buf;
        this.#startDrone();
        this.#applyGain();
    }
    #startDrone() {
        const ctx = this.#ctx;
        const drone = ctx.createGain();
        drone.gain.value = 0.16;
        this.#droneGain = drone;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 420;
        lp.Q.value = 0.7;
        drone.connect(lp).connect(this.#master);
        for (const f of [
            55,
            82.5,
            110
        ]){
            const osc = ctx.createOscillator();
            osc.type = "sine";
            osc.frequency.value = f;
            osc.detune.value = (Math.random() - 0.5) * 8;
            const g = ctx.createGain();
            g.gain.value = 0.5;
            osc.connect(g).connect(drone);
            osc.start();
        }
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 140;
        lfo.connect(lfoGain).connect(lp.frequency);
        lfo.start();
    }
    #cue(e) {
        if (!this.#enabled || !this.#ctx || !this.#master) return;
        const ctx = this.#ctx;
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, e.pan));
        pan.connect(this.#master);
        switch(e.type){
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
    #horn(ctx, out, intensity) {
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
        for (const f of [
            277,
            350
        ]){
            const o = ctx.createOscillator();
            o.type = "sawtooth";
            o.frequency.value = f;
            o.connect(g);
            o.start(now);
            o.stop(now + 1.15);
        }
    }
    #wind(ctx, out, intensity) {
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
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peak, now + 1.0);
        g.gain.linearRampToValueAtTime(0, now + 3.2);
        bp.frequency.setValueAtTime(420, now);
        bp.frequency.linearRampToValueAtTime(760, now + 3.2);
        src.start(now);
        src.stop(now + 3.2 + 0.1);
    }
    #rumble(ctx, out, intensity) {
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
    #chime(ctx, out, intensity) {
        const now = ctx.currentTime;
        for (const [f, t] of [
            [
                880,
                0
            ],
            [
                1320,
                0.04
            ]
        ]){
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
const rafScheduler = (cb)=>{
    const id = requestAnimationFrame(cb);
    return ()=>cancelAnimationFrame(id);
};
function mountCityscape(opts = {}) {
    const container = opts.container ?? document.body;
    const maxDpr = opts.maxDpr ?? 2;
    const interaction = opts.interaction ?? true;
    const canvas = opts.canvas ?? document.createElement("canvas");
    if (!opts.canvas) {
        canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
        container.append(canvas);
    }
    let initial = {
        ...opts.config
    };
    if (opts.readHash ?? true) {
        const fromHash = decodeFromHash(globalThis.location?.hash ?? "");
        if (fromHash) initial = {
            ...initial,
            ...fromHash
        };
    }
    if ((opts.randomizeSeed ?? true) && !initial.seed) {
        initial.seed = Math.random().toString(36).slice(2, 9);
    }
    const scene = createCityscape(initial);
    const canvasRenderer = new CanvasRenderer(canvas);
    let renderer = canvasRenderer;
    const audio = new AmbientAudio(scene.events);
    audio.setVolume(scene.config.audioVolume);
    if (scene.config.audioEnabled) audio.setEnabled(true);
    const stats = document.createElement("div");
    stats.style.cssText = "position:fixed;left:16px;top:16px;z-index:9;display:none;" + "font:11px/1.5 ui-monospace,Menlo,monospace;white-space:pre;padding:8px 10px;" + "border-radius:8px;pointer-events:none;color:#cfe0ff;" + "background:rgba(10,16,32,0.7);border:1px solid rgba(120,140,200,0.2);";
    container.append(stats);
    let fps = 0;
    let lastFrame = 0;
    let statsAccum = 0;
    const configListeners = new Set();
    let vw = 0;
    let vh = 0;
    const resize = ()=>{
        const rect = opts.canvas ? canvas.getBoundingClientRect() : {
            width: container.clientWidth,
            height: container.clientHeight
        };
        vw = Math.max(1, Math.round(rect.width || globalThis.innerWidth));
        vh = Math.max(1, Math.round(rect.height || globalThis.innerHeight));
        const dpr = Math.min(maxDpr, globalThis.devicePixelRatio || 1);
        scene.resize(vw, vh);
        renderer.resize(vw, vh, dpr);
    };
    const pointer = createPointerState();
    let swayCurrent = 0;
    let swayYCurrent = 0;
    const engine = new Engine({
        scheduler: rafScheduler,
        step: (dt)=>scene.update(dt),
        render: ()=>{
            if (interaction) {
                const on = scene.config.pointerParallax;
                const swayTarget = on ? parallaxSway(pointer, vw, 42) : 0;
                const swayYTarget = on && pointer.inside ? (pointer.y / vh * 2 - 1) * 26 : 0;
                swayCurrent = lerp(swayCurrent, swayTarget, 0.08);
                swayYCurrent = lerp(swayYCurrent, swayYTarget, 0.08);
                scene.setSway(swayCurrent, swayYCurrent);
            }
            const list = scene.collect(vw, vh);
            renderer.render(list);
            updateStats(list.commands.length);
        }
    });
    const updateStats = (commandCount)=>{
        const now = (globalThis.performance ?? Date).now();
        if (lastFrame) {
            const dt = now - lastFrame;
            if (dt > 0) fps = fps ? fps * 0.9 + 1000 / dt * 0.1 : 1000 / dt;
            statsAccum += dt;
        }
        lastFrame = now;
        if (!scene.config.showStats) {
            if (stats.style.display !== "none") stats.style.display = "none";
            return;
        }
        stats.style.display = "block";
        if (statsAccum < 200) return;
        statsAccum = 0;
        let entities = 0;
        for (const layer of scene.world.layers)entities += layer.entities.length;
        stats.textContent = `${Math.round(fps)} fps   ${vw}×${vh}\n${entities} entities · ${commandCount} draws` + `\nseed ${scene.config.seed} · ${scene.config.palette}`;
    };
    const applyRuntime = (patch)=>{
        if ("audioEnabled" in patch) audio.setEnabled(!!patch.audioEnabled);
        if ("audioVolume" in patch) audio.setVolume(scene.config.audioVolume);
        if (opts.writeHash) writeHash();
    };
    const update = (patch)=>{
        scene.setConfig(patch);
        applyRuntime(patch);
    };
    const writeHash = ()=>{
        if (!globalThis.history?.replaceState) return;
        globalThis.history.replaceState(null, "", `#${encodeToHash(scene.config)}`);
    };
    const permalink = ()=>{
        const loc = globalThis.location;
        const base = loc ? `${loc.origin}${loc.pathname}` : "";
        return `${base}#${encodeToHash(scene.config)}`;
    };
    const cleanups = [];
    const on = (target, type, fn, options)=>{
        target.addEventListener(type, fn, options);
        cleanups.push(()=>target.removeEventListener(type, fn, options));
    };
    on(globalThis, "resize", ()=>resize());
    let wasRunning = false;
    on(document, "visibilitychange", ()=>{
        if (document.hidden) {
            wasRunning = engine.running;
            engine.stop();
        } else if (wasRunning) {
            engine.start();
        }
    });
    if (interaction) {
        on(canvas, "pointermove", (e)=>{
            const pe = e;
            pointer.x = pe.clientX;
            pointer.y = pe.clientY;
            pointer.inside = true;
        });
        on(canvas, "pointerleave", ()=>pointer.inside = false);
        on(canvas, "pointerdown", (e)=>{
            const pe = e;
            audio.resume();
            pointer.down = true;
            scene.poke(pe.clientX, pe.clientY);
        });
        on(canvas, "pointerup", ()=>pointer.down = false);
        on(canvas, "wheel", (e)=>{
            const delta = e.deltaY < 0 ? 3 : -3;
            const cameraSpeed = clamp(scene.config.cameraSpeed + delta, 0, 120);
            update({
                cameraSpeed
            });
            for (const fn of configListeners)fn(scene.config);
        }, {
            passive: true
        });
    }
    resize();
    if (opts.autoStart ?? true) engine.start();
    return {
        scene,
        engine,
        canvas,
        audio,
        get renderer () {
            return renderer;
        },
        set renderer (r){
            renderer = r;
            resize();
        },
        setRenderer (r1) {
            renderer = r1;
            resize();
        },
        update,
        onConfigChange (fn) {
            configListeners.add(fn);
            return ()=>configListeners.delete(fn);
        },
        permalink,
        start: ()=>engine.start(),
        stop: ()=>engine.stop(),
        destroy () {
            engine.stop();
            for (const c of cleanups)c();
            audio.destroy();
            canvasRenderer.dispose?.();
            if (renderer !== canvasRenderer) renderer.dispose?.();
            stats.remove();
            if (!opts.canvas) canvas.remove();
        }
    };
}
const Scheduler = (()=>{
    const queues = {
        microtask: {
            map: new Map(),
            scheduled: false,
            arm: (cb)=>queueMicrotask(cb)
        },
        raf: {
            map: new Map(),
            scheduled: false,
            arm: (cb)=>requestAnimationFrame(cb)
        }
    };
    let flushing = false;
    let chainDepth = 0;
    function flush(kind) {
        const q = queues[kind];
        const entries = q.map;
        q.map = new Map();
        q.scheduled = false;
        flushing = true;
        try {
            entries.forEach((read, fn)=>fn(read()));
        } finally{
            flushing = false;
        }
    }
    function enqueue(fn, kind, read) {
        const q = queues[kind] ?? queues.microtask;
        const arming = !q.scheduled;
        if (arming) {
            if (flushing) {
                if (++chainDepth > 1000) {
                    chainDepth = 0;
                    throw new Error(`vanilla: maximum update depth exceeded (${1000}) — ` + `likely a feedback loop where an effect's set() retriggers ` + `itself (a writes b, b writes a, …). Check your reactTo/computed ` + `wiring, or make the loop converge so the equality guard can ` + `stop it.`);
                }
            } else {
                chainDepth = 0;
            }
        }
        q.map.set(fn, read);
        if (arming) {
            q.scheduled = true;
            q.arm(()=>flush(kind));
        }
    }
    return {
        enqueue
    };
})();
let computing = 0;
function observable(value) {
    const subs = new Map();
    function notify() {
        subs.forEach((kind, fn)=>Scheduler.enqueue(fn, kind, ()=>value));
    }
    const self = {
        get: ()=>value,
        set (v) {
            if (computing > 0) {
                throw new Error("vanilla: cannot set() an observable from inside a computed's " + "calc — calc must be a pure derivation of its sources (no writes " + "/ side effects). Move the write into a reactTo(...) effect.");
            }
            if (v === value) return;
            value = v;
            notify();
        },
        update (fn) {
            self.set(fn(value));
        },
        subscribe (fn, { immediate = true, scheduler = "microtask" } = {}) {
            subs.set(fn, scheduler);
            if (immediate) fn(value);
            return ()=>{
                subs.delete(fn);
            };
        }
    };
    return self;
}
function reactTo(sources, fn, { immediate = true, scheduler = "microtask" } = {}) {
    const unsubs = sources.map((o)=>o.subscribe(fn, {
            immediate: false,
            scheduler
        }));
    if (immediate) fn();
    return ()=>unsubs.forEach((u)=>u());
}
new Map();
new Map();
const STYLE_ID = "cityscape-panel-style";
function createControlPanel(opts) {
    ensureStyles();
    const schema = opts.schema ?? CONFIG_SCHEMA;
    const unsubs = [];
    const setters = new Map();
    const collapsed = observable(opts.collapsed ?? false);
    const root = el("div", "cityscape-panel");
    const header = el("div", "csp-header");
    const heading = el("div", "csp-title");
    heading.textContent = opts.title ?? "Cityscape";
    const spacer = el("div", "csp-spacer");
    const shuffleBtn = button("⟳", "Shuffle seed", ()=>{
        const seed = randomSeed();
        setters.get("seed")?.(seed);
        opts.onChange({
            seed
        });
    });
    const shareBtn = opts.onShare ? button("🔗", "Copy link", ()=>opts.onShare()) : null;
    const collapseBtn = button("▾", "Collapse", ()=>collapsed.update((c)=>!c));
    header.append(heading, spacer, shuffleBtn);
    if (shareBtn) header.append(shareBtn);
    header.append(collapseBtn);
    const body = el("div", "csp-body");
    const groups = opts.schema ? deriveGroups(schema) : GROUP_ORDER;
    for (const group of groups){
        const fields = schema.filter((f)=>f.group === group);
        if (fields.length === 0) continue;
        const section = el("div", "csp-group");
        const gh = el("div", "csp-group-title");
        gh.textContent = group;
        section.append(gh);
        for (const f of fields){
            section.append(buildField(f, opts.config, opts.onChange, setters));
        }
        body.append(section);
    }
    root.append(header, body);
    unsubs.push(reactTo([
        collapsed
    ], ()=>{
        const c = collapsed.get();
        root.classList.toggle("csp-collapsed", c);
        collapseBtn.textContent = c ? "▸" : "▾";
        collapseBtn.title = c ? "Expand" : "Collapse";
    }));
    return {
        el: root,
        set (config) {
            for (const f of schema){
                setters.get(f.key)?.(config[f.key]);
            }
        },
        toggle (collapse) {
            collapsed.set(typeof collapse === "boolean" ? collapse : !collapsed.get());
        },
        destroy () {
            for (const u of unsubs)u();
            root.remove();
        }
    };
}
function buildField(f, config, onChange, setters) {
    const row = el("label", "csp-field");
    row.title = f.help ?? "";
    const labelRow = el("div", "csp-label");
    const name = el("span", "csp-name");
    name.textContent = f.label;
    const value = el("span", "csp-value");
    labelRow.append(name, value);
    const current = config[f.key];
    let control;
    switch(f.type){
        case "range":
            {
                const input = document.createElement("input");
                input.type = "range";
                input.min = String(f.min);
                input.max = String(f.max);
                input.step = String(f.step);
                input.value = String(current);
                value.textContent = fmt(Number(current), f.unit);
                input.addEventListener("input", ()=>{
                    const v = Number(input.value);
                    value.textContent = fmt(v, f.unit);
                    onChange({
                        [f.key]: v
                    });
                });
                setters.set(f.key, (v)=>{
                    input.value = String(v);
                    value.textContent = fmt(Number(v), f.unit);
                });
                control = input;
                break;
            }
        case "select":
            {
                const sel = document.createElement("select");
                for (const o of f.options){
                    const opt = document.createElement("option");
                    opt.value = o.value;
                    opt.textContent = o.label;
                    sel.append(opt);
                }
                sel.value = String(current);
                sel.addEventListener("change", ()=>onChange({
                        [f.key]: sel.value
                    }));
                setters.set(f.key, (v)=>sel.value = String(v));
                control = sel;
                break;
            }
        case "toggle":
            {
                const input = document.createElement("input");
                input.type = "checkbox";
                input.className = "csp-toggle";
                input.checked = Boolean(current);
                input.addEventListener("change", ()=>onChange({
                        [f.key]: input.checked
                    }));
                setters.set(f.key, (v)=>input.checked = Boolean(v));
                control = input;
                break;
            }
        case "seed":
            {
                const input = document.createElement("input");
                input.type = "text";
                input.className = "csp-seed";
                input.value = String(current);
                input.spellcheck = false;
                input.addEventListener("change", ()=>onChange({
                        [f.key]: input.value
                    }));
                setters.set(f.key, (v)=>input.value = String(v));
                control = input;
                break;
            }
    }
    row.append(labelRow, control);
    return row;
}
function el(tag, className) {
    const e = document.createElement(tag);
    e.className = className;
    return e;
}
function button(label, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "csp-btn";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", onClick);
    return b;
}
function fmt(v, unit) {
    const n = Math.abs(v) < 1 && v !== 0 ? v.toFixed(2) : Math.round(v * 100) / 100;
    return unit ? `${n}${unit}` : String(n);
}
function randomSeed() {
    return Math.random().toString(36).slice(2, 9);
}
function deriveGroups(schema) {
    const seen = [];
    for (const f of schema)if (!seen.includes(f.group)) seen.push(f.group);
    return seen;
}
function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = PANEL_CSS;
    document.head.append(style);
}
const PANEL_CSS = `
.cityscape-panel, .cityscape-panel * { box-sizing: border-box; }
.cityscape-panel {
	position: fixed;
	top: 16px;
	right: 16px;
	z-index: 10;
	width: 248px;
	max-height: calc(100vh - 32px);
	display: flex;
	flex-direction: column;
	font: 12px/1.4 ui-sans-serif, system-ui, sans-serif;
	color: var(--app-color-foreground, #dbe4ff);
	background: var(--app-color-surface, rgba(14, 20, 38, 0.82));
	border: 1px solid var(--app-color-border, rgba(120, 140, 200, 0.22));
	border-radius: 12px;
	backdrop-filter: blur(10px);
	box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
	overflow: hidden;
	user-select: none;
}
.csp-header {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 10px 12px;
	border-bottom: 1px solid var(--app-color-border, rgba(120, 140, 200, 0.18));
}
.csp-title { font-weight: 600; letter-spacing: 0.02em; }
.csp-spacer { flex: 1; }
.csp-btn {
	width: 26px; height: 26px;
	display: inline-flex; align-items: center; justify-content: center;
	border: 1px solid var(--app-color-border, rgba(120, 140, 200, 0.22));
	border-radius: 7px;
	background: var(--app-color-muted, rgba(255, 255, 255, 0.05));
	color: inherit; cursor: pointer; font-size: 13px; line-height: 1;
}
.csp-btn:hover { background: var(--app-color-muted-hover, rgba(255, 255, 255, 0.12)); }
.csp-body {
	padding: 10px 12px 14px;
	overflow-y: auto;
	overflow-x: hidden;
	display: flex; flex-direction: column; gap: 14px;
}
.cityscape-panel.csp-collapsed .csp-body { display: none; }
.csp-group { display: flex; flex-direction: column; gap: 8px; }
.csp-group-title {
	font-size: 10px; text-transform: uppercase; letter-spacing: 0.09em;
	color: var(--app-color-muted-foreground, #8a96c0);
}
.csp-field { display: flex; flex-direction: column; gap: 4px; cursor: default; }
.csp-label { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.csp-name { color: var(--app-color-foreground, #cfd8f5); }
.csp-value {
	font-variant-numeric: tabular-nums;
	color: var(--app-color-muted-foreground, #8a96c0); font-size: 11px;
}
.csp-field input[type="range"] {
	width: 100%; height: 4px; appearance: none; -webkit-appearance: none;
	background: var(--app-color-border, rgba(120, 140, 200, 0.25));
	border-radius: 99px; outline: none; cursor: pointer;
}
.csp-field input[type="range"]::-webkit-slider-thumb {
	appearance: none; -webkit-appearance: none; width: 13px; height: 13px;
	border-radius: 50%; background: var(--app-color-primary, #7aa2ff); cursor: pointer;
	box-shadow: 0 0 0 3px var(--app-color-primary-soft, rgba(122, 162, 255, 0.2));
}
.csp-field input[type="range"]::-moz-range-thumb {
	width: 13px; height: 13px; border: none; border-radius: 50%;
	background: var(--app-color-primary, #7aa2ff); cursor: pointer;
}
.csp-field select, .csp-seed {
	width: 100%; font: inherit; padding: 5px 7px;
	color: inherit;
	background: var(--app-color-input, rgba(255, 255, 255, 0.06));
	border: 1px solid var(--app-color-border, rgba(120, 140, 200, 0.22));
	border-radius: 7px; outline: none; cursor: pointer;
}
.csp-seed { cursor: text; }
.csp-field:has(.csp-toggle) { flex-direction: row; align-items: center; justify-content: space-between; }
.csp-field:has(.csp-toggle) .csp-label { flex: 1; }
.csp-toggle { width: 16px; height: 16px; accent-color: var(--app-color-primary, #7aa2ff); cursor: pointer; }
`;
const RAMP = " .,:;-=+*oO%#@";
class AsciiRenderer {
    #cols = 0;
    #rows = 0;
    #cellW;
    #cellH;
    #ramp;
    #buf = new Float32Array(0);
    #vw = 0;
    #vh = 0;
    #offsetY = 0;
    constructor(opts = {}){
        this.#cellW = opts.cellWidth ?? 7;
        this.#cellH = opts.cellHeight ?? 13;
        this.#ramp = opts.ramp ?? RAMP;
    }
    get cols() {
        return this.#cols;
    }
    get rows() {
        return this.#rows;
    }
    resize(width, height) {
        this.#vw = width;
        this.#vh = height;
        this.#cols = Math.max(1, Math.round(width / this.#cellW));
        this.#rows = Math.max(1, Math.round(height / this.#cellH));
        this.#buf = new Float32Array(this.#cols * this.#rows);
    }
    render(list) {
        if (list.width > 0) this.#vw = list.width;
        if (list.height > 0) this.#vh = list.height;
        this.#offsetY = list.offsetY;
        this.#buf.fill(0);
        for (const cmd of list.commands)this.#rasterize(cmd);
    }
    toString() {
        const ramp = this.#ramp;
        const last = ramp.length - 1;
        const out = [];
        for(let r1 = 0; r1 < this.#rows; r1++){
            let line = "";
            for(let c = 0; c < this.#cols; c++){
                const v = clamp(this.#buf[r1 * this.#cols + c], 0, 1);
                line += ramp[Math.round(v * last)];
            }
            out.push(line);
        }
        return out.join("\n");
    }
    get buffer() {
        return this.#buf;
    }
    #toCol(x) {
        return x / this.#vw * this.#cols;
    }
    #toRow(y) {
        return (y + this.#offsetY) / this.#vh * this.#rows;
    }
    #blend(cx, cy, lum, a) {
        if (cx < 0 || cy < 0 || cx >= this.#cols || cy >= this.#rows) return;
        const i = cy * this.#cols + cx;
        this.#buf[i] = this.#buf[i] * (1 - a) + lum * a;
    }
    #add(cx, cy, v) {
        if (cx < 0 || cy < 0 || cx >= this.#cols || cy >= this.#rows) return;
        const i = cy * this.#cols + cx;
        this.#buf[i] = clamp(this.#buf[i] + v, 0, 1);
    }
    #fillRect(x, y, w, h, lum, a) {
        const c0 = Math.max(0, Math.floor(this.#toCol(x)));
        const c1 = Math.min(this.#cols - 1, Math.ceil(this.#toCol(x + w)) - 1);
        const r0 = Math.max(0, Math.floor(this.#toRow(y)));
        const r1 = Math.min(this.#rows - 1, Math.ceil(this.#toRow(y + h)) - 1);
        for(let r2 = r0; r2 <= r1; r2++){
            for(let c = c0; c <= c1; c++)this.#blend(c, r2, lum, a);
        }
    }
    #rasterize(cmd) {
        switch(cmd.kind){
            case "rect":
                this.#fillRect(cmd.x, cmd.y, cmd.w, cmd.h, luminance(cmd.color), cmd.color.a);
                return;
            case "gradient":
                {
                    const c0 = Math.max(0, Math.floor(this.#toCol(cmd.x)));
                    const c1 = Math.min(this.#cols - 1, Math.ceil(this.#toCol(cmd.x + cmd.w)) - 1);
                    const r0 = Math.max(0, Math.floor(this.#toRow(cmd.y)));
                    const r1 = Math.min(this.#rows - 1, Math.ceil(this.#toRow(cmd.y + cmd.h)) - 1);
                    for(let r2 = r0; r2 <= r1; r2++){
                        for(let c = c0; c <= c1; c++){
                            const t = cmd.vertical ? (r2 - r0) / Math.max(1, r1 - r0) : (c - c0) / Math.max(1, c1 - c0);
                            const col = sampleStops(cmd.stops, t);
                            this.#blend(c, r2, luminance(col), col.a);
                        }
                    }
                    return;
                }
            case "circle":
                {
                    const rc = this.#toCol(cmd.x);
                    const rr = this.#toRow(cmd.y);
                    const radC = cmd.r / this.#vw * this.#cols;
                    const radR = cmd.r / this.#vh * this.#rows;
                    const lum = luminance(cmd.color);
                    const c0 = Math.max(0, Math.floor(rc - radC));
                    const c1 = Math.min(this.#cols - 1, Math.ceil(rc + radC));
                    const r0 = Math.max(0, Math.floor(rr - radR));
                    const r1 = Math.min(this.#rows - 1, Math.ceil(rr + radR));
                    for(let r2 = r0; r2 <= r1; r2++){
                        for(let c = c0; c <= c1; c++){
                            const dx = (c + 0.5 - rc) / Math.max(0.01, radC);
                            const dy = (r2 + 0.5 - rr) / Math.max(0.01, radR);
                            if (dx * dx + dy * dy <= 1) this.#blend(c, r2, lum, cmd.color.a);
                        }
                    }
                    return;
                }
            case "line":
                {
                    const x0 = this.#toCol(cmd.x1);
                    const y0 = this.#toRow(cmd.y1);
                    const x1 = this.#toCol(cmd.x2);
                    const y1 = this.#toRow(cmd.y2);
                    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
                    const lum = luminance(cmd.color);
                    for(let s = 0; s <= steps; s++){
                        const t = s / steps;
                        this.#blend(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), lum, cmd.color.a);
                    }
                    return;
                }
            case "glow":
                {
                    const rc = this.#toCol(cmd.x);
                    const rr = this.#toRow(cmd.y);
                    const radC = cmd.r / this.#vw * this.#cols;
                    const radR = cmd.r / this.#vh * this.#rows;
                    const peak = luminance(cmd.color) * cmd.intensity * cmd.color.a;
                    const c0 = Math.max(0, Math.floor(rc - radC));
                    const c1 = Math.min(this.#cols - 1, Math.ceil(rc + radC));
                    const r0 = Math.max(0, Math.floor(rr - radR));
                    const r1 = Math.min(this.#rows - 1, Math.ceil(rr + radR));
                    for(let r2 = r0; r2 <= r1; r2++){
                        for(let c = c0; c <= c1; c++){
                            const dx = (c + 0.5 - rc) / Math.max(0.01, radC);
                            const dy = (r2 + 0.5 - rr) / Math.max(0.01, radR);
                            const d = dx * dx + dy * dy;
                            if (d <= 1) this.#add(c, r2, peak * (1 - d) * 0.5);
                        }
                    }
                    return;
                }
            case "polygon":
                this.#fillPolygon(cmd.points, luminance(cmd.color), cmd.color.a);
                return;
            case "text":
                for(let i = 0; i < cmd.text.length; i++){
                    const c = Math.floor(this.#toCol(cmd.x)) + i;
                    const r1 = Math.floor(this.#toRow(cmd.y));
                    this.#blend(c, r1, luminance(cmd.color), cmd.color.a);
                }
                return;
        }
    }
    #fillPolygon(points, lum, a) {
        let minY = Infinity;
        let maxY = -Infinity;
        const n = points.length / 2;
        for(let i = 0; i < n; i++){
            const y = this.#toRow(points[i * 2 + 1]);
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        const r0 = Math.max(0, Math.floor(minY));
        const r1 = Math.min(this.#rows - 1, Math.ceil(maxY));
        for(let r2 = r0; r2 <= r1; r2++){
            const yc = r2 + 0.5;
            const xs = [];
            for(let i = 0; i < n; i++){
                const ax = this.#toCol(points[i * 2]);
                const ay = this.#toRow(points[i * 2 + 1]);
                const bx = this.#toCol(points[(i + 1) % n * 2]);
                const by = this.#toRow(points[(i + 1) % n * 2 + 1]);
                if (ay <= yc && by > yc || by <= yc && ay > yc) {
                    xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
                }
            }
            xs.sort((p, q)=>p - q);
            for(let k = 0; k + 1 < xs.length; k += 2){
                const c0 = Math.max(0, Math.floor(xs[k]));
                const c1 = Math.min(this.#cols - 1, Math.ceil(xs[k + 1]) - 1);
                for(let c = c0; c <= c1; c++)this.#blend(c, r2, lum, a);
            }
        }
    }
}
function sampleStops(stops, t) {
    if (stops.length === 0) return {
        r: 0,
        g: 0,
        b: 0,
        a: 0
    };
    if (t <= stops[0].at) return stops[0].color;
    const lastStop = stops[stops.length - 1];
    if (t >= lastStop.at) return lastStop.color;
    for(let i = 0; i + 1 < stops.length; i++){
        const a = stops[i];
        const b = stops[i + 1];
        if (t >= a.at && t <= b.at) {
            const k = (t - a.at) / Math.max(1e-6, b.at - a.at);
            return {
                r: a.color.r + (b.color.r - a.color.r) * k,
                g: a.color.g + (b.color.g - a.color.g) * k,
                b: a.color.b + (b.color.b - a.color.b) * k,
                a: a.color.a + (b.color.a - a.color.a) * k
            };
        }
    }
    return lastStop.color;
}
const handle = mountCityscape({
    writeHash: true
});
const canvasRenderer = handle.renderer;
const toast = document.createElement("div");
toast.className = "cs-toast";
document.body.append(toast);
let toastTimer = 0;
function flash(msg) {
    toast.textContent = msg;
    toast.classList.add("cs-toast-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>toast.classList.remove("cs-toast-show"), 1400);
}
const panel = createControlPanel({
    config: handle.scene.config,
    onChange: (patch)=>handle.update(patch),
    onShare: async ()=>{
        try {
            await navigator.clipboard.writeText(handle.permalink());
            flash("Permalink copied");
        } catch  {
            flash("Copy failed");
        }
    }
});
document.body.append(panel.el);
handle.onConfigChange((cfg)=>panel.set(cfg));
const pre = document.createElement("pre");
pre.id = "ascii";
document.body.append(pre);
const ascii = new AsciiRenderer({
    cellWidth: 7,
    cellHeight: 12
});
const asciiAdapter = {
    resize: (w, h)=>ascii.resize(w, h),
    render: (list)=>{
        ascii.render(list);
        pre.textContent = ascii.toString();
    }
};
let asciiOn = false;
function setAscii(on) {
    asciiOn = on;
    pre.style.display = on ? "block" : "none";
    handle.canvas.style.opacity = on ? "0" : "1";
    handle.setRenderer(on ? asciiAdapter : canvasRenderer);
    asciiBtn.textContent = on ? "Canvas view" : "ASCII view";
}
const bar = document.createElement("div");
bar.className = "cs-bar";
const asciiBtn = document.createElement("button");
asciiBtn.className = "cs-bar-btn";
asciiBtn.textContent = "ASCII view";
asciiBtn.addEventListener("click", ()=>setAscii(!asciiOn));
const hint = document.createElement("span");
hint.className = "cs-hint";
hint.textContent = "move = parallax · wheel = speed · click = flash windows · keys: a / h";
bar.append(asciiBtn, hint);
document.body.append(bar);
addEventListener("keydown", (e)=>{
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
    }
    if (e.key === "a") setAscii(!asciiOn);
    else if (e.key === "h") panel.toggle();
});
Object.assign(globalThis, {
    handle,
    panel
});
