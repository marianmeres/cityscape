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
        const raw = time - this.#last;
        this.#last = time;
        if (raw > this.#maxFrameDelta) {
            const { alpha } = this.stepper.advance(0, this.#opts.step);
            this.#opts.render(alpha);
            this.#schedule();
            return;
        }
        const delta = clamp(raw, 0, this.#maxFrameDelta);
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
function buildDefaults(schema) {
    const out = {};
    for (const f of schema)out[f.key] = f.default;
    return out;
}
function normalizeConfig(schema, input) {
    const src = input && typeof input === "object" ? input : {};
    const out = {};
    for (const f of schema)out[f.key] = normalizeField(f, src[f.key]);
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
function deriveGroups(schema) {
    const seen = [];
    for (const f of schema)if (!seen.includes(f.group)) seen.push(f.group);
    return seen;
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
        default: 30,
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
        default: 0.5,
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
        default: -0.08,
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
        default: 0,
        help: "Amount of slow automatic up/down float. 0 holds still."
    },
    {
        key: "pointerParallax",
        label: "Pointer parallax",
        group: "Camera",
        type: "toggle",
        default: false,
        help: "Layers sway slightly toward the pointer (horizontally and vertically)."
    },
    {
        key: "seed",
        label: "Seed",
        group: "World",
        type: "seed",
        default: "hey ho lets go",
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
        default: 0.5,
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
        default: 0.1,
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
        key: "buildingShading",
        label: "Facade light",
        group: "World",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        help: "Soft top-light on near buildings so silhouettes read as volumes. 0 = flat."
    },
    {
        key: "neon",
        label: "Neon signs",
        group: "World",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.4,
        help: "Rare hue-cycling rooftop signs on near city buildings. 0 = none."
    },
    {
        key: "biomeVariety",
        label: "Biome journey",
        group: "World",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.3,
        help: "Drift between dense city and open outskirts as you scroll. 0 = uniform city."
    },
    {
        key: "biomeScale",
        label: "Region length",
        group: "World",
        type: "range",
        min: 1,
        max: 12,
        step: 0.5,
        default: 4.5,
        help: "How long each city/outskirts stretch lasts (world units). Higher = longer."
    },
    {
        key: "palette",
        label: "Palette",
        group: "Mood",
        type: "select",
        default: "dawn",
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
        default: 0.76
    },
    {
        key: "colorTemperature",
        label: "Temperature",
        group: "Mood",
        type: "range",
        min: 0,
        max: 1,
        step: 0.02,
        default: 0.48,
        help: "Bias the cycle toward warm (0) or cool (1)."
    },
    {
        key: "vignette",
        label: "Vignette",
        group: "Mood",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 1,
        help: "Darken the frame toward the corners (+ faint grain). 0 = off."
    },
    {
        key: "windowLightChance",
        label: "Lit windows",
        group: "Lights",
        type: "range",
        min: 0,
        max: 1,
        step: 0.02,
        default: 0.08
    },
    {
        key: "windowToggleRate",
        label: "Flicker",
        group: "Lights",
        type: "range",
        min: 0,
        max: 1,
        step: 0.02,
        default: 0.48,
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
        default: 0.1
    },
    {
        key: "starDensity",
        label: "Stars",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 1
    },
    {
        key: "cloudChance",
        label: "Clouds",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.9
    },
    {
        key: "birdChance",
        label: "Birds",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.95
    },
    {
        key: "flyerChance",
        label: "Planes & co.",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.95,
        help: "Rare crossers: planes, satellites, shooting stars."
    },
    {
        key: "trafficChance",
        label: "Traffic",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.1,
        help: "Sparse headlights crossing the waterfront. Needs a shore to drive on."
    },
    {
        key: "fog",
        label: "Ground fog",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0,
        help: "Low mist hazing the base of the skyline. 0 = clear."
    },
    {
        key: "aurora",
        label: "Aurora",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0,
        help: "Faint sky shimmer (navy & vaporwave palettes only). 0 = off."
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
        default: 0.3
    },
    {
        key: "showStats",
        label: "Show stats",
        group: "Debug",
        type: "toggle",
        default: false
    }
];
function buildDefaults1(schema = CONFIG_SCHEMA) {
    return buildDefaults(schema);
}
const DEFAULT_CONFIG = buildDefaults1();
function normalizeConfig1(input) {
    return normalizeConfig(CONFIG_SCHEMA, input);
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
function oklab(c) {
    return toOklab(c);
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
function hsl(h, s, l, a = 1) {
    const hh = (h % 360 + 360) % 360 / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r1 = hueToRgb(p, q, hh + 1 / 3);
    const g = hueToRgb(p, q, hh);
    const b = hueToRgb(p, q, hh - 1 / 3);
    return rgb(r1 * 255, g * 255, b * 255, a);
}
function hueToRgb(p, q, t) {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
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
    #litFloor = -1;
    #signIdx = -1;
    #signHue = 0;
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
        this.#litFloor = this.rows >= 4 && rng.next() < 0.2 ? rng.int(1, this.rows - 2) : -1;
        if (this.cols > 0 && this.rows > 0 && rng.next() < 0.12) {
            const col = rng.int(0, this.cols - 1);
            const row = rng.int(0, Math.max(0, Math.ceil(this.rows / 2) - 1));
            this.#signIdx = row * this.cols + col;
            this.#signHue = rng.float(0, 360);
        } else {
            this.#signIdx = -1;
        }
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
        const detail = winW > 1.6;
        const tintRange = 0.28;
        for(let r1 = 0; r1 < this.rows; r1++){
            for(let c = 0; c < this.cols; c++){
                const idx = r1 * this.cols + c;
                const isSign = idx === this.#signIdx;
                if (this.lit[idx] === 0 && r1 !== this.#litFloor && !isSign) continue;
                const wx = ix + c * cellW + offX;
                let wy = iy + r1 * cellH + offY;
                let wh = winH;
                let cell;
                if (isSign && detail) {
                    cell = withAlpha(hsl(this.#signHue, 0.55, 0.62), color.a);
                } else {
                    const hTint = cellHash(idx + this.#salt);
                    const hBright = cellHash(idx * 2 + this.#salt + 7);
                    let toward = hTint < 0.5 ? WARM_TINT : COOL_TINT;
                    let amt = Math.abs(hTint - 0.5) * 2 * 0.28;
                    let bright = 0.6 + hBright * 0.4;
                    if (this.rows >= 4 && r1 <= 1) {
                        toward = WARM_TINT;
                        amt = Math.max(amt, tintRange * 0.8);
                        bright = Math.min(1, bright + 0.15);
                    }
                    cell = withAlpha(mix(color, toward, amt), color.a * bright);
                    if (detail && cellHash(idx * 3 + this.#salt + 11) < 0.22) {
                        wh = winH * 0.55;
                        wy += winH - wh;
                    }
                }
                if (glow) {
                    out.glow(wx + winW / 2, wy + wh / 2, winW * 1.7, fadeAlpha(cell, 0.45), 0.55);
                }
                out.rect(wx, wy, winW, wh, cell);
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
    #shade = 0;
    #neon = 0;
    #signRoll = 1;
    #signHue = 0;
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
        this.#signRoll = this.#rng.next();
        this.#signHue = this.#rng.float(0, 360);
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
        this.#shade = this.depth > 0.78 ? cfg.buildingShading : 0;
        this.#neon = cfg.neon;
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
        const win = drawBody(out, sx, topY, sw, bh, this.#color, spec.setbacks, this.#shade, spec.shape);
        this.#grid.draw(out, win.x, win.y, win.w, win.h, this.#window, this.depth);
        const beaconRef = sw / spec.width;
        drawRoof(out, spec.roof, sx, topY, sw, spec.roofScale, this.#color, this.#time, this.#phase, this.depth, beaconRef);
        if (this.#neon > 0 && this.depth > 0.8 && this.#signRoll < 0.16 && SIGN_KINDS.has(spec.kind)) {
            drawNeon(out, sx, topY, sw, this.#signHue, this.#time, this.#neon);
        }
    }
}
const SIGN_KINDS = new Set([
    "skyscraper",
    "tower",
    "landmark",
    "midrise"
]);
function drawNeon(out, x, topY, w, baseHue, time, intensity) {
    const signW = Math.max(3, w * 0.42);
    const signH = Math.max(2, w * 0.12);
    const cx = x + w / 2;
    const y = topY - signH;
    const hue = (baseHue + time * 0.008) % 360;
    const col = hsl(hue, 0.85, 0.62);
    out.glow(cx, y + signH / 2, signW * 0.95, withAlpha(col, 0.5 * intensity), 0.9);
    out.rect(cx - signW / 2, y, signW, signH, withAlpha(col, 0.85 * intensity));
}
function drawBody(out, x, y, w, h, color, setbacks, shade, shape = "box") {
    if (shape === "tree") {
        drawTree(out, x, y, w, h, color);
        return {
            x,
            y,
            w,
            h: 0
        };
    }
    if (shape === "mound") {
        drawMound(out, x, y, w, h, color);
        return {
            x,
            y,
            w,
            h: 0
        };
    }
    if (setbacks <= 0) {
        out.rect(x, y, w, h, color);
        shadeSegment(out, x, y, w, h, color, shade);
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
        const sh = segH + 0.5;
        out.rect(curX, yTop, curW, sh, color);
        shadeSegment(out, curX, yTop, curW, sh, color, shade);
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
function shadeSegment(out, x, y, w, h, color, shade) {
    if (shade <= 0) return;
    const lit = lighten(color, 0.5);
    out.gradient(x, y, w, h, [
        {
            at: 0,
            color: withAlpha(lit, shade * 0.4)
        },
        {
            at: 0.55,
            color: withAlpha(lit, 0)
        }
    ], true);
}
function drawTree(out, x, y, w, h, color) {
    const cx = x + w / 2;
    const groundY = y + h;
    const trunkW = Math.max(1, w * 0.16);
    const trunkH = h * 0.42;
    out.rect(cx - trunkW / 2, groundY - trunkH, trunkW, trunkH, color);
    const r1 = w * 0.5;
    const cyTop = y + r1 * 0.9;
    out.circle(cx, cyTop, r1, color);
    out.circle(cx - w * 0.28, cyTop + h * 0.1, r1 * 0.7, color);
    out.circle(cx + w * 0.28, cyTop + h * 0.1, r1 * 0.7, color);
}
function drawMound(out, x, y, w, h, color) {
    const cx = x + w / 2;
    const baseY = y + h;
    const r1 = (w * w / 4 + h * h) / (2 * h);
    const cyc = y + r1;
    const pts = [];
    for(let i = 0; i <= 14; i++){
        const px = x + w * i / 14;
        const dx = px - cx;
        pts.push(px, cyc - Math.sqrt(Math.max(0, r1 * r1 - dx * dx)));
    }
    pts.push(x + w, baseY, x, baseY);
    out.polygon(pts, color);
}
function drawRoof(out, roof, x, topY, w, scale, color, time, phase, depth, beaconRef) {
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
                    const lightR = Math.max(0.8, beaconRef * 0.007);
                    if (on) out.glow(cx, topY - len, lightR * 4, ANTENNA_LIGHT, 1);
                    out.circle(cx, topY - len, lightR, on ? ANTENNA_LIGHT : darken(ANTENNA_LIGHT, 0.6));
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
        case "barrel":
            {
                const r1 = w * 0.48;
                const cap = Math.min(r1, w * 0.18 * (0.5 + scale));
                out.circle(cx, topY + r1 - cap, r1, color);
                return;
            }
        case "deco":
            {
                const stepH = w * 0.14 * (0.6 + scale);
                let stepW = w * 0.62;
                let yb = topY;
                for(let i = 0; i < 3; i++){
                    out.rect(cx - stepW / 2, yb - stepH, stepW, stepH + 0.5, color);
                    yb -= stepH;
                    stepW *= 0.62;
                }
                out.line(cx, yb, cx, yb - stepH * 0.9, Math.max(1, w * 0.04), color);
                return;
            }
        case "watertower":
            {
                const tw = Math.max(4, w * 0.26 * (0.7 + scale));
                const legH = w * 0.1 * (0.6 + scale);
                const tankH = tw * 0.8;
                const lw = Math.max(1, w * 0.03);
                const baseY = topY - legH;
                out.line(cx - tw * 0.3, topY, cx - tw * 0.3, baseY, lw, color);
                out.line(cx + tw * 0.3, topY, cx + tw * 0.3, baseY, lw, color);
                out.rect(cx - tw / 2, baseY - tankH, tw, tankH, color);
                out.circle(cx, baseY - tankH, tw / 2, color);
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
const PALETTE_HUE = {
    navy: 155,
    vaporwave: 295
};
class Aurora {
    depth = 0.015;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #noise;
    #amount = 0;
    #hue = 155;
    #active = false;
    #time = 0;
    constructor(rng){
        this.#noise = createNoise1D((rng.seed ^ 0xa05a) >>> 0, 2);
    }
    update(ctx) {
        const cfg = ctx.env.config;
        this.#amount = cfg.aurora;
        const hue = PALETTE_HUE[cfg.palette];
        this.#active = hue !== undefined && this.#amount > 0.001;
        if (hue !== undefined) this.#hue = hue;
        this.#time = ctx.time;
    }
    draw(ctx) {
        if (!this.#active) return;
        const { out, width, height } = ctx;
        const bandTop = height * 0.05;
        const bandH = height * 0.3;
        const t = this.#time;
        for(let i = 0; i < 20; i++){
            const fx = (i + 0.5) / 20;
            const n = this.#noise.at(fx * 4 + t * 0.00004);
            const drift = Math.sin(t * 0.0002 + i * 1.3) * width * 0.012;
            const x = fx * width + drift;
            const w = width / 20 * 1.4;
            const h = bandH * (0.35 + n * 0.65);
            const top = bandTop + (bandH - h) * this.#noise.at(fx * 7 + 3.1);
            const a = this.#amount * 0.16 * (0.25 + n * 0.75);
            const col = hsl(this.#hue + (fx - 0.5) * 40, 0.7, 0.6);
            out.gradient(x - w / 2, top, w, h, [
                {
                    at: 0,
                    color: withAlpha(col, 0)
                },
                {
                    at: 0.5,
                    color: withAlpha(col, a)
                },
                {
                    at: 1,
                    color: withAlpha(col, 0)
                }
            ], true);
        }
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
            const twinkle = 0.65 + 0.35 * Math.sin(t + s.tw);
            const color = withAlpha(star, s.base * twinkle);
            const y = s.yFrac * height;
            for(let sx = wrap(s.x - scroll, this.#tileW); sx < width; sx += this.#tileW){
                out.circle(sx, y, s.size, color);
            }
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
const BLIMP = rgb(40, 46, 62);
const GONDOLA = rgb(255, 200, 130);
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
            "shooting-star",
            "airship"
        ], [
            3,
            2,
            2,
            1
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
        const y = this.#rng.float(0.08, type === "plane" ? 0.3 : type === "airship" ? 0.34 : 0.22);
        const speed = type === "plane" ? this.#rng.float(0.00012, 0.0002) : type === "airship" ? this.#rng.float(0.00003, 0.00006) : this.#rng.float(0.00008, 0.00014);
        return {
            type,
            progress: 0,
            speed,
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
        if (f.type === "airship") {
            const len = Math.max(8, width * 0.04);
            const bh = len * 0.42;
            for(let i = -2; i <= 2; i++){
                const br = bh * (1 - Math.abs(i) * 0.16);
                out.circle(x + i * len * 0.2, y, br, BLIMP);
            }
            const dir = f.x1 >= f.x0 ? 1 : -1;
            out.circle(x - dir * len * 0.52, y - bh * 0.45, bh * 0.5, BLIMP);
            const blink = 0.5 + 0.5 * Math.sin(this.#time * 0.004);
            out.glow(x, y + bh * 0.6, bh * 1.6, withAlpha(GONDOLA, 0.4 * blink), 0.7);
            out.circle(x, y + bh * 0.7, 1.2, withAlpha(GONDOLA, blink));
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
const WARM_WIN = rgb(255, 200, 130);
const COOL_WIN = rgb(200, 222, 255);
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
    #litFactor = 0.4;
    #shimmer;
    #reflections;
    #windowRefl;
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
        this.#windowRefl = Array.from({
            length: 12
        }, ()=>({
                xFrac: rng.float(0.02, 0.98),
                width: rng.float(0.004, 0.016),
                warm: rng.bool(0.6),
                phase: rng.float(0, 6.283),
                depth: rng.float(0.4, 0.85)
            }));
    }
    update(ctx) {
        this.#mood = ctx.env.mood;
        this.#level = ctx.env.config.waterLevel;
        this.#time = ctx.time;
        this.#litFactor = clamp(ctx.env.config.windowLightChance / 0.18, 0.25, 1.6);
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
        for (const r1 of this.#windowRefl){
            const tint = mix(mood.window, r1.warm ? WARM_WIN : COOL_WIN, 0.4);
            const x = r1.xFrac * width;
            const w = Math.max(1, r1.width * width);
            const shimmer = 0.5 + 0.5 * Math.sin(this.#time * 0.0016 + r1.phase);
            const wob = Math.sin(this.#time * 0.0011 + r1.phase) * w * 0.6;
            const a = 0.14 * shimmer * this.#litFactor;
            out.gradient(x + wob, waterY, w, waterH * r1.depth, [
                {
                    at: 0,
                    color: withAlpha(tint, a)
                },
                {
                    at: 1,
                    color: withAlpha(tint, 0)
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
class GroundFog {
    depth = 1.05;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #mood;
    #amount = 0;
    #water = 0.33;
    #shore = 0.025;
    #time = 0;
    update(ctx) {
        this.#mood = ctx.env.mood;
        this.#amount = ctx.env.config.fog;
        this.#water = ctx.env.config.waterLevel;
        this.#shore = ctx.env.config.shoreHeight;
        this.#time = ctx.time;
    }
    draw(ctx) {
        if (this.#amount <= 0.001) return;
        const { out, width, height } = ctx;
        const waterY = (1 - this.#water) * height;
        const feetY = (1 - this.#water - this.#shore) * height;
        const top = feetY - height * 0.16;
        const bandH = waterY - top;
        if (bandH <= 0) return;
        const breath = 0.85 + 0.15 * Math.sin(this.#time * 0.0004);
        const a = clamp(this.#amount * 0.34 * breath, 0, 1);
        const c = mix(this.#mood.haze, this.#mood.horizonGlow, 0.4);
        out.gradient(0, top, width, bandH, [
            {
                at: 0,
                color: withAlpha(c, 0)
            },
            {
                at: 0.65,
                color: withAlpha(c, a)
            },
            {
                at: 1,
                color: withAlpha(c, a * 0.6)
            }
        ], true);
    }
}
const HEAD_WARM = rgb(255, 214, 150);
const HEAD_COOL = rgb(206, 224, 255);
const TAIL = rgb(255, 72, 60);
class TrafficDirector {
    depth = 1.12;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #rng;
    #vehicles = [];
    #timer;
    #time = 0;
    #water = 0.33;
    #shore = 0.025;
    constructor(rng){
        this.#rng = rng;
        this.#timer = rng.float(1500, 5000);
    }
    update(ctx) {
        this.#time = ctx.time;
        this.#water = ctx.env.config.waterLevel;
        this.#shore = ctx.env.config.shoreHeight;
        const chance = ctx.env.config.trafficChance;
        if (this.#vehicles.length > 0) {
            let w = 0;
            for (const v of this.#vehicles){
                v.progress += v.speed * ctx.dt;
                if (v.progress <= 1) this.#vehicles[w++] = v;
            }
            this.#vehicles.length = w;
        }
        if (this.#shore <= 0.001 || chance <= 0) return;
        this.#timer -= ctx.dt * (0.2 + chance);
        if (this.#timer > 0) return;
        this.#timer = this.#rng.float(1400, 4200) / (0.3 + chance);
        if (this.#vehicles.length < 6) this.#vehicles.push(this.#spawn());
    }
    #spawn() {
        return {
            progress: 0,
            speed: this.#rng.float(0.00009, 0.0002),
            dir: this.#rng.bool() ? 1 : -1,
            yJit: this.#rng.float(-1, 1),
            size: this.#rng.float(0.85, 1.35),
            warm: this.#rng.bool(0.72)
        };
    }
    draw(ctx) {
        if (this.#vehicles.length === 0 || this.#shore <= 0.001) return;
        const { out, width, height } = ctx;
        const waterY = (1 - this.#water) * height;
        const bandH = this.#shore * height;
        const roadY = waterY - bandH * 0.45;
        const carH = Math.max(1.2, bandH * 0.4);
        const waterH = height - waterY;
        for (const v of this.#vehicles){
            const sx = (v.dir > 0 ? -0.05 + v.progress * 1.1 : 1.05 - v.progress * 1.1) * width;
            const y = roadY + v.yJit * bandH * 0.22;
            const s = carH * v.size;
            const head = v.warm ? HEAD_WARM : HEAD_COOL;
            const headX = sx + v.dir * s * 0.7;
            const tailX = sx - v.dir * s * 0.7;
            out.glow(headX, y, s * 2.4, withAlpha(head, 0.5), 0.9);
            out.circle(headX, y, s * 0.5, head);
            out.circle(tailX, y, s * 0.42, TAIL);
            if (waterH > 0) {
                const wob = Math.sin(this.#time * 0.0012 + sx * 0.05) * s * 0.7;
                out.gradient(headX - s * 0.6 + wob, waterY, s * 1.2, waterH * 0.5, [
                    {
                        at: 0,
                        color: withAlpha(head, 0.22)
                    },
                    {
                        at: 1,
                        color: withAlpha(head, 0)
                    }
                ], true);
            }
        }
    }
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
                "tank",
                "deco"
            ], [
                4,
                3,
                2,
                1,
                2
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
                "antenna",
                "barrel"
            ], [
                4,
                2,
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
                "tank",
                "watertower"
            ], [
                5,
                2,
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
                "dome",
                "deco"
            ], [
                3,
                2,
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
    },
    tree (rng) {
        const height = rng.float(0.05, 0.13);
        const width = height * rng.float(0.7, 1.1);
        return {
            kind: "tree",
            shape: "tree",
            width,
            height,
            roof: "flat",
            roofScale: 0,
            cols: 0,
            rows: 0,
            setbacks: 0
        };
    },
    barn (rng) {
        const height = rng.float(0.06, 0.11);
        const width = height * rng.float(1.6, 2.6);
        return {
            kind: "barn",
            width,
            height,
            roof: "pitched",
            roofScale: rng.float(0.7, 1),
            cols: rng.int(0, 3),
            rows: rng.int(0, 2),
            setbacks: 0
        };
    },
    silo (rng) {
        const height = rng.float(0.1, 0.18);
        const width = height * rng.float(0.28, 0.42);
        return {
            kind: "silo",
            width,
            height,
            roof: rng.weighted([
                "dome",
                "barrel"
            ], [
                3,
                2
            ]),
            roofScale: rng.float(0.6, 1),
            cols: 0,
            rows: 0,
            setbacks: 0
        };
    },
    hill (rng) {
        const height = rng.float(0.05, 0.13);
        const width = height * rng.float(2.5, 5);
        return {
            kind: "hill",
            shape: "mound",
            width,
            height,
            roof: "flat",
            roofScale: 0,
            cols: 0,
            rows: 0,
            setbacks: 0
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
    },
    countryside: {
        kinds: [
            "tree",
            "house",
            "barn",
            "silo",
            "hill",
            null
        ],
        kindWeights: [
            5,
            2,
            2,
            1,
            2,
            3
        ],
        gap: [
            0.03,
            0.1
        ],
        run: [
            4,
            9
        ],
        next: [
            "countryside",
            "residential",
            "park"
        ],
        nextWeights: [
            4,
            2,
            2
        ]
    },
    coast: {
        kinds: [
            "hill",
            "tree",
            "house",
            null
        ],
        kindWeights: [
            2,
            2,
            1,
            6
        ],
        gap: [
            0.06,
            0.16
        ],
        run: [
            3,
            7
        ],
        next: [
            "coast",
            "countryside",
            "park"
        ],
        nextWeights: [
            3,
            2,
            2
        ]
    }
};
const BIOME_SUCCESSORS = {
    residential: [
        [
            "countryside",
            4
        ]
    ],
    park: [
        [
            "countryside",
            4
        ],
        [
            "coast",
            2
        ]
    ],
    countryside: [
        [
            "coast",
            3
        ]
    ]
};
const URBANISM = {
    downtown: 1,
    commercial: 0.72,
    residential: 0.38,
    industrial: 0.28,
    park: 0.12,
    countryside: 0.18,
    coast: 0.04
};
function biasWeight(weight, level, urbanism, variety) {
    const diff = Math.abs(level - urbanism);
    const factor = Math.max(0.02, 1 + variety * 3 * (1 - 2 * diff));
    return weight * factor;
}
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
    next(urbanism = 0.5, variety = 0) {
        if (this.#remaining <= 0) {
            this.#district = this.#chooseNext(urbanism, variety);
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
    #chooseNext(urbanism, variety) {
        const rule = RULES[this.#district];
        if (variety <= 0) return this.#rng.weighted(rule.next, rule.nextWeights);
        const extra = BIOME_SUCCESSORS[this.#district];
        const cands = extra ? [
            ...rule.next,
            ...extra.map((e)=>e[0])
        ] : rule.next;
        const base = extra ? [
            ...rule.nextWeights,
            ...extra.map((e)=>e[1])
        ] : rule.nextWeights;
        const weights = cands.map((d, i)=>biasWeight(base[i], URBANISM[d], urbanism, variety));
        return this.#rng.weighted(cands, weights);
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
    factory: "midrise",
    tree: "tree",
    barn: "barn",
    silo: "silo",
    hill: "tree"
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
    #biomeField;
    #biomeShift = 0;
    #biomeScale = 5;
    #biomeVariety = 0;
    constructor(layer, rng, opts){
        this.layer = layer;
        this.depth = opts.depth;
        this.#shoreOffset = opts.shoreOffset;
        this.#scale = opts.scale;
        this.#rng = rng;
        this.#exclude = new Set(opts.excludeKinds ?? []);
        this.#biomeField = opts.biomeField;
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
        this.#biomeShift = camera.scroll * (1 - camera.parallaxAt(this.depth));
        this.#biomeScale = env.config.biomeScale;
        this.#biomeVariety = env.config.biomeVariety;
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
    #nextSlot(stream, edge) {
        if (this.#biomeField && this.#biomeVariety > 0) {
            const urbanism = this.#biomeField.urbanismAt(edge + this.#biomeShift, this.#biomeScale);
            return stream.next(urbanism, this.#biomeVariety);
        }
        return stream.next();
    }
    #placeRight(litChance) {
        const slot = this.#nextSlot(this.#streamR, this.#right);
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
        const slot = this.#nextSlot(this.#streamL, this.#left);
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
class BiomeField {
    #noise;
    constructor(seed){
        this.#noise = createNoise1D((seed ^ 0xb10e) >>> 0, 2);
    }
    urbanismAt(worldX, scale) {
        const s = scale > 0 ? scale : 1;
        const n = this.#noise.at(worldX / s);
        return clamp(0.5 + (n - 0.5) * 1.4, 0, 1);
    }
}
function buildSkyline(world, config, rng) {
    const sky = new Layer("sky", 0);
    sky.add(new SkyBackdrop());
    sky.add(new Aurora(rng.fork("aurora")));
    sky.add(new Starfield(rng.fork("stars")));
    sky.add(new Moon(rng.fork("moon")));
    sky.add(new FlyerDirector(rng.fork("flyer")));
    sky.add(new CloudField(rng.fork("clouds")));
    world.addLayer(sky);
    const n = Math.max(1, Math.round(config.parallaxLayers));
    const spawners = [];
    const biomeField = new BiomeField(rng.fork("biome").seed);
    for(let i = 0; i < n; i++){
        const f = n === 1 ? 1 : i / (n - 1);
        const depth = lerp(0.6, 0.92, f);
        const scale = lerp(0.78, 1.05, f);
        const shoreOffset = (1 - f) * 0.05;
        const layer = new Layer(`buildings-${i}`, depth);
        world.addLayer(layer);
        const isFront = i === n - 1;
        const exclude = [];
        if (isFront) exclude.push("skyscraper");
        if (f > 0.4) exclude.push("hill");
        spawners.push(new LayerSpawner(layer, rng.fork(`layer-${i}`), {
            depth,
            shoreOffset,
            scale,
            excludeKinds: exclude.length > 0 ? exclude : undefined,
            biomeField
        }));
    }
    const birds = new Layer("birds", 0.94);
    birds.add(new BirdDirector(rng.fork("birds")));
    world.addLayer(birds);
    const water = new Layer("water", 1);
    water.add(new Water(rng.fork("water")));
    world.addLayer(water);
    const fog = new Layer("fog", 1.05);
    fog.add(new GroundFog());
    world.addLayer(fog);
    const shore = new Layer("shore", 1.1);
    shore.add(new Shore(rng.fork("shore")));
    world.addLayer(shore);
    const traffic = new Layer("traffic", 1.12);
    traffic.add(new TrafficDirector(rng.fork("traffic")));
    world.addLayer(traffic);
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
        const next = normalizeConfig1({
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
    return new Cityscape(normalizeConfig1({
        ...DEFAULT_CONFIG,
        ...config
    }));
}
function drawCommand(ctx, cmd) {
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
function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
class CanvasRenderer {
    #ctx;
    #canvas;
    #dpr = 1;
    #width = 0;
    #height = 0;
    #vignette = 0;
    #grainPattern = null;
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
    setPost(opts) {
        if (opts.vignette !== undefined) this.#vignette = Math.max(0, opts.vignette);
    }
    render(list) {
        const ctx = this.#ctx;
        ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, list.offsetY * this.#dpr);
        if (list.commands.length === 0 || list.commands[0].kind !== "gradient") {
            ctx.clearRect(0, -list.offsetY, this.#width, this.#height);
        }
        for (const cmd of list.commands)drawCommand(ctx, cmd);
        ctx.globalCompositeOperation = "source-over";
        this.#applyPost(ctx);
    }
    #applyPost(ctx) {
        const vig = this.#vignette;
        if (vig <= 0) return;
        const w = this.#canvas.width;
        const h = this.#canvas.height;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const cx = w / 2;
        const cy = h / 2;
        const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.4, cx, cy, Math.hypot(w, h) * 0.6);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, `rgba(0,0,0,${(vig * 0.9).toFixed(3)})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const grain = this.#grainPattern ?? (this.#grainPattern = buildGrain(ctx));
        if (grain) {
            ctx.globalAlpha = vig * 0.06;
            ctx.fillStyle = grain;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }
}
function buildGrain(ctx) {
    const size = 64;
    const tile = document.createElement("canvas");
    tile.width = size;
    tile.height = size;
    const tctx = tile.getContext("2d");
    if (!tctx) return null;
    const img = tctx.createImageData(64, 64);
    const d = img.data;
    for(let i = 0; i < d.length; i += 4){
        const v = Math.random() * 255 | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    return ctx.createPattern(tile, "repeat");
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
    canvasRenderer.setPost({
        vignette: scene.config.vignette
    });
    let renderer = canvasRenderer;
    const audio = new AmbientAudio(scene.events);
    audio.setVolume(scene.config.audioVolume);
    if (scene.config.audioEnabled) audio.setEnabled(true);
    const stats = document.createElement("div");
    stats.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:9;display:none;" + "font:11px/1.5 ui-monospace,Menlo,monospace;white-space:pre;padding:8px 10px;" + "border-radius:8px;pointer-events:none;color:#cfe0ff;" + "background:rgba(10,16,32,0.7);border:1px solid rgba(120,140,200,0.2);";
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
        if ("vignette" in patch) {
            canvasRenderer.setPost({
                vignette: scene.config.vignette
            });
        }
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
    const closing = !!opts.onClose;
    const cornerBtn = closing ? button("✕", "Close", ()=>opts.onClose()) : button("▾", "Collapse", ()=>collapsed.update((c)=>!c));
    header.append(heading, spacer, shuffleBtn);
    if (shareBtn) header.append(shareBtn);
    header.append(cornerBtn);
    const body = el("div", "csp-body");
    const groups = deriveGroups(schema);
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
    if (!closing) {
        unsubs.push(reactTo([
            collapsed
        ], ()=>{
            const c = collapsed.get();
            root.classList.toggle("csp-collapsed", c);
            cornerBtn.textContent = c ? "▸" : "▾";
            cornerBtn.title = c ? "Expand" : "Collapse";
        }));
    }
    return {
        el: root,
        set (config) {
            for (const f of schema)setters.get(f.key)?.(config[f.key]);
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
function makeBayer(order) {
    const n = Math.max(0, Math.floor(order));
    let m = [
        [
            0
        ]
    ];
    for(let k = 0; k < n; k++){
        const s = m.length;
        const next = Array.from({
            length: s * 2
        }, ()=>new Array(s * 2).fill(0));
        for(let y = 0; y < s; y++){
            for(let x = 0; x < s; x++){
                const base = m[y][x] * 4;
                next[y][x] = base + 0;
                next[y][x + s] = base + 2;
                next[y + s][x] = base + 3;
                next[y + s][x + s] = base + 1;
            }
        }
        m = next;
    }
    const size = m.length;
    const data = new Int32Array(size * size);
    for(let y = 0; y < size; y++){
        for(let x = 0; x < size; x++)data[y * size + x] = m[y][x];
    }
    return {
        size,
        data
    };
}
function bayerThreshold(m, x, y) {
    const s = m.size;
    const ix = (x % s + s) % s;
    const iy = (y % s + s) % s;
    return (m.data[iy * s + ix] + 0.5) / (s * s);
}
function extractPalette(pixels, opts = {}) {
    const size = Math.max(1, Math.floor(opts.size ?? 32));
    const stride = Math.max(1, Math.floor(opts.sampleStride ?? 1));
    const alphaMin = opts.alphaThreshold ?? 8;
    const step = 4 * stride;
    const samples = [];
    for(let i = 0; i + 3 < pixels.length; i += step){
        if (pixels[i + 3] < alphaMin) continue;
        samples.push(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
    if (samples.length === 0) return [
        {
            r: 0,
            g: 0,
            b: 0,
            a: 1
        }
    ];
    return medianCut(Uint8Array.from(samples), size);
}
function medianCut(pts, maxColors) {
    const n = pts.length / 3;
    const idx = new Int32Array(n);
    for(let i = 0; i < n; i++)idx[i] = i;
    const boxes = [
        {
            start: 0,
            count: n
        }
    ];
    const widest = (box)=>{
        let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
        const end = box.start + box.count;
        for(let i = box.start; i < end; i++){
            const p = idx[i] * 3;
            const r1 = pts[p], g = pts[p + 1], b = pts[p + 2];
            if (r1 < rmin) rmin = r1;
            if (r1 > rmax) rmax = r1;
            if (g < gmin) gmin = g;
            if (g > gmax) gmax = g;
            if (b < bmin) bmin = b;
            if (b > bmax) bmax = b;
        }
        const rr = rmax - rmin, gr = gmax - gmin, br = bmax - bmin;
        if (rr >= gr && rr >= br) return {
            channel: 0,
            range: rr
        };
        return gr >= br ? {
            channel: 1,
            range: gr
        } : {
            channel: 2,
            range: br
        };
    };
    while(boxes.length < maxColors){
        let target = -1;
        let bestRange = 0;
        let bestChannel = 0;
        for(let i = 0; i < boxes.length; i++){
            if (boxes[i].count < 2) continue;
            const w = widest(boxes[i]);
            if (w.range > bestRange) {
                bestRange = w.range;
                bestChannel = w.channel;
                target = i;
            }
        }
        if (target < 0) break;
        const box = boxes[target];
        const slice = Array.from(idx.subarray(box.start, box.start + box.count));
        slice.sort((a, b)=>pts[a * 3 + bestChannel] - pts[b * 3 + bestChannel]);
        for(let i = 0; i < slice.length; i++)idx[box.start + i] = slice[i];
        const half = box.count >> 1;
        boxes.splice(target, 1, {
            start: box.start,
            count: half
        }, {
            start: box.start + half,
            count: box.count - half
        });
    }
    return boxes.map((box)=>{
        let r1 = 0, g = 0, b = 0;
        const end = box.start + box.count;
        for(let i = box.start; i < end; i++){
            const p = idx[i] * 3;
            r1 += pts[p];
            g += pts[p + 1];
            b += pts[p + 2];
        }
        const c = Math.max(1, box.count);
        return {
            r: Math.round(r1 / c),
            g: Math.round(g / c),
            b: Math.round(b / c),
            a: 1
        };
    });
}
function buildPaletteLut(palette, bits = 5) {
    const bb = Math.max(1, Math.min(8, Math.floor(bits)));
    const n = 1 << bb;
    const shift = 8 - bb;
    const half = shift > 0 ? 1 << shift - 1 : 0;
    const pal = palette.length > 0 ? palette : [
        {
            r: 0,
            g: 0,
            b: 0,
            a: 1
        }
    ];
    const palOk = pal.map(oklab);
    const cells = n * n * n;
    const a = new Uint8Array(cells * 3);
    const b = new Uint8Array(cells * 3);
    const t = new Uint8Array(cells);
    for(let r1 = 0; r1 < n; r1++){
        for(let g = 0; g < n; g++){
            for(let bl = 0; bl < n; bl++){
                const o = oklab({
                    r: (r1 << shift) + half,
                    g: (g << shift) + half,
                    b: (bl << shift) + half,
                    a: 1
                });
                let i1 = 0, d1 = Infinity, i2 = -1, d2 = Infinity;
                for(let p = 0; p < palOk.length; p++){
                    const po = palOk[p];
                    const dL = o.L - po.L, da = o.a - po.a, db = o.b - po.b;
                    const d = dL * dL + da * da + db * db;
                    if (d < d1) {
                        d2 = d1;
                        i2 = i1;
                        d1 = d;
                        i1 = p;
                    } else if (d < d2) {
                        d2 = d;
                        i2 = p;
                    }
                }
                if (i2 < 0) i2 = i1;
                const p1 = palOk[i1], p2 = palOk[i2];
                const vL = p2.L - p1.L, va = p2.a - p1.a, vb = p2.b - p1.b;
                const vv = vL * vL + va * va + vb * vb;
                let tt = vv > 1e-9 ? ((o.L - p1.L) * vL + (o.a - p1.a) * va + (o.b - p1.b) * vb) / vv : 0;
                tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
                const cell = (r1 * n + g) * n + bl;
                const c3 = cell * 3;
                const ca = pal[i1], cb = pal[i2];
                a[c3] = ca.r;
                a[c3 + 1] = ca.g;
                a[c3 + 2] = ca.b;
                b[c3] = cb.r;
                b[c3 + 1] = cb.g;
                b[c3 + 2] = cb.b;
                t[cell] = Math.round(tt * 255);
            }
        }
    }
    return {
        bits: bb,
        a,
        b,
        t
    };
}
function ditherQuantize(data, width, height, lut, bayer, strength = 1) {
    const n = 1 << lut.bits;
    const shift = 8 - lut.bits;
    const { a, b, t } = lut;
    const s = strength < 0 ? 0 : strength > 1 ? 1 : strength;
    for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
            const i = (y * width + x) * 4;
            if (data[i + 3] < 8) continue;
            const cell = ((data[i] >> shift) * n + (data[i + 1] >> shift)) * n + (data[i + 2] >> shift);
            const frac = t[cell] / 255 * s;
            const src = bayerThreshold(bayer, x, y) < frac ? b : a;
            const c3 = cell * 3;
            data[i] = src[c3];
            data[i + 1] = src[c3 + 1];
            data[i + 2] = src[c3 + 2];
        }
    }
}
class PixelArtRenderer {
    #canvas;
    #ctx;
    #buf;
    #bctx;
    #dpr = 1;
    #width = 0;
    #height = 0;
    #vw = 1;
    #vh = 1;
    #pixelScale;
    #paletteSize;
    #dither;
    #refresh;
    #lutBits;
    #bayer;
    #palette = [];
    #lut = null;
    #frame = 0;
    #lastPaletteFrame = -1;
    constructor(canvas, opts = {}){
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("PixelArtRenderer: 2D context unavailable");
        this.#canvas = canvas;
        this.#ctx = ctx;
        const buf = document.createElement("canvas");
        const bctx = buf.getContext("2d", {
            willReadFrequently: true
        });
        if (!bctx) throw new Error("PixelArtRenderer: offscreen 2D context unavailable");
        this.#buf = buf;
        this.#bctx = bctx;
        this.#pixelScale = Math.max(1, opts.pixelScale ?? 4);
        this.#paletteSize = Math.max(2, opts.paletteSize ?? 48);
        this.#dither = clamp011(opts.dither ?? 1);
        this.#refresh = Math.max(1, opts.paletteRefreshFrames ?? 18);
        this.#lutBits = Math.max(4, Math.min(6, opts.lutBits ?? 5));
        this.#bayer = makeBayer(3);
    }
    get bufferSize() {
        return {
            width: this.#vw,
            height: this.#vh
        };
    }
    setOptions(opts) {
        let geometryChanged = false;
        if (opts.pixelScale !== undefined) {
            const next = Math.max(1, opts.pixelScale);
            geometryChanged = next !== this.#pixelScale;
            this.#pixelScale = next;
        }
        if (opts.paletteSize !== undefined) {
            this.#paletteSize = Math.max(2, opts.paletteSize);
            this.#lastPaletteFrame = -1;
        }
        if (opts.dither !== undefined) this.#dither = clamp011(opts.dither);
        if (opts.paletteRefreshFrames !== undefined) {
            this.#refresh = Math.max(1, opts.paletteRefreshFrames);
        }
        if (opts.lutBits !== undefined) {
            this.#lutBits = Math.max(4, Math.min(6, opts.lutBits));
            this.#lastPaletteFrame = -1;
        }
        if (geometryChanged && this.#width > 0) {
            this.resize(this.#width, this.#height, this.#dpr);
        }
    }
    resize(width, height, dpr = 1) {
        this.#width = width;
        this.#height = height;
        this.#dpr = dpr;
        this.#canvas.width = Math.max(1, Math.round(width * dpr));
        this.#canvas.height = Math.max(1, Math.round(height * dpr));
        this.#canvas.style.width = `${width}px`;
        this.#canvas.style.height = `${height}px`;
        this.#vw = Math.max(1, Math.round(width / this.#pixelScale));
        this.#vh = Math.max(1, Math.round(height / this.#pixelScale));
        this.#buf.width = this.#vw;
        this.#buf.height = this.#vh;
        this.#lastPaletteFrame = -1;
    }
    render(list) {
        const b = this.#bctx;
        const vw = this.#vw;
        const vh = this.#vh;
        const sx = vw / Math.max(1, this.#width);
        const sy = vh / Math.max(1, this.#height);
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.clearRect(0, 0, vw, vh);
        b.setTransform(sx, 0, 0, sy, 0, list.offsetY * sy);
        for (const cmd of list.commands)drawCommand(b, cmd);
        b.setTransform(1, 0, 0, 1, 0, 0);
        const img = b.getImageData(0, 0, vw, vh);
        if (this.#lut === null || this.#frame - this.#lastPaletteFrame >= this.#refresh) {
            this.#palette = extractPalette(img.data, {
                size: this.#paletteSize,
                sampleStride: paletteStride(vw, vh)
            });
            this.#lut = buildPaletteLut(this.#palette, this.#lutBits);
            this.#lastPaletteFrame = this.#frame;
        }
        ditherQuantize(img.data, vw, vh, this.#lut, this.#bayer, this.#dither);
        b.putImageData(img, 0, 0);
        const c = this.#ctx;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.imageSmoothingEnabled = false;
        c.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
        c.drawImage(this.#buf, 0, 0, vw, vh, 0, 0, this.#canvas.width, this.#canvas.height);
        c.imageSmoothingEnabled = true;
        this.#frame++;
    }
    dispose() {
        this.#buf.width = 0;
        this.#buf.height = 0;
        this.#lut = null;
        this.#palette = [];
    }
}
function clamp011(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
}
function paletteStride(vw, vh) {
    return Math.max(1, Math.floor(vw * vh / 3000));
}
const handle = mountCityscape({
    writeHash: true,
    randomizeSeed: true
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
let immersive = false;
let menuOpen = false;
let panelOpen = false;
function applyVisibility() {
    menuBtn.style.display = immersive ? "none" : "";
    menu.style.display = !immersive && menuOpen ? "" : "none";
    panel.el.style.display = !immersive && panelOpen ? "" : "none";
}
const setMenuOpen = (on)=>{
    menuOpen = on;
    applyVisibility();
};
const setPanelOpen = (on)=>{
    panelOpen = on;
    applyVisibility();
};
const panel = createControlPanel({
    config: handle.scene.config,
    onChange: (patch)=>handle.update(patch),
    onClose: ()=>setPanelOpen(false),
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
let pixelScale = 4;
const pixel = new PixelArtRenderer(handle.canvas, {
    pixelScale
});
let mode = "canvas";
function setMode(next) {
    mode = next;
    const asciiOn = next === "ascii";
    pre.style.display = asciiOn ? "block" : "none";
    handle.canvas.style.opacity = asciiOn ? "0" : "1";
    handle.setRenderer(next === "ascii" ? asciiAdapter : next === "pixel" ? pixel : canvasRenderer);
    asciiBtn.textContent = asciiOn ? "Canvas view" : "ASCII view";
    pixelBtn.textContent = next === "pixel" ? "Canvas view" : "Pixel view";
}
function toggleMode(m) {
    setMode(mode === m ? "canvas" : m);
}
function adjustPixelScale(delta) {
    if (mode !== "pixel") return;
    pixelScale = Math.max(1, Math.min(12, pixelScale + delta));
    pixel.setOptions({
        pixelScale
    });
    flash(`Pixel size ${pixelScale}`);
}
const menuBtn = document.createElement("button");
menuBtn.className = "cs-menu-btn";
menuBtn.textContent = "☰";
menuBtn.title = "Menu";
menuBtn.setAttribute("aria-label", "Menu");
menuBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    setMenuOpen(!menuOpen);
});
const menu = document.createElement("div");
menu.className = "cs-menu";
function menuItem(label, onPick) {
    const b = document.createElement("button");
    b.className = "cs-menu-item";
    b.textContent = label;
    b.addEventListener("click", ()=>{
        setMenuOpen(false);
        onPick();
    });
    return b;
}
const asciiBtn = menuItem("ASCII view", ()=>toggleMode("ascii"));
const pixelBtn = menuItem("Pixel view", ()=>toggleMode("pixel"));
const fsBtn = menuItem("Fullscreen", ()=>setImmersive(true));
const worldBtn = menuItem("🏞 Nature", ()=>location.href = "../nature/");
worldBtn.title = "Switch to the nature valley";
const settingsBtn = menuItem("⚙ Settings", ()=>setPanelOpen(true));
const hint = document.createElement("div");
hint.className = "cs-menu-hint";
hint.textContent = "move = parallax · wheel = speed · click = flash · keys: a / p / [ ] / m / h / f";
menu.append(asciiBtn, pixelBtn, fsBtn, worldBtn, settingsBtn, hint);
document.body.append(menuBtn, menu);
function setImmersive(on) {
    if (on === immersive) return;
    immersive = on;
    if (on) menuOpen = false;
    applyVisibility();
    if (on) document.documentElement.requestFullscreen?.().catch(()=>{});
    else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(()=>{});
    }
}
document.addEventListener("fullscreenchange", ()=>{
    if (!document.fullscreenElement && immersive) setImmersive(false);
});
document.addEventListener("click", (e)=>{
    if (menuOpen && !menu.contains(e.target)) setMenuOpen(false);
});
addEventListener("keydown", (e)=>{
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
    }
    if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
    } else if (e.key === "a") toggleMode("ascii");
    else if (e.key === "p") toggleMode("pixel");
    else if (e.key === "[") adjustPixelScale(-1);
    else if (e.key === "]") adjustPixelScale(1);
    else if (e.key === "m") setMenuOpen(!menuOpen);
    else if (e.key === "h") setPanelOpen(!panelOpen);
    else if (e.key === "f") setImmersive(!immersive);
});
applyVisibility();
Object.assign(globalThis, {
    handle,
    panel
});
