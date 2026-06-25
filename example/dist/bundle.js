const CARDS = [
    {
        route: "#/city",
        cls: "card-city",
        emoji: "🌃",
        title: "Night city",
        blurb: "A calm, dark skyline scrolling across a reflective sea — moon, stars, drifting " + "clouds, lit windows and a lamp-lit shore.",
        cta: "Enter the city →"
    },
    {
        route: "#/nature",
        cls: "card-nature",
        emoji: "🏞️",
        title: "Nature valley",
        blurb: "A sunlit, day-cycling valley — rolling forested hills, snow-capped peaks, a lake " + "and cabins, with seasons, weather and wildlife.",
        cta: "Wander the valley →"
    },
    {
        route: "#/shapes",
        cls: "card-shapes",
        emoji: "🧩",
        title: "Shapes",
        blurb: "The interactive one: a polyomino puzzle. Rotate, flip and drag the scattered " + "pieces back into the figure — in the fewest moves.",
        cta: "Solve the figure →"
    }
];
function createChooser(host) {
    const root = document.createElement("div");
    root.className = "chooser";
    const header = document.createElement("header");
    header.className = "chooser-header";
    const h1 = document.createElement("h1");
    h1.textContent = "@marianmeres/cityscape";
    const tagline = document.createElement("p");
    tagline.className = "tagline";
    tagline.append("Three worlds on one headless engine — two procedurally-generated parallax " + "animations and one interactive puzzle — all sharing the same swappable ");
    const code = document.createElement("code");
    code.textContent = "Canvas · ASCII · Pixel";
    tagline.append(code, " renderer seam. Take your pick.");
    header.append(h1, tagline);
    const main = document.createElement("main");
    main.className = "cards";
    for (const c of CARDS){
        const card = document.createElement("a");
        card.className = `card ${c.cls}`;
        card.href = c.route;
        const emoji = document.createElement("div");
        emoji.className = "emoji";
        emoji.textContent = c.emoji;
        const h2 = document.createElement("h2");
        h2.textContent = c.title;
        const p = document.createElement("p");
        p.textContent = c.blurb;
        const go = document.createElement("span");
        go.className = "go";
        go.textContent = c.cta;
        card.append(emoji, h2, p, go);
        main.append(card);
    }
    const footer = document.createElement("footer");
    footer.append("The animation is the demo; the ");
    const link = document.createElement("a");
    link.href = "https://github.com/marianmeres/cityscape";
    link.textContent = "architecture";
    footer.append(link, " is the point.");
    root.append(header, main, footer);
    host.append(root);
    return {
        destroy () {
            root.remove();
        }
    };
}
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
    rect(x, y, w, h, color, radius) {
        this.commands.push({
            kind: "rect",
            x,
            y,
            w,
            h,
            color,
            radius
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
            {
                ctx.fillStyle = toCss(cmd.color);
                const r1 = cmd.radius;
                const radii = typeof r1 === "number" ? r1 > 0 ? [
                    r1,
                    r1,
                    r1,
                    r1
                ] : null : r1 && (r1[0] > 0 || r1[1] > 0 || r1[2] > 0 || r1[3] > 0) ? r1 : null;
                if (radii && cmd.w > 0 && cmd.h > 0) {
                    roundRectPath(ctx, cmd.x, cmd.y, cmd.w, cmd.h, radii);
                    ctx.fill();
                } else {
                    ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h);
                }
                return;
            }
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
function roundRectPath(ctx, x, y, w, h, radii) {
    const max = Math.min(w, h) / 2;
    const clamp = (v)=>Math.min(Math.max(0, v), max);
    const tl = clamp(radii[0]);
    const tr = clamp(radii[1]);
    const br = clamp(radii[2]);
    const bl = clamp(radii[3]);
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.arcTo(x + w, y, x + w, y + h, tr);
    ctx.arcTo(x + w, y + h, x, y + h, br);
    ctx.arcTo(x, y + h, x, y, bl);
    ctx.arcTo(x, y, x + w, y, tl);
    ctx.closePath();
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
const day = {
    name: "day",
    label: "Clear day",
    warm: {
        skyTop: "#3f6cb0",
        skyMid: "#8aabd8",
        skyBottom: "#ffd2a0",
        sunGlow: "#ffbd72",
        sun: "#fff1cc",
        landFar: "#93b0bd",
        landNear: "#435a44",
        water: "#7196bc",
        haze: "#c2d6e6"
    },
    cool: {
        skyTop: "#2f74c8",
        skyMid: "#7cb2e8",
        skyBottom: "#d6efff",
        sunGlow: "#fff3d2",
        sun: "#fffdf4",
        landFar: "#a3c2d0",
        landNear: "#48643f",
        water: "#5fa1d2",
        haze: "#d4e8f6"
    }
};
const golden = {
    name: "golden",
    label: "Golden valley",
    warm: {
        skyTop: "#5a73a8",
        skyMid: "#c2a98f",
        skyBottom: "#ffd49a",
        sunGlow: "#ffb15a",
        sun: "#ffeec0",
        landFar: "#b3a98f",
        landNear: "#5a5536",
        water: "#9a9a86",
        haze: "#e6cfa6"
    },
    cool: {
        skyTop: "#4f86bf",
        skyMid: "#a8c0cf",
        skyBottom: "#ffe7bd",
        sunGlow: "#ffd486",
        sun: "#fff6dc",
        landFar: "#aebca6",
        landNear: "#5a6238",
        water: "#86a8ad",
        haze: "#e2dcb8"
    }
};
const misty = {
    name: "misty",
    label: "Soft mist",
    warm: {
        skyTop: "#9fb0c8",
        skyMid: "#c8d2dd",
        skyBottom: "#f3e2d6",
        sunGlow: "#f6d9bd",
        sun: "#fff4ea",
        landFar: "#bcc7cf",
        landNear: "#5e7064",
        water: "#aebecb",
        haze: "#dfe6ec"
    },
    cool: {
        skyTop: "#8fa9c2",
        skyMid: "#c2d2df",
        skyBottom: "#e8f1f5",
        sunGlow: "#f2ecde",
        sun: "#fdfbf6",
        landFar: "#c0ccd2",
        landNear: "#5f7468",
        water: "#a8c0cd",
        haze: "#e4edf1"
    }
};
const alpine = {
    name: "alpine",
    label: "Alpine air",
    warm: {
        skyTop: "#2f63a8",
        skyMid: "#7ba6cf",
        skyBottom: "#ecd8c0",
        sunGlow: "#ffd29a",
        sun: "#fff4dc",
        landFar: "#9fb6c2",
        landNear: "#3e5a4e",
        water: "#6fa0c0",
        haze: "#cfdfe8"
    },
    cool: {
        skyTop: "#1f5fb8",
        skyMid: "#6fa8e0",
        skyBottom: "#dceff8",
        sunGlow: "#f4f4ec",
        sun: "#ffffff",
        landFar: "#a8c2cc",
        landNear: "#42604f",
        water: "#5a9fd6",
        haze: "#d6ebf4"
    }
};
const PALETTES1 = {
    day,
    golden,
    misty,
    alpine
};
const PALETTE_NAMES1 = [
    "day",
    "golden",
    "misty",
    "alpine"
];
function getPalette1(name) {
    return PALETTES1[name] ?? day;
}
const spring = {
    name: "spring",
    label: "Spring",
    colors: {
        foliage: "#8ace6b",
        foliageDeep: "#4f9a52",
        trunk: "#6b4f3a",
        ground: "#8fd172",
        groundFar: "#a9d8a0",
        bloom: "#ffd1e8",
        snow: 0
    }
};
const summer = {
    name: "summer",
    label: "Summer",
    colors: {
        foliage: "#54b25a",
        foliageDeep: "#2f7d3e",
        trunk: "#5e463a",
        ground: "#6cbf57",
        groundFar: "#93c489",
        bloom: "#ffe27a",
        snow: 0
    }
};
const autumn = {
    name: "autumn",
    label: "Autumn",
    colors: {
        foliage: "#e0953e",
        foliageDeep: "#a85a2a",
        trunk: "#5a4032",
        ground: "#c9a85f",
        groundFar: "#bda874",
        bloom: "#e8543a",
        snow: 0
    }
};
const winter = {
    name: "winter",
    label: "Winter",
    colors: {
        foliage: "#7f9b91",
        foliageDeep: "#4a665f",
        trunk: "#4e463f",
        ground: "#e2ecf0",
        groundFar: "#cad8df",
        bloom: "#eaf4ff",
        snow: 1
    }
};
const SEASONS = {
    spring,
    summer,
    autumn,
    winter
};
const SEASON_NAMES = [
    "spring",
    "summer",
    "autumn",
    "winter"
];
function getSeason(name) {
    return SEASONS[name] ?? summer;
}
const CONFIG_SCHEMA1 = [
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
        help: "Scroll speed. 0 holds the landscape still."
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
        default: 0.85,
        help: "Camera distance. Higher zooms in (bigger trees, fewer on screen)."
    },
    {
        key: "cameraHeight",
        label: "Vertical aim",
        group: "Camera",
        type: "range",
        min: -0.25,
        max: 0.25,
        step: 0.01,
        default: -0.04,
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
        default: 0.015,
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
        group: "Land",
        type: "seed",
        default: "sunny meadow",
        help: "Same seed + settings reproduces the exact landscape."
    },
    {
        key: "parallaxLayers",
        label: "Depth layers",
        group: "Land",
        type: "range",
        min: 2,
        max: 6,
        step: 1,
        default: 4,
        help: "Number of parallax land bands (rolling hills front to back)."
    },
    {
        key: "spawnDensity",
        label: "Density",
        group: "Land",
        type: "range",
        min: 0.4,
        max: 1.8,
        step: 0.05,
        default: 0.75,
        help: "How tightly trees, cabins and rocks pack in."
    },
    {
        key: "waterLevel",
        label: "Water",
        group: "Land",
        type: "range",
        min: 0,
        max: 0.5,
        step: 0.02,
        default: 0.16,
        help: "Fraction of the bottom that is calm water (lake/river). 0 = no water."
    },
    {
        key: "bankHeight",
        label: "Bank",
        group: "Land",
        type: "range",
        min: 0,
        max: 0.07,
        step: 0.005,
        default: 0.02,
        help: "Grassy bank between the land and the water."
    },
    {
        key: "mountains",
        label: "Mountains",
        group: "Land",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.8,
        help: "Prominence of the distant mountain range. 0 = open horizon."
    },
    {
        key: "biomeVariety",
        label: "Biome journey",
        group: "Land",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.4,
        help: "Drift between meadow, forest and alpine as you scroll. 0 = uniform landscape."
    },
    {
        key: "biomeScale",
        label: "Region length",
        group: "Land",
        type: "range",
        min: 1,
        max: 12,
        step: 0.5,
        default: 5,
        help: "How long each meadow/forest stretch lasts (world units). Higher = longer."
    },
    {
        key: "palette",
        label: "Light",
        group: "Day",
        type: "select",
        default: "day",
        options: PALETTE_NAMES1.map((n)=>({
                value: n,
                label: PALETTES1[n].label
            }))
    },
    {
        key: "dayCycleSeconds",
        label: "Day length",
        group: "Day",
        type: "range",
        min: 15,
        max: 600,
        step: 5,
        default: 120,
        unit: "s",
        help: "Seconds for one sunrise → midday → golden dusk → sunrise breath."
    },
    {
        key: "brightness",
        label: "Brightness",
        group: "Day",
        type: "range",
        min: 0.3,
        max: 1,
        step: 0.02,
        default: 0.82,
        help: "Overall daylight. Stays bright — this is a day scene."
    },
    {
        key: "warmth",
        label: "Warmth",
        group: "Day",
        type: "range",
        min: 0,
        max: 1,
        step: 0.02,
        default: 0.5,
        help: "Bias the day toward warm/golden (1) or cool/midday (0)."
    },
    {
        key: "haze",
        label: "Haze",
        group: "Day",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.4,
        help: "Atmospheric haze softening the distant mountains. 0 = crystal clear."
    },
    {
        key: "vignette",
        label: "Vignette",
        group: "Day",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 1,
        help: "Darken the frame toward the corners (+ faint grain). 0 = off."
    },
    {
        key: "season",
        label: "Season",
        group: "Season",
        type: "select",
        default: "summer",
        options: SEASON_NAMES.map((n)=>({
                value: n,
                label: SEASONS[n].label
            }))
    },
    {
        key: "seasonCycle",
        label: "Cycle seasons",
        group: "Season",
        type: "toggle",
        default: false,
        help: "Slowly drift spring → summer → autumn → winter and round again."
    },
    {
        key: "seasonCycleSeconds",
        label: "Year length",
        group: "Season",
        type: "range",
        min: 30,
        max: 1200,
        step: 10,
        default: 300,
        unit: "s",
        help: "Seconds for one full year when 'Cycle seasons' is on."
    },
    {
        key: "rain",
        label: "Rain",
        group: "Weather",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0,
        help: "Drifting rain + ripples on the water. Clouds thicken with it."
    },
    {
        key: "snowfall",
        label: "Snowfall",
        group: "Weather",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0,
        help: "Falling snow. Lovely with the winter season."
    },
    {
        key: "rainbow",
        label: "Rainbow",
        group: "Weather",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0,
        help: "A soft arc, brightest while it's raining in the sun."
    },
    {
        key: "sunRays",
        label: "Sun rays",
        group: "Weather",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.4,
        help: "God-rays fanning down from the sun through the clouds."
    },
    {
        key: "wind",
        label: "Wind",
        group: "Weather",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.3,
        help: "Sways the trees, tilts the rain, hurries the clouds."
    },
    {
        key: "wildlife",
        label: "Wildlife",
        group: "Wildlife",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.6,
        help: "Deer grazing the hills, fish rising in the water, butterflies."
    },
    {
        key: "clouds",
        label: "Clouds",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.6
    },
    {
        key: "birds",
        label: "Birds",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.7
    },
    {
        key: "flyers",
        label: "Balloons & co.",
        group: "Sky",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.6,
        help: "Rare crossers: a hot-air balloon, a soaring eagle, a drifting leaf."
    },
    {
        key: "audioEnabled",
        label: "Ambient sound",
        group: "Audio",
        type: "toggle",
        default: false,
        help: "Synthesised breeze + sparse birdsong & water. Off by default."
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
function buildDefaults2(schema = CONFIG_SCHEMA1) {
    return buildDefaults(schema);
}
const DEFAULT_CONFIG1 = buildDefaults2();
function normalizeConfig2(input) {
    return normalizeConfig(CONFIG_SCHEMA1, input);
}
function parseLight(c) {
    return {
        skyTop: fromHex(c.skyTop),
        skyMid: fromHex(c.skyMid),
        skyBottom: fromHex(c.skyBottom),
        sunGlow: fromHex(c.sunGlow),
        sun: fromHex(c.sun),
        landFar: fromHex(c.landFar),
        landNear: fromHex(c.landNear),
        water: fromHex(c.water),
        haze: fromHex(c.haze)
    };
}
function parseLand(c) {
    return {
        foliage: fromHex(c.foliage),
        foliageDeep: fromHex(c.foliageDeep),
        trunk: fromHex(c.trunk),
        ground: fromHex(c.ground),
        groundFar: fromHex(c.groundFar),
        bloom: fromHex(c.bloom),
        snow: c.snow
    };
}
const SNOW_BASE = rgb(244, 248, 252);
class MoodEngine1 {
    mood;
    #palette;
    #warm;
    #cool;
    #seasons;
    #noise;
    constructor(config, seed){
        this.#palette = getPalette1(config.palette);
        this.#warm = parseLight(this.#palette.warm);
        this.#cool = parseLight(this.#palette.cool);
        this.#seasons = {};
        for (const name of SEASON_NAMES){
            this.#seasons[name] = parseLand(SEASONS[name].colors);
        }
        this.#noise = createNoise1D((seed ^ 0x5ea50f) >>> 0, 2);
        const land = this.#seasons[getSeason(config.season).name] ?? this.#seasons.summer;
        this.mood = {
            phase: 0.5,
            warmth: 0.4,
            daylight: config.brightness,
            sunX: 0.5,
            sunHeight: 1,
            seasonT: 0,
            snow: land.snow,
            sky: [
                {
                    at: 0,
                    color: this.#cool.skyTop
                },
                {
                    at: 0.55,
                    color: this.#cool.skyMid
                },
                {
                    at: 1,
                    color: this.#cool.skyBottom
                }
            ],
            sunGlow: this.#cool.sunGlow,
            sun: this.#cool.sun,
            landFar: this.#cool.landFar,
            landNear: this.#cool.landNear,
            haze: this.#cool.haze,
            water: this.#cool.water,
            foliage: land.foliage,
            foliageDeep: land.foliageDeep,
            trunk: land.trunk,
            ground: land.ground,
            groundFar: land.groundFar,
            bloom: land.bloom,
            snowColor: SNOW_BASE
        };
        this.update(0, config);
    }
    setPalette(name) {
        this.#palette = getPalette1(name);
        this.#warm = parseLight(this.#palette.warm);
        this.#cool = parseLight(this.#palette.cool);
    }
    update(timeMs, config) {
        const cycleMs = Math.max(1, config.dayCycleSeconds * 1000);
        const phase = (timeMs / cycleMs + 0.28) % 1;
        const breath = cosinePulse(phase);
        const wander = (this.#noise.at(phase * 0.5 + timeMs / cycleMs * 0.13) - 0.5) * 0.12;
        const warmth = clamp(0.5 + (0.5 - breath) * 0.82 + (config.warmth - 0.5) * 0.9 + wander, 0, 1);
        const daylight = clamp(config.brightness * (0.72 + 0.28 * breath), 0.2, 1);
        const shade = (1 - daylight) * 0.32;
        const sunX = phase;
        const sunHeight = clamp(Math.sin(phase * Math.PI), 0, 1);
        const { land, seasonT } = this.#resolveSeason(timeMs, config);
        const t = 1 - warmth;
        const w = this.#warm;
        const c = this.#cool;
        const blendLight = (k)=>mix(w[k], c[k], t);
        const skyTop = darken(blendLight("skyTop"), shade);
        const skyMid = darken(blendLight("skyMid"), shade * 0.8);
        const skyBottom = darken(blendLight("skyBottom"), shade * 0.5);
        const m = this.mood;
        m.phase = phase;
        m.warmth = warmth;
        m.daylight = daylight;
        m.sunX = sunX;
        m.sunHeight = sunHeight;
        m.seasonT = seasonT;
        m.snow = clamp(land.snow, 0, 1);
        m.sky[0].color = skyTop;
        m.sky[1].color = skyMid;
        m.sky[2].color = skyBottom;
        m.sunGlow = blendLight("sunGlow");
        m.sun = blendLight("sun");
        m.haze = darken(blendLight("haze"), shade * 0.5);
        m.landFar = darken(blendLight("landFar"), shade * 0.6);
        m.landNear = darken(blendLight("landNear"), shade * 0.7);
        m.water = darken(blendLight("water"), shade * 0.6);
        m.foliage = darken(land.foliage, shade * 0.7);
        m.foliageDeep = darken(land.foliageDeep, shade * 0.7);
        m.trunk = darken(land.trunk, shade * 0.5);
        m.ground = darken(land.ground, shade * 0.6);
        m.groundFar = darken(land.groundFar, shade * 0.5);
        m.bloom = land.bloom;
        m.snowColor = mix(SNOW_BASE, m.sunGlow, 0.14 * warmth);
    }
    #resolveSeason(timeMs, config) {
        const base = Math.max(0, SEASON_NAMES.indexOf(config.season));
        if (!config.seasonCycle) {
            return {
                land: this.#seasons[SEASON_NAMES[base]],
                seasonT: 0
            };
        }
        const yearMs = Math.max(1, config.seasonCycleSeconds * 1000);
        const pos = base + timeMs / yearMs;
        const idx = Math.floor(pos) % SEASON_NAMES.length;
        const seasonT = pos - Math.floor(pos);
        const a = this.#seasons[SEASON_NAMES[idx]];
        const b = this.#seasons[SEASON_NAMES[(idx + 1) % SEASON_NAMES.length]];
        return {
            land: blendLand(a, b, seasonT),
            seasonT
        };
    }
}
function blendLand(a, b, t) {
    return {
        foliage: mix(a.foliage, b.foliage, t),
        foliageDeep: mix(a.foliageDeep, b.foliageDeep, t),
        trunk: mix(a.trunk, b.trunk, t),
        ground: mix(a.ground, b.ground, t),
        groundFar: mix(a.groundFar, b.groundFar, t),
        bloom: mix(a.bloom, b.bloom, t),
        snow: lerp(a.snow, b.snow, t)
    };
}
function landColor(mood, depth) {
    const base = mix(mood.landFar, mood.landNear, depth);
    const haze = (1 - depth) * 0.6;
    return mix(base, mood.haze, haze);
}
function foliageColor(mood, depth, lit = true) {
    const base = lit ? mood.foliage : mood.foliageDeep;
    const haze = (1 - depth) * 0.5;
    return mix(base, mood.haze, haze);
}
function snowAt(mood, depth) {
    return mix(mood.snowColor, mood.haze, (1 - depth) * 0.45);
}
class AmbientEventBus1 {
    #listeners = new Set();
    on(fn) {
        this.#listeners.add(fn);
        return ()=>this.#listeners.delete(fn);
    }
    emit(event) {
        for (const fn of this.#listeners)fn(event);
    }
}
const TYPE_WEIGHTS1 = {
    birdsong: 4,
    breeze: 4,
    water: 2,
    rustle: 1.5
};
const TYPES1 = Object.keys(TYPE_WEIGHTS1);
const WEIGHTS1 = TYPES1.map((t)=>TYPE_WEIGHTS1[t]);
class AmbientDirector1 {
    #rng;
    #bus;
    #timer;
    constructor(rng, bus){
        this.#rng = rng;
        this.#bus = bus;
        this.#timer = this.#nextInterval();
    }
    #nextInterval() {
        return this.#rng.float(5000, 18000);
    }
    update(dt, config) {
        this.#timer -= dt * (1 + config.wind * 0.5);
        if (this.#timer > 0) return;
        this.#timer = this.#nextInterval();
        const weights = config.rain > 0.2 ? TYPES1.map((t, i)=>t === "water" ? WEIGHTS1[i] * 2.5 : t === "birdsong" ? WEIGHTS1[i] * 0.4 : WEIGHTS1[i]) : WEIGHTS1;
        const type = this.#rng.weighted(TYPES1, weights);
        this.#bus.emit({
            type,
            intensity: this.#rng.float(0.25, type === "breeze" ? 0.7 : 0.55),
            pan: this.#rng.float(-0.8, 0.8)
        });
    }
}
class SkyBackdrop1 {
    depth = 0;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #mood;
    #horizon = 0.82;
    update(ctx) {
        this.#mood = ctx.env.mood;
        this.#horizon = 1 - ctx.env.config.waterLevel - ctx.env.config.bankHeight;
    }
    draw(ctx) {
        const { out, width, height } = ctx;
        const mood = this.#mood;
        out.gradient(0, 0, width, height, mood.sky, true);
        out.rect(0, -height * 0.3, width, height * 0.3, mood.sky[0].color);
        const glow = mood.sunGlow;
        const band = height * 0.55;
        out.gradient(0, height * this.#horizon - band * 0.7, width, band, [
            {
                at: 0,
                color: withAlpha(glow, 0)
            },
            {
                at: 0.7,
                color: withAlpha(glow, 0.4)
            },
            {
                at: 1,
                color: withAlpha(glow, 0)
            }
        ], true);
    }
}
const BAND_HUES = [
    0,
    35,
    55,
    130,
    210,
    270
];
class Rainbow {
    depth = 0.05;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #knob = 0;
    #rain = 0;
    #mood;
    #horizon = 0.82;
    update(ctx) {
        this.#knob = ctx.env.config.rainbow;
        this.#rain = ctx.env.config.rain;
        this.#mood = ctx.env.mood;
        this.#horizon = 1 - ctx.env.config.waterLevel - ctx.env.config.bankHeight;
    }
    draw(ctx) {
        const mood = this.#mood;
        const vis = this.#knob * (0.45 + 0.55 * this.#rain) * (0.4 + 0.6 * mood.sunHeight);
        if (vis <= 0.02) return;
        const { out, width, height } = ctx;
        const cx = (1 - mood.sunX) * width;
        const cy = this.#horizon * height + height * 0.12;
        const outerR = Math.min(width, height) * 0.95;
        const bandW = Math.max(2, outerR * 0.012);
        for(let b = 0; b < BAND_HUES.length; b++){
            const r1 = outerR - b * bandW;
            const col = hsl(BAND_HUES[b], 0.6, 0.62);
            const c = withAlpha(col, vis * 0.32);
            let prevX = cx + Math.cos(Math.PI) * r1;
            let prevY = cy + Math.sin(Math.PI) * r1;
            for(let s = 1; s <= 30; s++){
                const a = Math.PI + Math.PI * s / 30;
                const x = cx + Math.cos(a) * r1;
                const y = cy + Math.sin(a) * r1;
                out.line(prevX, prevY, x, y, bandW + 1, c);
                prevX = x;
                prevY = y;
            }
        }
    }
}
function sunPlacement(mood, width, height) {
    const horizonY = (1 - 0.18) * height;
    const x = mood.sunX * width;
    const y = lerp(horizonY * 0.96, height * 0.12, mood.sunHeight);
    const r1 = Math.min(width, height) * 0.05;
    const opacity = smoothstep(0.04, 0.22, mood.sunHeight);
    return {
        x,
        y,
        r: r1,
        opacity
    };
}
class Sun {
    depth = 0.02;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #mood;
    update(ctx) {
        this.#mood = ctx.env.mood;
    }
    draw(ctx) {
        const { out, width, height } = ctx;
        const mood = this.#mood;
        const p = sunPlacement(mood, width, height);
        if (p.opacity < 0.01) return;
        const sun = mood.sun;
        out.glow(p.x, p.y, p.r * 5.5, withAlpha(mood.sunGlow, 0.22 * p.opacity), 0.6);
        out.glow(p.x, p.y, p.r * 2.6, withAlpha(sun, 0.5 * p.opacity), 0.85);
        out.circle(p.x, p.y, p.r, withAlpha(lighten(sun, 0.1), clamp(p.opacity, 0, 1)));
    }
}
class MountainRange {
    depth = 0.1;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #ridges;
    #mood;
    #prominence = 0.8;
    #horizon = 0.82;
    constructor(rng){
        this.#ridges = [
            makeRidge(rng.fork("back"), {
                depth: 0.07,
                tone: 0.18,
                tileW: 2000,
                count: 5,
                hi: 0.42
            }),
            makeRidge(rng.fork("front"), {
                depth: 0.15,
                tone: 0.34,
                tileW: 1500,
                count: 6,
                hi: 0.3
            })
        ];
    }
    update(ctx) {
        this.#mood = ctx.env.mood;
        this.#prominence = ctx.env.config.mountains;
        this.#horizon = 1 - ctx.env.config.waterLevel - ctx.env.config.bankHeight;
    }
    draw(ctx) {
        if (this.#prominence <= 0.001) return;
        const { out, width, height } = ctx;
        const mood = this.#mood;
        const baseY = this.#horizon * height + height * 0.04;
        for (const ridge of this.#ridges){
            const tint = landColor(mood, ridge.tone);
            const snow = snowAt(mood, ridge.tone);
            const scroll = ctx.camera.scroll * ctx.camera.parallaxAt(ridge.depth) * ctx.camera.unit;
            for (const pk of ridge.peaks){
                const baseX = wrap(pk.xFrac * ridge.tileW - scroll, ridge.tileW);
                for(let tx = baseX; tx < width + ridge.tileW; tx += ridge.tileW){
                    if (tx - pk.halfWidth * height > width) continue;
                    drawPeak(out, tx, baseY, pk, height, this.#prominence, tint, snow, mood.snow);
                }
            }
        }
    }
}
function makeRidge(rng, o) {
    const peaks = [];
    for(let i = 0; i < o.count; i++){
        peaks.push({
            xFrac: (i + rng.float(-0.3, 0.3)) / o.count,
            height: rng.float(o.hi * 0.55, o.hi),
            halfWidth: rng.float(o.hi * 0.7, o.hi * 1.2)
        });
    }
    return {
        depth: o.depth,
        tone: o.tone,
        tileW: o.tileW,
        peaks
    };
}
function drawPeak(out, cx, baseY, pk, vh, prominence, tint, snowColor, snowAmount) {
    const h = pk.height * vh * (0.4 + prominence * 0.6);
    const hw = pk.halfWidth * vh;
    const apexY = baseY - h;
    out.polygon([
        cx - hw,
        baseY,
        cx + hw,
        baseY,
        cx,
        apexY
    ], withAlpha(tint, 0.92));
    const cap = clamp(0.18 + snowAmount * 0.4, 0.18, 0.55);
    const capHW = hw * cap;
    const capY = apexY + h * cap;
    out.polygon([
        cx - capHW,
        capY,
        cx + capHW,
        capY,
        cx,
        apexY
    ], withAlpha(snowColor, 0.5 + snowAmount * 0.45));
}
class CloudField1 {
    depth = 0.12;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #tileW;
    #clouds;
    #chance = 0.6;
    #rain = 0;
    #wind = 0;
    #time = 0;
    #mood;
    constructor(rng, count = 8, tileW = 2400){
        this.#tileW = tileW;
        this.#clouds = Array.from({
            length: count
        }, ()=>{
            const scale = rng.float(0.7, 1.8);
            const puffCount = rng.int(4, 7);
            const puffs = [];
            for(let i = 0; i < puffCount; i++){
                puffs.push({
                    dx: rng.float(-1, 1) * 46 * scale,
                    dy: rng.float(-1, 1) * 12 * scale,
                    r: rng.float(16, 34) * scale
                });
            }
            return {
                x: rng.float(0, tileW),
                yFrac: rng.float(0.06, 0.42),
                scale,
                drift: rng.float(-0.005, 0.005),
                alpha: rng.float(0.5, 0.85),
                puffs
            };
        });
    }
    update(ctx) {
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
        this.#chance = ctx.env.config.clouds;
        this.#rain = ctx.env.config.rain;
        this.#wind = ctx.env.config.wind;
    }
    draw(ctx) {
        const cover = clamp(this.#chance + this.#rain * 0.6, 0, 1);
        if (cover <= 0.001) return;
        const { out, width, height } = ctx;
        const scroll = ctx.camera.scroll * ctx.camera.parallaxAt(this.depth) * ctx.camera.unit;
        const shown = Math.max(1, Math.floor(this.#clouds.length * Math.min(1, cover + 0.05)));
        const lit = mix(this.#mood.snowColor, this.#mood.sky[1].color, 0.18);
        const grey = mix(lit, this.#mood.landNear, 0.4);
        const tone = mix(lit, grey, this.#rain);
        const windDrift = this.#wind * 0.004;
        for(let i = 0; i < shown; i++){
            const c = this.#clouds[i];
            const cx = wrap(c.x - scroll + (c.drift + windDrift) * this.#time, this.#tileW);
            if (cx > width + 120) continue;
            const cy = (c.yFrac + this.#rain * 0.05) * height;
            const col = withAlpha(tone, c.alpha * clamp(cover + 0.2, 0, 1));
            for (const p of c.puffs)out.circle(cx + p.dx, cy + p.dy, p.r, col);
        }
    }
}
class SunRays {
    depth = 0.14;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #strength = 0.4;
    #time = 0;
    #mood;
    update(ctx) {
        this.#strength = ctx.env.config.sunRays;
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
    }
    draw(ctx) {
        if (this.#strength <= 0.001) return;
        const { out, width, height } = ctx;
        const sun = sunPlacement(this.#mood, width, height);
        if (sun.opacity < 0.05) return;
        const reach = height * 1.1;
        const base = this.#strength * sun.opacity;
        for(let i = 0; i < 7; i++){
            const spread = (i / (7 - 1) - 0.5) * 1.3;
            const angle = Math.PI / 2 + spread;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const fx = sun.x + dx * reach;
            const fy = sun.y + dy * reach;
            const halfW = width * 0.018 * (0.6 + Math.abs(spread));
            const px = -dy * halfW;
            const py = dx * halfW;
            const shimmer = 0.55 + 0.45 * Math.sin(this.#time * 0.0008 + i * 1.7);
            const a = base * 0.1 * shimmer;
            out.polygon([
                sun.x,
                sun.y,
                fx + px,
                fy + py,
                fx - px,
                fy - py
            ], withAlpha(this.#mood.sun, a));
        }
    }
}
const BASKET = rgb(96, 66, 42);
class FlyerDirector1 {
    depth = 0.18;
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
        this.#timer = rng.float(6000, 16000);
    }
    update(ctx) {
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
        const chance = ctx.env.config.flyers;
        if (this.#flyer) {
            this.#flyer.progress += this.#flyer.speed * ctx.dt;
            if (this.#flyer.progress > 1) this.#flyer = null;
            return;
        }
        if (chance <= 0) return;
        this.#timer -= ctx.dt * (0.25 + chance);
        if (this.#timer > 0) return;
        this.#timer = this.#rng.float(11000, 28000);
        this.#flyer = this.#spawn();
    }
    #spawn() {
        const type = this.#rng.weighted([
            "balloon",
            "eagle",
            "leaf"
        ], [
            2,
            3,
            2
        ]);
        const dir = this.#rng.bool() ? 1 : -1;
        const x0 = dir > 0 ? -0.06 : 1.06;
        const x1 = dir > 0 ? 1.06 : -0.06;
        if (type === "leaf") {
            const sx = this.#rng.float(0.1, 0.9);
            return {
                type,
                progress: 0,
                speed: this.#rng.float(0.00012, 0.0002),
                x0: sx,
                y0: this.#rng.float(0.1, 0.3),
                x1: sx + this.#rng.float(-0.2, 0.2),
                y1: this.#rng.float(0.55, 0.75),
                hue: 0
            };
        }
        const y = this.#rng.float(0.1, type === "balloon" ? 0.34 : 0.4);
        const speed = type === "balloon" ? this.#rng.float(0.00004, 0.00008) : this.#rng.float(0.0001, 0.00018);
        return {
            type,
            progress: 0,
            speed,
            x0,
            y0: y,
            x1,
            y1: y + this.#rng.float(-0.04, 0.04),
            hue: this.#rng.float(0, 360)
        };
    }
    draw(ctx) {
        const f = this.#flyer;
        if (!f) return;
        const { out, width, height } = ctx;
        const t = f.progress;
        const x = (f.x0 + (f.x1 - f.x0) * t) * width;
        const y = (f.y0 + (f.y1 - f.y0) * t) * height;
        const ref = Math.min(width, height);
        if (f.type === "balloon") {
            const bob = Math.sin(this.#time * 0.0009) * ref * 0.006;
            drawBalloon(out, x, y + bob, ref * 0.05, f.hue);
            return;
        }
        if (f.type === "eagle") {
            const glide = Math.sin(this.#time * 0.0016) * ref * 0.012;
            drawEagle(out, x, y + glide, ref * 0.022, this.#time, darken(this.#mood.landNear, 0.05));
            return;
        }
        const sway = Math.sin(t * 24 + this.#time * 0.004) * width * 0.02;
        const leaf = mix(this.#mood.bloom, this.#mood.foliage, 0.4);
        drawLeaf(out, x + sway, y, ref * 0.012, this.#time, leaf);
    }
}
function drawBalloon(out, x, y, r1, hue) {
    const envelope = hsl(hue, 0.55, 0.6);
    const stripe = hsl((hue + 30) % 360, 0.6, 0.66);
    out.circle(x, y, r1, envelope);
    out.circle(x - r1 * 0.5, y + r1 * 0.1, r1 * 0.7, stripe);
    out.circle(x + r1 * 0.5, y + r1 * 0.1, r1 * 0.7, stripe);
    out.circle(x, y, r1 * 0.62, envelope);
    out.polygon([
        x - r1 * 0.5,
        y + r1 * 0.7,
        x + r1 * 0.5,
        y + r1 * 0.7,
        x + r1 * 0.18,
        y + r1 * 1.5,
        x - r1 * 0.18,
        y + r1 * 1.5
    ], envelope);
    out.line(x - r1 * 0.3, y + r1 * 1.5, x - r1 * 0.15, y + r1 * 1.9, Math.max(1, r1 * 0.05), BASKET);
    out.line(x + r1 * 0.3, y + r1 * 1.5, x + r1 * 0.15, y + r1 * 1.9, Math.max(1, r1 * 0.05), BASKET);
    out.rect(x - r1 * 0.22, y + r1 * 1.9, r1 * 0.44, r1 * 0.4, BASKET);
}
function drawEagle(out, x, y, size, time, color) {
    const flap = Math.sin(time * 0.004) * 0.5;
    const lift = (0.5 + flap) * size;
    const w = Math.max(1, size * 0.3);
    out.line(x - size * 1.6, y + lift, x, y, w, color);
    out.line(x, y, x + size * 1.6, y + lift, w, color);
    out.circle(x, y + size * 0.1, size * 0.26, color);
}
function drawLeaf(out, x, y, size, time, color) {
    const squash = Math.abs(Math.cos(time * 0.006));
    const w = Math.max(1, size * (0.3 + squash));
    out.polygon([
        x - w,
        y,
        x,
        y - size,
        x + w,
        y,
        x,
        y + size
    ], withAlpha(color, 0.95));
}
class BirdDirector1 {
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
        this.#timer = rng.float(2000, 9000);
    }
    update(ctx) {
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
        const chance = ctx.env.config.birds;
        if (this.#flock) {
            this.#flock.progress += this.#flock.speed * ctx.dt;
            if (this.#flock.progress > 1.2) this.#flock = null;
            return;
        }
        if (chance <= 0) return;
        this.#timer -= ctx.dt * (0.3 + chance);
        if (this.#timer > 0) return;
        this.#timer = this.#rng.float(5000, 16000);
        const dir = this.#rng.bool() ? 1 : -1;
        this.#flock = {
            yFrac: this.#rng.float(0.14, 0.46),
            dir,
            speed: this.#rng.float(0.00018, 0.0003),
            progress: 0,
            size: this.#rng.float(5, 9),
            count: this.#rng.int(3, 8)
        };
    }
    draw(ctx) {
        const f = this.#flock;
        if (!f) return;
        const { out, width, height } = ctx;
        const color = withAlpha(darken(this.#mood.landNear, 0.1), 0.7);
        const flap = Math.sin(this.#time * 0.012);
        const headX = f.dir > 0 ? f.progress * (width + 200) - 100 : width + 100 - f.progress * (width + 200);
        for(let i = 0; i < f.count; i++){
            const off = i * f.size * 2.4;
            const bx = headX - f.dir * off;
            const by = f.yFrac * height + Math.abs(i - (f.count - 1) / 2) * f.size * 0.9;
            drawBird1(out, bx, by, f.size, flap, color);
        }
    }
}
function drawBird1(out, x, y, size, flap, color) {
    const wing = clamp(0.4 + flap * 0.5, 0.1, 0.9) * size;
    out.line(x - size, y + wing, x, y, Math.max(1, size * 0.18), color);
    out.line(x, y, x + size, y + wing, Math.max(1, size * 0.18), color);
}
class Lake {
    depth = 1;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #mood;
    #level = 0.16;
    #time = 0;
    #shimmer;
    constructor(rng){
        this.#shimmer = Array.from({
            length: 7
        }, ()=>rng.float(0.04, 0.8));
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
        const top = mix(mood.water, mood.sunGlow, 0.18);
        const bottom = darken(mood.water, 0.34);
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
        out.gradient(0, waterY, width, waterH * 0.6, [
            {
                at: 0,
                color: withAlpha(mood.sky[2].color, 0.5)
            },
            {
                at: 1,
                color: withAlpha(mood.sky[1].color, 0)
            }
        ], true);
        out.line(0, waterY, width, waterY, 1, withAlpha(lighten(mood.sunGlow, 0.1), 0.5));
        const sun = sunPlacement(mood, width, height);
        if (sun.opacity > 0.05) {
            const colW = Math.max(8, width * 0.05);
            for(let i = 0; i < 5; i++){
                const f = i / (5 - 1);
                const y = waterY + f * waterH * 0.9;
                const wob = Math.sin(this.#time * 0.002 + i * 1.3) * colW * 0.5;
                const a = (1 - f) * 0.3 * sun.opacity;
                out.gradient(sun.x - colW / 2 + wob, y, colW, waterH * 0.18, [
                    {
                        at: 0,
                        color: withAlpha(mood.sun, a)
                    },
                    {
                        at: 1,
                        color: withAlpha(mood.sun, 0)
                    }
                ], true);
            }
        }
        const shimmer = lighten(mood.water, 0.2);
        for(let i = 0; i < this.#shimmer.length; i++){
            const f = this.#shimmer[i];
            const y = waterY + f * waterH;
            const pulse = 0.5 + 0.5 * Math.sin(this.#time * 0.0012 + i * 1.7);
            const a = (1 - f) * 0.09 * pulse;
            out.line(0, y, width, y, 1, withAlpha(shimmer, a));
        }
    }
}
const TUFT_SPACING = 0.05;
class Meadow {
    depth = 1;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #mood;
    #water = 0.16;
    #bank = 0.02;
    #time = 0;
    #wind = 0;
    #flowerPhase;
    constructor(rng){
        this.#flowerPhase = rng.float(0, 1);
    }
    update(ctx) {
        this.#mood = ctx.env.mood;
        this.#water = ctx.env.config.waterLevel;
        this.#bank = ctx.env.config.bankHeight;
        this.#time = ctx.time;
        this.#wind = ctx.env.config.wind;
    }
    draw(ctx) {
        if (this.#bank <= 0.001) return;
        const { out, width, height } = ctx;
        const mood = this.#mood;
        const waterY = (1 - this.#water) * height;
        const bandH = this.#bank * height;
        const bankTopY = waterY - bandH;
        const grassTop = lighten(mix(mood.ground, mood.foliageDeep, 0.3), 0.04);
        const grassBot = darken(mood.ground, 0.12);
        out.gradient(0, bankTopY, width, bandH, [
            {
                at: 0,
                color: grassTop
            },
            {
                at: 1,
                color: grassBot
            }
        ], true);
        if (mood.snow > 0.02) {
            out.gradient(0, bankTopY, width, bandH * 0.7, [
                {
                    at: 0,
                    color: withAlpha(mood.snowColor, mood.snow * 0.55)
                },
                {
                    at: 1,
                    color: withAlpha(mood.snowColor, 0)
                }
            ], true);
        }
        out.line(0, waterY, width, waterY, 1, withAlpha(lighten(mood.water, 0.18), 0.55));
        const cam = ctx.camera;
        const leftWU = cam.viewLeft(0.92);
        const rightWU = leftWU + width / cam.unit;
        const tuftH = Math.max(3, bandH * 1.1);
        const grass = darken(mix(mood.ground, mood.foliageDeep, 0.5), 0.05);
        const sway = Math.sin(this.#time * 0.0014) * this.#wind * tuftH * 0.25;
        let x = Math.ceil((leftWU - 0.05) / 0.05) * 0.05;
        for(; x <= rightWU + 0.05; x += TUFT_SPACING){
            const sx = cam.project(x, 0.92);
            if (sx < -8 || sx > width + 8) continue;
            drawTuft(out, sx, bankTopY, tuftH, sway, grass);
            const r1 = pseudo(x);
            if (mood.snow < 0.5 && r1 < 0.34) {
                drawFlower(out, sx, bankTopY, tuftH, mood.bloom, r1);
                drawReflection(out, sx, waterY, height - waterY, mood.bloom, this.#time, this.#flowerPhase);
            }
        }
    }
}
function drawTuft(out, x, bankTopY, h, sway, color) {
    for(let i = -1; i <= 1; i++){
        out.line(x, bankTopY, x + i * h * 0.3 + sway, bankTopY - h, Math.max(1, h * 0.14), color);
    }
}
function drawFlower(out, x, bankTopY, h, bloom, r1) {
    const stemTop = bankTopY - h * (1.1 + r1 * 0.5);
    out.line(x, bankTopY, x, stemTop, Math.max(1, h * 0.1), darken(bloom, 0.55));
    out.circle(x, stemTop, Math.max(1, h * 0.26), bloom);
}
function drawReflection(out, x, waterY, waterH, color, time, phase) {
    if (waterH <= 0) return;
    const reflH = waterH * 0.4;
    const wob = Math.sin(time * 0.0012 + x * 0.05 + phase * 6) * 2;
    out.gradient(x - 3 / 2 + wob, waterY, 3, reflH, [
        {
            at: 0,
            color: withAlpha(color, 0.28)
        },
        {
            at: 1,
            color: withAlpha(color, 0)
        }
    ], true);
}
function pseudo(x) {
    const s = Math.sin(x * 127.1) * 43758.5453;
    return s - Math.floor(s);
}
const DEER_DEPTH = 0.9;
class WildlifeDirector {
    depth = 1.06;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #rng;
    #deer = null;
    #deerTimer;
    #ripples;
    #rippleTimer;
    #butterflies;
    #bflyTimer = 0;
    #time = 0;
    #mood;
    #water = 0.16;
    #bank = 0.02;
    #wildlife = 0.6;
    constructor(rng){
        this.#rng = rng;
        this.#deerTimer = rng.float(2000, 8000);
        this.#rippleTimer = rng.float(1500, 5000);
        this.#ripples = Array.from({
            length: 6
        }, ()=>({
                xFrac: 0,
                yFrac: 0,
                age: 0,
                active: false
            }));
        this.#butterflies = Array.from({
            length: 3
        }, ()=>({
                t: 0,
                xFrac: 0,
                yFrac: 0,
                speed: 0,
                hue: 0,
                active: false
            }));
    }
    splash(xFrac, yFrac) {
        const slot = this.#ripples.find((r1)=>!r1.active);
        if (!slot) return;
        slot.xFrac = clamp(xFrac, 0, 1);
        slot.yFrac = clamp(yFrac, 0, 1);
        slot.age = 0;
        slot.active = true;
    }
    update(ctx) {
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
        const cfg = ctx.env.config;
        this.#water = cfg.waterLevel;
        this.#bank = cfg.bankHeight;
        this.#wildlife = cfg.wildlife;
        const dt = ctx.dt;
        this.#updateDeer(dt);
        this.#updateRipples(dt);
        this.#updateButterflies(dt);
    }
    #updateDeer(dt) {
        if (this.#deer) {
            this.#deer.age += dt;
            this.#deer.grazePhase += dt * 0.001;
            return;
        }
        if (this.#wildlife <= 0) return;
        this.#deerTimer -= dt * (0.3 + this.#wildlife);
        if (this.#deerTimer > 0) return;
        this.#deerTimer = this.#rng.float(9000, 24000);
        this.#deer = {
            localX: 0,
            age: 0,
            stag: this.#rng.bool(0.5),
            grazePhase: this.#rng.float(0, 6.283)
        };
        this.#deerSpawnX = null;
    }
    #deerSpawnX = null;
    #updateRipples(dt) {
        for (const r1 of this.#ripples){
            if (r1.active) {
                r1.age += dt * 0.0009;
                if (r1.age >= 1) r1.active = false;
            }
        }
        if (this.#water <= 0.001 || this.#wildlife <= 0) return;
        this.#rippleTimer -= dt * (0.3 + this.#wildlife);
        if (this.#rippleTimer > 0) return;
        this.#rippleTimer = this.#rng.float(2500, 7000);
        const slot = this.#ripples.find((r1)=>!r1.active);
        if (slot) {
            slot.xFrac = this.#rng.float(0.05, 0.95);
            slot.yFrac = this.#rng.float(0.1, 0.7);
            slot.age = 0;
            slot.active = true;
        }
    }
    #updateButterflies(dt) {
        const want = this.#mood.snow < 0.4 && this.#wildlife > 0 ? Math.round(this.#wildlife * 2) : 0;
        let live = 0;
        for (const b of this.#butterflies){
            if (!b.active) continue;
            b.t += dt * b.speed;
            if (b.t > 1) b.active = false;
            else live++;
        }
        if (live >= want) return;
        this.#bflyTimer -= dt;
        if (this.#bflyTimer > 0) return;
        this.#bflyTimer = this.#rng.float(1500, 5000);
        const slot = this.#butterflies.find((b)=>!b.active);
        if (slot) {
            slot.active = true;
            slot.t = 0;
            slot.xFrac = this.#rng.float(0.1, 0.9);
            slot.yFrac = this.#rng.float(0.55, 0.78);
            slot.speed = this.#rng.float(0.00006, 0.00012);
            slot.hue = this.#rng.float(0, 360);
        }
    }
    draw(ctx) {
        const { out, width, height } = ctx;
        const mood = this.#mood;
        const waterY = (1 - this.#water) * height;
        const bankTopY = waterY - this.#bank * height;
        if (this.#deer) {
            const cam = ctx.camera;
            if (this.#deerSpawnX === null) {
                const enterRight = cam.speed >= 0;
                this.#deerSpawnX = enterRight ? cam.viewRight(DEER_DEPTH) + 0.05 : cam.viewLeft(DEER_DEPTH) - 0.05;
                this.#deer.localX = this.#deerSpawnX;
            }
            const sx = cam.project(this.#deer.localX, 0.9);
            const size = height * 0.05 * (0.8 + cam.zoom * 0.2);
            if (sx < -size * 4 || sx > width + size * 4) {
                this.#deer = null;
            } else {
                const fade = clamp(this.#deer.age * 0.001, 0, 1);
                const col = withAlpha(darken(mood.landNear, 0.15), 0.85 * fade);
                drawDeer(out, sx, bankTopY, size, this.#deer, col);
            }
        }
        if (this.#water > 0.001) {
            const waterH = height - waterY;
            const ring = mix(mood.snowColor, mood.water, 0.4);
            for (const r1 of this.#ripples){
                if (!r1.active) continue;
                const x = r1.xFrac * width;
                const y = waterY + r1.yFrac * waterH;
                const rad = r1.age * Math.min(width, height) * 0.05;
                const a = (1 - r1.age) * 0.4;
                out.line(x - rad, y, x + rad, y, 1, withAlpha(ring, a));
                out.line(x - rad * 0.6, y + rad * 0.18, x + rad * 0.6, y + rad * 0.18, 1, withAlpha(ring, a * 0.6));
            }
        }
        for (const b of this.#butterflies){
            if (!b.active) continue;
            const x = (b.xFrac + Math.sin(b.t * 18) * 0.04) * width;
            const y = (b.yFrac + Math.sin(b.t * 30) * 0.03) * height;
            const fade = Math.sin(Math.min(1, b.t) * Math.PI);
            drawButterfly(out, x, y, height * 0.012, this.#time, b.hue, fade, mood);
        }
    }
}
function drawDeer(out, x, groundY, size, deer, col) {
    const bodyW = size * 1.5;
    const bodyH = size * 0.7;
    const bodyY = groundY - size * 1.05;
    out.rect(x - bodyW / 2, bodyY, bodyW, bodyH, col);
    out.circle(x - bodyW / 2, bodyY + bodyH / 2, bodyH / 2, col);
    out.circle(x + bodyW / 2, bodyY + bodyH / 2, bodyH / 2, col);
    const legW = Math.max(1, size * 0.12);
    for (const lx of [
        -0.42,
        -0.2,
        0.2,
        0.42
    ]){
        out.rect(x + bodyW * lx, bodyY + bodyH * 0.6, legW, size * 1.05 - bodyH * 0.6, col);
    }
    const graze = (Math.sin(deer.grazePhase) * 0.5 + 0.5) * size * 0.5;
    const neckTopX = x + bodyW * 0.5;
    const headX = neckTopX + size * 0.5;
    const headY = bodyY - size * 0.4 + graze;
    out.line(neckTopX, bodyY + bodyH * 0.2, headX, headY, Math.max(1, size * 0.18), col);
    out.circle(headX, headY, size * 0.22, col);
    if (deer.stag) {
        out.line(headX, headY - size * 0.1, headX - size * 0.18, headY - size * 0.5, Math.max(1, size * 0.08), col);
        out.line(headX, headY - size * 0.1, headX + size * 0.18, headY - size * 0.5, Math.max(1, size * 0.08), col);
        out.line(headX - size * 0.1, headY - size * 0.3, headX - size * 0.3, headY - size * 0.42, Math.max(1, size * 0.06), col);
    }
}
function drawButterfly(out, x, y, size, time, hue, fade, mood) {
    const open = (Math.sin(time * 0.02) * 0.5 + 0.5) * size + size * 0.3;
    const wing = withAlpha(mix(hsl(hue, 0.7, 0.62), mood.bloom, 0.3), 0.85 * fade);
    out.circle(x - open * 0.5, y, size * 0.7, wing);
    out.circle(x + open * 0.5, y, size * 0.7, wing);
    out.line(x, y - size * 0.5, x, y + size * 0.5, Math.max(1, size * 0.3), withAlpha(darken(wing, 0.5), fade));
}
class Rain {
    depth = 1.15;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #drops;
    #dimples;
    #rain = 0;
    #wind = 0;
    #water = 0.16;
    #time = 0;
    #mood;
    constructor(rng, count = 200){
        this.#drops = Array.from({
            length: count
        }, ()=>({
                xFrac: rng.float(0, 1),
                yFrac: rng.float(0, 1),
                len: rng.float(0.02, 0.05),
                speed: rng.float(0.0014, 0.0024)
            }));
        this.#dimples = Array.from({
            length: 16
        }, ()=>rng.float(0, 1));
    }
    update(ctx) {
        this.#rain = ctx.env.config.rain;
        this.#wind = ctx.env.config.wind;
        this.#water = ctx.env.config.waterLevel;
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
    }
    draw(ctx) {
        if (this.#rain <= 0.001) return;
        const { out, width, height } = ctx;
        const shown = Math.floor(this.#drops.length * this.#rain);
        const tilt = this.#wind * 0.35 + 0.05;
        const streak = withAlpha(this.#mood.snowColor, 0.18 + this.#rain * 0.18);
        const waterY = (1 - this.#water) * height;
        for(let i = 0; i < shown; i++){
            const d = this.#drops[i];
            const y = wrap(d.yFrac + this.#time * d.speed, 1) * height;
            const x = d.xFrac * width + y / height * tilt * width * 0.1;
            const len = d.len * height;
            out.line(x, y, x - tilt * len, y - len, 1, streak);
        }
        const dimple = withAlpha(this.#mood.snowColor, 0.22 * this.#rain);
        for(let i = 0; i < this.#dimples.length; i++){
            const t = (this.#time * 0.003 + i * 0.37) % 1;
            const y = waterY + t * (height - waterY) * 0.5;
            const x = this.#dimples[i] * width;
            const r1 = 1 + t * 4;
            out.line(x - r1, y, x + r1, y, 1, withAlpha(dimple, (1 - t) * 0.3 * this.#rain));
        }
    }
}
class Snow {
    depth = 1.16;
    bounds = {
        x: -Infinity,
        width: Infinity
    };
    alive = true;
    #flakes;
    #snow = 0;
    #wind = 0;
    #time = 0;
    #mood;
    constructor(rng, count = 180){
        this.#flakes = Array.from({
            length: count
        }, ()=>({
                xFrac: rng.float(0, 1),
                yFrac: rng.float(0, 1),
                r: rng.float(0.8, 2.4),
                speed: rng.float(0.00018, 0.0004),
                swayAmp: rng.float(0.01, 0.04),
                swayPhase: rng.float(0, 6.283)
            }));
    }
    update(ctx) {
        this.#snow = ctx.env.config.snowfall;
        this.#wind = ctx.env.config.wind;
        this.#time = ctx.time;
        this.#mood = ctx.env.mood;
    }
    draw(ctx) {
        if (this.#snow <= 0.001) return;
        const { out, width, height } = ctx;
        const shown = Math.floor(this.#flakes.length * this.#snow);
        const flake = withAlpha(this.#mood.snowColor, 0.85);
        const drift = this.#wind * 0.06;
        for(let i = 0; i < shown; i++){
            const f = this.#flakes[i];
            const y = wrap(f.yFrac + this.#time * f.speed, 1);
            const sway = Math.sin(this.#time * 0.001 + f.swayPhase) * f.swayAmp + drift * y;
            const x = wrap(f.xFrac + sway, 1) * width;
            out.circle(x, y * height, f.r, withAlpha(flake, 0.6 + f.r * 0.15));
        }
    }
}
const WINDOW = rgb(255, 198, 120);
const SMOKE = rgb(214, 218, 224);
class Feature {
    depth;
    bounds = {
        x: 0,
        width: 0
    };
    alive = true;
    #spec;
    #localX = 0;
    #baseline = 0.8;
    #shoreOffset = 0;
    #width = 0;
    #heightFrac = 0;
    #rng;
    #time = 0;
    #phase = 0;
    #wind = 0;
    #c = {
        foliage: rgb(0, 0, 0),
        foliageDeep: rgb(0, 0, 0),
        trunk: rgb(0, 0, 0),
        land: rgb(0, 0, 0),
        rock: rgb(0, 0, 0),
        cabinWall: rgb(0, 0, 0),
        cabinRoof: rgb(0, 0, 0),
        bloom: rgb(0, 0, 0),
        snow: 0,
        snowColor: rgb(255, 255, 255),
        windowAlpha: 0
    };
    constructor(depth, rng){
        this.depth = depth;
        this.#rng = rng;
    }
    get kind() {
        return this.#spec.kind;
    }
    reset(spec, localX, shoreOffset, scale) {
        this.#spec = spec;
        this.#localX = localX;
        this.#shoreOffset = shoreOffset;
        this.#width = spec.width * scale;
        this.#heightFrac = clamp(spec.height * scale, 0.01, 0.7);
        this.bounds.x = localX;
        this.bounds.width = this.#width;
        this.alive = true;
        this.#phase = this.#rng.next();
    }
    update(ctx) {
        this.#time = ctx.time;
        const cfg = ctx.env.config;
        const mood = ctx.env.mood;
        this.#baseline = clamp(1 - cfg.waterLevel - cfg.bankHeight - this.#shoreOffset, 0.1, 1);
        this.#wind = cfg.wind;
        const c = this.#c;
        c.foliage = foliageColor(mood, this.depth, true);
        c.foliageDeep = foliageColor(mood, this.depth, false);
        c.trunk = mix(mood.trunk, mood.haze, (1 - this.depth) * 0.45);
        c.land = landColor(mood, this.depth);
        c.rock = mix(mix(rgb(150, 146, 146), mood.landNear, 0.25), mood.haze, (1 - this.depth) * 0.5);
        c.cabinWall = mix(mix(rgb(150, 98, 62), mood.haze, 0.15), mood.haze, (1 - this.depth) * 0.4);
        c.cabinRoof = mix(mix(rgb(74, 66, 70), mood.landNear, 0.3), mood.haze, (1 - this.depth) * 0.4);
        c.bloom = mix(mood.bloom, mood.haze, (1 - this.depth) * 0.4);
        c.snow = mood.snow;
        c.snowColor = mix(mood.snowColor, mood.haze, (1 - this.depth) * 0.4);
        c.windowAlpha = clamp(0.95 - mood.daylight, 0.12, 0.75);
    }
    draw(ctx) {
        const sx = ctx.camera.project(this.#localX, this.depth);
        const sw = this.#width * ctx.camera.unit;
        if (sx + sw < -8 || sx > ctx.width + 8) return;
        const groundY = ctx.height * this.#baseline;
        const h = this.#heightFrac * ctx.camera.unit;
        const out = ctx.out;
        const spec = this.#spec;
        const sway = Math.sin(this.#time * 0.0012 + this.#phase * 6.283) * this.#wind * h * 0.05;
        switch(spec.kind){
            case "broadleaf":
                return drawBroadleaf(out, sx, groundY, sw, h, spec, this.#c, sway);
            case "pine":
                return drawPine(out, sx, groundY, sw, h, spec, this.#c, sway);
            case "shrub":
                return drawShrub(out, sx, groundY, sw, h, spec, this.#c, sway);
            case "cabin":
                return drawCabin(out, sx, groundY, sw, h, spec, this.#c, this.#time, this.#phase);
            case "rock":
                return drawRock(out, sx, groundY, sw, h, spec, this.#c);
            case "hill":
                return drawHill(out, sx, groundY, sw, h, this.#c);
            case "reeds":
                return drawReeds(out, sx, groundY, sw, h, this.#c, sway, this.#phase);
        }
    }
}
function drawBroadleaf(out, x, groundY, w, h, spec, c, sway) {
    const cx = x + w / 2;
    const trunkW = Math.max(1, w * 0.16);
    const trunkH = h * 0.42;
    const topX = cx + spec.lean * w * 0.3 + sway;
    out.polygon([
        cx - trunkW / 2,
        groundY,
        cx + trunkW / 2,
        groundY,
        topX + trunkW * 0.4,
        groundY - trunkH,
        topX - trunkW * 0.4,
        groundY - trunkH
    ], c.trunk);
    const r1 = w * (0.42 + spec.roundness * 0.12);
    const cyTop = groundY - h + r1 * 0.85;
    const cxx = topX;
    out.circle(cxx - w * 0.18, cyTop + h * 0.14, r1 * 0.82, c.foliageDeep);
    out.circle(cxx + w * 0.26, cyTop + h * 0.12, r1 * 0.74, c.foliageDeep);
    out.circle(cxx, cyTop, r1, c.foliage);
    out.circle(cxx - w * 0.28, cyTop + h * 0.06, r1 * 0.66, c.foliage);
    out.circle(cxx + w * 0.28, cyTop + h * 0.06, r1 * 0.66, c.foliage);
    if (spec.variant < 0.7) {
        const dots = 3 + Math.floor(spec.variant * 6);
        for(let i = 0; i < dots; i++){
            const a = spec.variant * 31.4 + i * 2.39;
            const dx = Math.cos(a) * r1 * 0.7;
            const dy = Math.sin(a) * r1 * 0.55;
            out.circle(cxx + dx, cyTop + dy, Math.max(0.8, w * 0.05), withAlpha(c.bloom, 0.7));
        }
    }
    if (c.snow > 0.02) {
        out.circle(cxx, cyTop - r1 * 0.36, r1 * 0.7, withAlpha(c.snowColor, c.snow * 0.55));
    }
}
function drawPine(out, x, groundY, w, h, spec, c, sway) {
    const cx = x + w / 2;
    const trunkW = Math.max(1, w * 0.14);
    const trunkH = h * 0.16;
    out.rect(cx - trunkW / 2, groundY - trunkH, trunkW, trunkH, c.trunk);
    const tiers = Math.max(2, spec.tiers);
    const top = groundY - h;
    const span = h - trunkH;
    const tierH = span / tiers * 1.35;
    for(let i = 0; i < tiers; i++){
        const f = i / (tiers - 1);
        const yb = groundY - trunkH - span * i / tiers;
        const halfW = w / 2 * (1 - f * 0.62);
        const sx = cx + sway * (0.3 + f);
        const lit = i % 2 === 0 ? c.foliage : c.foliageDeep;
        out.polygon([
            sx - halfW,
            yb,
            sx + halfW,
            yb,
            sx + sway * 0.2,
            yb - tierH
        ], lit);
        if (c.snow > 0.02) {
            out.polygon([
                sx - halfW * 0.5,
                yb - tierH * 0.42,
                sx + halfW * 0.5,
                yb - tierH * 0.42,
                sx,
                yb - tierH
            ], withAlpha(c.snowColor, c.snow * 0.7));
        }
    }
    out.circle(cx, top, Math.max(0.8, w * 0.06), withAlpha(c.snow > 0.3 ? c.snowColor : c.foliage, 0.8));
}
function drawShrub(out, x, groundY, w, h, spec, c, sway) {
    const cx = x + w / 2 + sway * 0.5;
    const r1 = h * 0.7;
    out.circle(cx - w * 0.22, groundY - r1 * 0.7, r1 * 0.85, c.foliageDeep);
    out.circle(cx + w * 0.22, groundY - r1 * 0.7, r1 * 0.85, c.foliageDeep);
    out.circle(cx, groundY - r1, r1, c.foliage);
    if (spec.variant < 0.5) {
        out.circle(cx + w * 0.1, groundY - r1, Math.max(0.8, w * 0.05), withAlpha(c.bloom, 0.8));
    }
    if (c.snow > 0.02) {
        out.circle(cx, groundY - r1 * 1.3, r1 * 0.7, withAlpha(c.snowColor, c.snow * 0.5));
    }
}
function drawCabin(out, x, groundY, w, h, spec, c, time, phase) {
    const bodyH = h * 0.62;
    const bodyY = groundY - bodyH;
    out.rect(x, bodyY, w, bodyH, c.cabinWall);
    const eave = w * 0.1;
    const ridge = groundY - h;
    out.polygon([
        x - eave,
        bodyY,
        x + w + eave,
        bodyY,
        x + w / 2,
        ridge
    ], c.cabinRoof);
    if (c.snow > 0.02) {
        out.polygon([
            x - eave,
            bodyY,
            x + w + eave,
            bodyY,
            x + w / 2,
            ridge
        ], withAlpha(c.snowColor, c.snow * 0.6));
    }
    const winW = w * 0.24;
    const winH = bodyH * 0.42;
    const winX = x + (spec.variant < 0.5 ? w * 0.18 : w * 0.58);
    const winY = bodyY + bodyH * 0.3;
    out.glow(winX + winW / 2, winY + winH / 2, winW * 1.8, withAlpha(WINDOW, c.windowAlpha * 0.7), 0.8);
    out.rect(winX, winY, winW, winH, withAlpha(WINDOW, 0.55 + c.windowAlpha * 0.45));
    if (spec.hasChimney) {
        const chW = w * 0.12;
        const chX = x + w * 0.7;
        const chTop = ridge + h * 0.16;
        out.rect(chX, chTop, chW, groundY - chTop - bodyH * 0.55, c.cabinRoof);
        drawSmoke1(out, chX + chW / 2, chTop, w, time, phase);
    }
}
function drawSmoke1(out, x, y, w, time, phase) {
    for(let k = 0; k < 3; k++){
        const t = ((time * 0.00007 + phase + k * 0.34) % 1 + 1) % 1;
        const py = y - t * w * 1.1;
        const px = x + Math.sin((t + phase) * 6.283) * w * 0.18;
        const r1 = w * (0.1 + t * 0.18);
        out.circle(px, py, r1, withAlpha(SMOKE, (1 - t) * 0.22));
    }
}
function drawRock(out, x, groundY, w, h, spec, c) {
    const cx = x + w / 2;
    const top = groundY - h;
    out.polygon([
        x,
        groundY,
        x + w * 0.12,
        groundY - h * 0.55,
        cx - w * 0.1,
        top,
        cx + w * (0.1 + spec.roundness * 0.1),
        top + h * 0.08,
        x + w * 0.9,
        groundY - h * 0.5,
        x + w,
        groundY
    ], c.rock);
    out.polygon([
        cx - w * 0.1,
        top,
        cx + w * 0.18,
        top + h * 0.1,
        cx,
        top + h * 0.3
    ], lighten(c.rock, 0.12));
    if (c.snow > 0.02) {
        out.polygon([
            cx - w * 0.12,
            top,
            cx + w * 0.2,
            top + h * 0.1,
            cx,
            top + h * 0.34
        ], withAlpha(c.snowColor, c.snow * 0.7));
    }
}
function drawHill(out, x, groundY, w, h, c) {
    const cx = x + w / 2;
    const top = groundY - h;
    const r1 = (w * w / 4 + h * h) / (2 * h);
    const cyc = top + r1;
    const pts = [];
    for(let i = 0; i <= 16; i++){
        const px = x + w * i / 16;
        const dx = px - cx;
        pts.push(px, cyc - Math.sqrt(Math.max(0, r1 * r1 - dx * dx)));
    }
    pts.push(x + w, groundY, x, groundY);
    out.polygon(pts, mix(c.land, c.foliageDeep, 0.45));
    if (c.snow > 0.02) {
        const snowPts = [];
        for(let i = 0; i <= 16; i++){
            const px = x + w * i / 16;
            const dx = px - cx;
            const y = cyc - Math.sqrt(Math.max(0, r1 * r1 - dx * dx));
            snowPts.push(px, y);
        }
        const capY = top + h * 0.5;
        snowPts.push(x + w * 0.78, capY, x + w * 0.22, capY);
        out.polygon(snowPts, withAlpha(c.snowColor, c.snow * 0.6));
    }
}
function drawReeds(out, x, groundY, w, h, c, sway, phase) {
    const col = mix(c.foliageDeep, c.foliage, 0.4);
    for(let i = 0; i < 4; i++){
        const bx = x + w * (i + 0.5) / 4;
        const bend = sway * 1.6 + Math.sin(phase * 6 + i) * w * 0.1;
        out.line(bx, groundY, bx + bend, groundY - h, Math.max(1, w * 0.12), col);
    }
}
const FEATURE_GENERATORS = {
    broadleaf (rng) {
        const height = rng.float(0.07, 0.16);
        const width = height * rng.float(0.72, 1.08);
        return base("broadleaf", width, height, rng, {
            lean: rng.float(-0.18, 0.18),
            roundness: rng.float(0.4, 1)
        });
    },
    pine (rng) {
        const height = rng.float(0.09, 0.2);
        const width = height * rng.float(0.42, 0.64);
        return base("pine", width, height, rng, {
            tiers: rng.int(3, 5),
            lean: rng.float(-0.08, 0.08)
        });
    },
    shrub (rng) {
        const height = rng.float(0.025, 0.05);
        const width = height * rng.float(1.4, 2.3);
        return base("shrub", width, height, rng, {
            roundness: rng.float(0.5, 1)
        });
    },
    cabin (rng) {
        const height = rng.float(0.05, 0.085);
        const width = height * rng.float(1.4, 2.1);
        return base("cabin", width, height, rng, {
            hasChimney: rng.bool(0.8)
        });
    },
    rock (rng) {
        const height = rng.float(0.02, 0.05);
        const width = height * rng.float(1.2, 2.1);
        return base("rock", width, height, rng, {
            roundness: rng.float(0.3, 0.8)
        });
    },
    hill (rng) {
        const height = rng.float(0.05, 0.14);
        const width = height * rng.float(2.6, 5.2);
        return base("hill", width, height, rng, {});
    },
    reeds (rng) {
        const height = rng.float(0.02, 0.045);
        const width = height * rng.float(0.5, 0.9);
        return base("reeds", width, height, rng, {});
    }
};
function base(kind, width, height, rng, over) {
    return {
        kind,
        width,
        height,
        tiers: 4,
        lean: 0,
        roundness: 0.7,
        hasChimney: false,
        variant: rng.next(),
        ...over
    };
}
function generateFeature(kind, rng) {
    return FEATURE_GENERATORS[kind](rng);
}
const RULES1 = {
    meadow: {
        kinds: [
            "shrub",
            "broadleaf",
            "cabin",
            null
        ],
        kindWeights: [
            4,
            2,
            1,
            5
        ],
        gap: [
            0.02,
            0.08
        ],
        run: [
            4,
            8
        ],
        next: [
            "meadow",
            "grove",
            "clearing"
        ],
        nextWeights: [
            3,
            3,
            2
        ]
    },
    grove: {
        kinds: [
            "broadleaf",
            "pine",
            "shrub"
        ],
        kindWeights: [
            5,
            2,
            2
        ],
        gap: [
            0.0,
            0.03
        ],
        run: [
            3,
            6
        ],
        next: [
            "grove",
            "forest",
            "meadow",
            "clearing"
        ],
        nextWeights: [
            2,
            3,
            3,
            1
        ]
    },
    forest: {
        kinds: [
            "broadleaf",
            "pine",
            "shrub"
        ],
        kindWeights: [
            4,
            4,
            1
        ],
        gap: [
            -0.005,
            0.018
        ],
        run: [
            4,
            9
        ],
        next: [
            "forest",
            "grove",
            "clearing"
        ],
        nextWeights: [
            3,
            3,
            2
        ]
    },
    clearing: {
        kinds: [
            null,
            "shrub",
            "rock"
        ],
        kindWeights: [
            5,
            1,
            1
        ],
        gap: [
            0.07,
            0.16
        ],
        run: [
            1,
            3
        ],
        next: [
            "meadow",
            "grove",
            "forest"
        ],
        nextWeights: [
            3,
            3,
            2
        ]
    },
    lakeside: {
        kinds: [
            "reeds",
            "broadleaf",
            "cabin",
            "shrub",
            null
        ],
        kindWeights: [
            4,
            2,
            1,
            1,
            3
        ],
        gap: [
            0.02,
            0.07
        ],
        run: [
            3,
            7
        ],
        next: [
            "lakeside",
            "meadow",
            "grove"
        ],
        nextWeights: [
            3,
            3,
            2
        ]
    },
    foothills: {
        kinds: [
            "rock",
            "pine",
            "hill",
            "shrub"
        ],
        kindWeights: [
            3,
            3,
            2,
            1
        ],
        gap: [
            0.02,
            0.07
        ],
        run: [
            3,
            7
        ],
        next: [
            "foothills",
            "forest",
            "alpine",
            "clearing"
        ],
        nextWeights: [
            3,
            2,
            2,
            2
        ]
    },
    alpine: {
        kinds: [
            "pine",
            "rock",
            "hill",
            null
        ],
        kindWeights: [
            2,
            3,
            2,
            3
        ],
        gap: [
            0.04,
            0.12
        ],
        run: [
            3,
            6
        ],
        next: [
            "alpine",
            "foothills",
            "clearing"
        ],
        nextWeights: [
            3,
            3,
            2
        ]
    }
};
const BIOME_SUCCESSORS1 = {
    meadow: [
        [
            "lakeside",
            3
        ]
    ],
    clearing: [
        [
            "foothills",
            3
        ],
        [
            "lakeside",
            2
        ]
    ],
    forest: [
        [
            "foothills",
            3
        ]
    ],
    foothills: [
        [
            "alpine",
            3
        ]
    ]
};
const WILDNESS = {
    meadow: 0.2,
    lakeside: 0.15,
    grove: 0.45,
    forest: 0.62,
    clearing: 0.12,
    foothills: 0.82,
    alpine: 0.96
};
function biasWeight1(weight, level, wildness, variety) {
    const diff = Math.abs(level - wildness);
    const factor = Math.max(0.02, 1 + variety * 3 * (1 - 2 * diff));
    return weight * factor;
}
class ZoneStream {
    #rng;
    #zone;
    #remaining;
    constructor(rng, start = "meadow"){
        this.#rng = rng;
        this.#zone = start;
        this.#remaining = this.#rollRun(start);
    }
    get zone() {
        return this.#zone;
    }
    #rollRun(z) {
        const [lo, hi] = RULES1[z].run;
        return this.#rng.int(lo, hi);
    }
    next(wildness = 0.5, variety = 0) {
        if (this.#remaining <= 0) {
            this.#zone = this.#chooseNext(wildness, variety);
            this.#remaining = this.#rollRun(this.#zone);
        }
        this.#remaining--;
        const rule = RULES1[this.#zone];
        const kind = this.#rng.weighted(rule.kinds, rule.kindWeights);
        return {
            kind,
            gap: this.#rollGap(rule),
            zone: this.#zone
        };
    }
    #chooseNext(wildness, variety) {
        const rule = RULES1[this.#zone];
        if (variety <= 0) return this.#rng.weighted(rule.next, rule.nextWeights);
        const extra = BIOME_SUCCESSORS1[this.#zone];
        const cands = extra ? [
            ...rule.next,
            ...extra.map((e)=>e[0])
        ] : rule.next;
        const baseW = extra ? [
            ...rule.nextWeights,
            ...extra.map((e)=>e[1])
        ] : rule.nextWeights;
        const weights = cands.map((z, i)=>biasWeight1(baseW[i], WILDNESS[z], wildness, variety));
        return this.#rng.weighted(cands, weights);
    }
    #rollGap(rule) {
        const r1 = this.#rng.next();
        if (r1 < 0.16) return this.#rng.float(-0.006, 0.004);
        if (r1 > 0.84) return this.#rng.float(rule.gap[1], rule.gap[1] + 0.12);
        return this.#rng.float(rule.gap[0], rule.gap[1]);
    }
}
const SUBSTITUTE1 = {
    hill: "broadleaf",
    cabin: "broadleaf",
    reeds: "shrub",
    broadleaf: "broadleaf",
    pine: "pine",
    shrub: "shrub",
    rock: "rock"
};
class LayerSpawner1 {
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
        this.#streamR = new ZoneStream(rng.fork("right"));
        this.#streamL = new ZoneStream(rng.fork("left"));
    }
    #allow(kind) {
        let k = kind;
        for(let i = 0; i < 6 && this.#exclude.has(k); i++){
            const next = SUBSTITUTE1[k];
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
        this.#biomeShift = camera.scroll * (1 - camera.parallaxAt(this.depth));
        this.#biomeScale = env.config.biomeScale;
        this.#biomeVariety = env.config.biomeVariety;
        let guard = 0;
        while(camera.project(this.#right, this.depth) < width + 340 && guard++ < 400){
            this.#placeRight();
        }
        guard = 0;
        while(camera.project(this.#left, this.depth) > -340 && guard++ < 400){
            this.#placeLeft();
        }
        this.#recycle(camera, width);
    }
    get pooled() {
        return this.#pool.length;
    }
    #obtain() {
        return this.#pool.pop() ?? new Feature(this.depth, this.#rng.fork(this.layer.entities.length + 1));
    }
    #nextSlot(stream, edge) {
        if (this.#biomeField && this.#biomeVariety > 0) {
            const wildness = this.#biomeField.wildnessAt(edge + this.#biomeShift, this.#biomeScale);
            return stream.next(wildness, this.#biomeVariety);
        }
        return stream.next();
    }
    #placeRight() {
        const slot = this.#nextSlot(this.#streamR, this.#right);
        const gap = slot.gap * this.#scale;
        if (slot.kind === null) {
            this.#right += gap;
            return;
        }
        const spec = generateFeature(this.#allow(slot.kind), this.#rng);
        const leftEdge = this.#right + gap;
        const f = this.#obtain();
        f.reset(spec, leftEdge, this.#shoreOffset, this.#scale);
        this.layer.add(f);
        this.#right = leftEdge + f.bounds.width;
    }
    #placeLeft() {
        const slot = this.#nextSlot(this.#streamL, this.#left);
        const gap = slot.gap * this.#scale;
        if (slot.kind === null) {
            this.#left -= gap;
            return;
        }
        const spec = generateFeature(this.#allow(slot.kind), this.#rng);
        const f = this.#obtain();
        const width = spec.width * this.#scale;
        const leftEdge = this.#left - gap - width;
        f.reset(spec, leftEdge, this.#shoreOffset, this.#scale);
        this.layer.add(f);
        this.#left = leftEdge;
    }
    #recycle(camera, width) {
        const list = this.layer.entities;
        let w = 0;
        let removed = false;
        for(let i = 0; i < list.length; i++){
            const f = list[i];
            const l = camera.project(f.bounds.x, this.depth);
            const r1 = camera.project(f.bounds.x + f.bounds.width, this.depth);
            if (r1 < -680 || l > width + 680) {
                if (f instanceof Feature) this.#pool.push(f);
                removed = true;
            } else {
                list[w++] = f;
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
        for (const f of list){
            if (f.bounds.x < lo) lo = f.bounds.x;
            const right = f.bounds.x + f.bounds.width;
            if (right > hi) hi = right;
        }
        this.#left = lo;
        this.#right = hi;
    }
}
class BiomeField1 {
    #noise;
    constructor(seed){
        this.#noise = createNoise1D((seed ^ 0xb10e) >>> 0, 2);
    }
    wildnessAt(worldX, scale) {
        const s = scale > 0 ? scale : 1;
        const n = this.#noise.at(worldX / s);
        return clamp(0.5 + (n - 0.5) * 1.4, 0, 1);
    }
}
function buildLandscape(world, config, rng) {
    const sky = new Layer("sky", 0);
    sky.add(new SkyBackdrop1());
    sky.add(new Rainbow());
    sky.add(new Sun());
    sky.add(new MountainRange(rng.fork("mountains")));
    sky.add(new CloudField1(rng.fork("clouds")));
    sky.add(new SunRays());
    sky.add(new FlyerDirector1(rng.fork("flyer")));
    world.addLayer(sky);
    const n = Math.max(1, Math.round(config.parallaxLayers));
    const spawners = [];
    const biomeField = new BiomeField1(rng.fork("biome").seed);
    for(let i = 0; i < n; i++){
        const f = n === 1 ? 1 : i / (n - 1);
        const depth = lerp(0.6, 0.92, f);
        const scale = lerp(0.74, 1.05, f);
        const shoreOffset = (1 - f) * 0.06;
        const layer = new Layer(`land-${i}`, depth);
        world.addLayer(layer);
        const exclude = [];
        if (f > 0.45) exclude.push("hill");
        if (f < 0.25) exclude.push("cabin", "reeds");
        spawners.push(new LayerSpawner1(layer, rng.fork(`layer-${i}`), {
            depth,
            shoreOffset,
            scale,
            excludeKinds: exclude.length > 0 ? exclude : undefined,
            biomeField
        }));
    }
    const birds = new Layer("birds", 0.94);
    birds.add(new BirdDirector1(rng.fork("birds")));
    world.addLayer(birds);
    const water = new Layer("water", 1);
    water.add(new Lake(rng.fork("lake")));
    world.addLayer(water);
    const bank = new Layer("bank", 1.1);
    bank.add(new Meadow(rng.fork("meadow")));
    world.addLayer(bank);
    const life = new Layer("wildlife", 1.15);
    life.add(new WildlifeDirector(rng.fork("wildlife")));
    world.addLayer(life);
    const weather = new Layer("weather", 1.3);
    weather.add(new Rain(rng.fork("rain")));
    weather.add(new Snow(rng.fork("snow")));
    world.addLayer(weather);
    return {
        spawners
    };
}
class Naturescape {
    config;
    events = new AmbientEventBus1();
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
        this.#mood = new MoodEngine1(this.config, this.#seed);
        this.#director = new AmbientDirector1(rng.fork("ambient"), this.events);
        this.#world = new World(new Camera({
            speed: signedSpeed1(this.config),
            minParallax: 0.18
        }));
        this.#env = {
            config: this.config,
            mood: this.#mood.mood,
            bus: this.events
        };
        const landscape = buildLandscape(this.#world, this.config, rng.fork("landscape"));
        this.#spawners = landscape.spawners;
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
        cam.speed = signedSpeed1(this.config);
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
        const next = normalizeConfig2({
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
    poke(screenX, screenY) {
        const cam = this.#world.camera;
        if (cam.width <= 0 || cam.height <= 0) return;
        const waterY = (1 - this.config.waterLevel) * cam.height;
        if (this.config.waterLevel <= 0.001 || screenY < waterY) return;
        const xFrac = screenX / cam.width;
        const yFrac = (screenY - waterY) / (cam.height - waterY);
        for (const layer of this.#world.layers){
            for (const e of layer.entities){
                if (e instanceof WildlifeDirector) {
                    e.splash(xFrac, yFrac);
                    return;
                }
            }
        }
    }
}
function signedSpeed1(config) {
    return config.cameraSpeed * (config.cameraDirection === "left" ? -1 : 1);
}
function createNaturescape(config = {}) {
    return new Naturescape(normalizeConfig2({
        ...DEFAULT_CONFIG1,
        ...config
    }));
}
class NatureAudio {
    #bus;
    #unsub;
    #ctx = null;
    #master = null;
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
        this.#startPad();
        this.#applyGain();
    }
    #startPad() {
        const ctx = this.#ctx;
        const pad = ctx.createGain();
        pad.gain.value = 0.1;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 900;
        lp.Q.value = 0.6;
        pad.connect(lp).connect(this.#master);
        for (const f of [
            196,
            261.6,
            329.6
        ]){
            const osc = ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.value = f;
            osc.detune.value = (Math.random() - 0.5) * 6;
            const g = ctx.createGain();
            g.gain.value = 0.4;
            osc.connect(g).connect(pad);
            osc.start();
        }
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.06;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 220;
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
    #birdsong(ctx, out, intensity) {
        const now = ctx.currentTime;
        const notes = 2 + Math.floor(Math.random() * 2);
        for(let i = 0; i < notes; i++){
            const t = now + i * 0.11;
            const o = ctx.createOscillator();
            o.type = "sine";
            const f0 = 1800 + Math.random() * 1400;
            o.frequency.setValueAtTime(f0, t);
            o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.4), t + 0.05);
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
    #breeze(ctx, out, intensity) {
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
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peak, now + 1.2);
        g.gain.linearRampToValueAtTime(0, now + 3.6);
        bp.frequency.setValueAtTime(560, now);
        bp.frequency.linearRampToValueAtTime(980, now + 3.6);
        src.start(now);
        src.stop(now + 3.6 + 0.1);
    }
    #water(ctx, out, intensity) {
        const now = ctx.currentTime;
        const drops = 4 + Math.floor(Math.random() * 4);
        for(let i = 0; i < drops; i++){
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
    #rustle(ctx, out, intensity) {
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
const rafScheduler1 = (cb)=>{
    const id = requestAnimationFrame(cb);
    return ()=>cancelAnimationFrame(id);
};
function mountNaturescape(opts = {}) {
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
    const scene = createNaturescape(initial);
    const canvasRenderer = new CanvasRenderer(canvas);
    canvasRenderer.setPost({
        vignette: scene.config.vignette
    });
    let renderer = canvasRenderer;
    const audio = new NatureAudio(scene.events);
    audio.setVolume(scene.config.audioVolume);
    if (scene.config.audioEnabled) audio.setEnabled(true);
    const stats = document.createElement("div");
    stats.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:9;display:none;" + "font:11px/1.5 ui-monospace,Menlo,monospace;white-space:pre;padding:8px 10px;" + "border-radius:8px;pointer-events:none;color:#16331f;" + "background:rgba(244,250,240,0.7);border:1px solid rgba(60,110,70,0.25);";
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
        scheduler: rafScheduler1,
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
        stats.textContent = `${Math.round(fps)} fps   ${vw}×${vh}\n${entities} entities · ${commandCount} draws` + `\nseed ${scene.config.seed} · ${scene.config.palette} · ${scene.config.season}`;
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
function createScapeExample(host, spec) {
    const stage = document.createElement("div");
    stage.className = "stage";
    stage.dataset.world = spec.world;
    host.append(stage);
    const handle = spec.mount(stage);
    const canvasRenderer = handle.renderer;
    const toast = document.createElement("div");
    toast.className = "scape-toast";
    stage.append(toast);
    let toastTimer = 0;
    const flash = (msg)=>{
        toast.textContent = msg;
        toast.classList.add("scape-toast-show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(()=>toast.classList.remove("scape-toast-show"), 1400);
    };
    let immersive = false;
    let menuOpen = false;
    let panelOpen = false;
    const applyVisibility = ()=>{
        menuBtn.style.display = immersive ? "none" : "";
        menu.style.display = !immersive && menuOpen ? "" : "none";
        panel.el.style.display = !immersive && panelOpen ? "" : "none";
    };
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
        schema: spec.schema,
        title: spec.title,
        onChange: (patch)=>handle.update(patch),
        onClose: ()=>setPanelOpen(false)
    });
    stage.append(panel.el);
    const unsubConfig = handle.onConfigChange((cfg)=>panel.set(cfg));
    const pre = document.createElement("pre");
    pre.className = "scape-ascii";
    stage.append(pre);
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
    const setMode = (next)=>{
        mode = next;
        const asciiOn = next === "ascii";
        pre.style.display = asciiOn ? "block" : "none";
        handle.canvas.style.opacity = asciiOn ? "0" : "1";
        handle.setRenderer(next === "ascii" ? asciiAdapter : next === "pixel" ? pixel : canvasRenderer);
        asciiBtn.textContent = asciiOn ? "Canvas view" : "ASCII view";
        pixelBtn.textContent = next === "pixel" ? "Canvas view" : "Pixel view";
    };
    const toggleMode = (m)=>setMode(mode === m ? "canvas" : m);
    const adjustPixelScale = (delta)=>{
        if (mode !== "pixel") return;
        pixelScale = Math.max(1, Math.min(12, pixelScale + delta));
        pixel.setOptions({
            pixelScale
        });
        flash(`Pixel size ${pixelScale}`);
    };
    const menuBtn = document.createElement("button");
    menuBtn.className = "scape-menu-btn";
    menuBtn.textContent = "☰";
    menuBtn.title = "Menu";
    menuBtn.setAttribute("aria-label", "Menu");
    menuBtn.addEventListener("click", (e)=>{
        e.stopPropagation();
        setMenuOpen(!menuOpen);
    });
    const menu = document.createElement("div");
    menu.className = "scape-menu";
    const menuItem = (label, onPick)=>{
        const b = document.createElement("button");
        b.className = "scape-menu-item";
        b.textContent = label;
        b.addEventListener("click", ()=>{
            setMenuOpen(false);
            onPick();
        });
        return b;
    };
    const asciiBtn = menuItem("ASCII view", ()=>toggleMode("ascii"));
    const pixelBtn = menuItem("Pixel view", ()=>toggleMode("pixel"));
    const fsBtn = menuItem("Fullscreen", ()=>setImmersive(true));
    const worldBtn = menuItem(spec.other.label, ()=>location.hash = spec.other.route);
    worldBtn.title = spec.other.title;
    const homeBtn = menuItem("🏠 Worlds", ()=>location.hash = "#/");
    homeBtn.title = "Back to the chooser";
    const settingsBtn = menuItem("⚙ Settings", ()=>setPanelOpen(true));
    const hint = document.createElement("div");
    hint.className = "scape-menu-hint";
    hint.textContent = spec.hint;
    menu.append(asciiBtn, pixelBtn, fsBtn, worldBtn, homeBtn, settingsBtn, hint);
    stage.append(menuBtn, menu);
    const setImmersive = (on)=>{
        if (on === immersive) return;
        immersive = on;
        if (on) menuOpen = false;
        applyVisibility();
        if (on) stage.requestFullscreen?.().catch(()=>{});
        else if (document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
    };
    const cleanups = [];
    const on = (target, type, fn)=>{
        target.addEventListener(type, fn);
        cleanups.push(()=>target.removeEventListener(type, fn));
    };
    on(document, "fullscreenchange", ()=>{
        if (!document.fullscreenElement && immersive) setImmersive(false);
    });
    on(document, "click", (e)=>{
        if (menuOpen && !menu.contains(e.target)) setMenuOpen(false);
    });
    on(globalThis, "keydown", (e)=>{
        const ke = e;
        if (ke.target instanceof HTMLInputElement || ke.target instanceof HTMLSelectElement) return;
        if (ke.key === "Escape") {
            if (menuOpen) setMenuOpen(false);
        } else if (ke.key === "a") toggleMode("ascii");
        else if (ke.key === "p") toggleMode("pixel");
        else if (ke.key === "[") adjustPixelScale(-1);
        else if (ke.key === "]") adjustPixelScale(1);
        else if (ke.key === "m") setMenuOpen(!menuOpen);
        else if (ke.key === "h") setPanelOpen(!panelOpen);
        else if (ke.key === "f") setImmersive(!immersive);
    });
    applyVisibility();
    return {
        destroy () {
            clearTimeout(toastTimer);
            handle.setRenderer(canvasRenderer);
            for (const c of cleanups)c();
            unsubConfig();
            if (document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
            panel.destroy();
            handle.destroy();
            pixel.dispose?.();
            stage.remove();
        }
    };
}
function createCityExample(host) {
    return createScapeExample(host, {
        world: "city",
        mount: (container)=>mountCityscape({
                container,
                readHash: false,
                writeHash: false,
                randomizeSeed: true
            }),
        title: "Cityscape",
        other: {
            route: "#/nature",
            label: "🏞 Nature",
            title: "Switch to the nature valley"
        },
        hint: "move = parallax · wheel = speed · click = flash · keys: a / p / [ ] / m / h / f"
    });
}
function createNatureExample(host) {
    return createScapeExample(host, {
        world: "nature",
        mount: (container)=>mountNaturescape({
                container,
                readHash: false,
                writeHash: false,
                randomizeSeed: true
            }),
        schema: CONFIG_SCHEMA1,
        title: "Nature",
        other: {
            route: "#/city",
            label: "🌃 City",
            title: "Switch to the night city"
        },
        hint: "move = parallax · wheel = speed · click = ripple · keys: a / p / [ ] / m / h / f"
    });
}
class IntentState {
    #map;
    #held = new Set();
    #pressed = new Set();
    #released = new Set();
    constructor(map = {}){
        this.#map = map;
    }
    setMap(map) {
        this.#map = map;
    }
    keyDown(code) {
        const action = this.#map[code];
        if (!action || this.#held.has(action)) return;
        this.#held.add(action);
        this.#pressed.add(action);
    }
    keyUp(code) {
        const action = this.#map[code];
        if (!action || !this.#held.has(action)) return;
        this.#held.delete(action);
        this.#released.add(action);
    }
    held(action) {
        return this.#held.has(action);
    }
    pressed(action) {
        return this.#pressed.has(action);
    }
    released(action) {
        return this.#released.has(action);
    }
    consumePressed() {
        return [
            ...this.#pressed
        ];
    }
    tick() {
        this.#pressed.clear();
        this.#released.clear();
    }
    reset() {
        this.#held.clear();
        this.#pressed.clear();
        this.#released.clear();
    }
}
const PALETTES2 = {
    slate: {
        label: "Slate",
        background: rgb(18, 22, 30),
        cellEmpty: rgb(34, 40, 52),
        outline: rgb(70, 82, 104),
        tray: rgb(26, 31, 41),
        text: rgb(208, 218, 235),
        placed: rgb(255, 255, 255),
        select: rgb(255, 236, 150),
        celebrate: rgb(140, 230, 190),
        hueBase: 205,
        sat: 0.5,
        light: 0.6
    },
    candy: {
        label: "Candy",
        background: rgb(28, 22, 36),
        cellEmpty: rgb(48, 38, 60),
        outline: rgb(120, 96, 150),
        tray: rgb(38, 30, 50),
        text: rgb(240, 230, 248),
        placed: rgb(255, 255, 255),
        select: rgb(255, 240, 170),
        celebrate: rgb(255, 180, 220),
        hueBase: 330,
        sat: 0.62,
        light: 0.64
    },
    mono: {
        label: "Mono",
        background: rgb(20, 20, 22),
        cellEmpty: rgb(38, 38, 42),
        outline: rgb(96, 96, 104),
        tray: rgb(28, 28, 32),
        text: rgb(224, 224, 228),
        placed: rgb(255, 255, 255),
        select: rgb(255, 255, 255),
        celebrate: rgb(220, 220, 225),
        hueBase: 0,
        sat: 0,
        light: 0.62
    },
    ocean: {
        label: "Ocean",
        background: rgb(10, 22, 34),
        cellEmpty: rgb(20, 38, 54),
        outline: rgb(46, 78, 102),
        tray: rgb(14, 30, 44),
        text: rgb(200, 226, 240),
        placed: rgb(222, 246, 255),
        select: rgb(120, 230, 235),
        celebrate: rgb(120, 220, 200),
        hueBase: 190,
        sat: 0.55,
        light: 0.58
    },
    sunset: {
        label: "Sunset",
        background: rgb(28, 18, 30),
        cellEmpty: rgb(48, 30, 44),
        outline: rgb(110, 70, 92),
        tray: rgb(38, 24, 36),
        text: rgb(248, 224, 224),
        placed: rgb(255, 245, 235),
        select: rgb(255, 210, 120),
        celebrate: rgb(255, 160, 120),
        hueBase: 20,
        sat: 0.62,
        light: 0.62
    },
    forest: {
        label: "Forest",
        background: rgb(14, 24, 18),
        cellEmpty: rgb(26, 40, 30),
        outline: rgb(56, 84, 62),
        tray: rgb(18, 30, 22),
        text: rgb(214, 232, 214),
        placed: rgb(240, 250, 235),
        select: rgb(220, 230, 130),
        celebrate: rgb(160, 220, 140),
        hueBase: 110,
        sat: 0.45,
        light: 0.55
    },
    neon: {
        label: "Neon",
        background: rgb(8, 8, 14),
        cellEmpty: rgb(20, 18, 32),
        outline: rgb(60, 50, 96),
        tray: rgb(14, 12, 22),
        text: rgb(228, 224, 248),
        placed: rgb(255, 255, 255),
        select: rgb(120, 255, 235),
        celebrate: rgb(255, 120, 235),
        hueBase: 280,
        sat: 0.85,
        light: 0.62
    }
};
const PALETTE_NAMES2 = Object.keys(PALETTES2);
function getPalette2(name) {
    return PALETTES2[name] ?? PALETTES2.slate;
}
function pieceColor(palette, index) {
    const hue = (palette.hueBase + index * 137.508) % 360;
    return hsl(hue, palette.sat, palette.light);
}
const CONFIG_SCHEMA2 = [
    {
        key: "seed",
        label: "Seed",
        group: "Game",
        type: "seed",
        default: "shapes",
        help: "Same seed + settings reproduces the exact sequence of levels."
    },
    {
        key: "palette",
        label: "Palette",
        group: "Game",
        type: "select",
        default: "slate",
        options: PALETTE_NAMES2.map((n)=>({
                value: n,
                label: PALETTES2[n].label
            }))
    },
    {
        key: "vignette",
        label: "Vignette",
        group: "Look",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.35,
        help: "Darken the frame toward the corners (+ faint grain). 0 = off."
    },
    {
        key: "bgShade",
        label: "Backdrop shade",
        group: "Look",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.3,
        help: "Vertical lift→shadow gradient over the background, for depth. 0 = flat."
    },
    {
        key: "cornerRadius",
        label: "Corner round",
        group: "Look",
        type: "range",
        min: 0,
        max: 0.5,
        step: 0.02,
        default: 0.18,
        help: "Round the cells, tiles and tray (fraction of a cell). 0 = sharp squares."
    },
    {
        key: "borderWidth",
        label: "Border weight",
        group: "Look",
        type: "range",
        min: 0.02,
        max: 0.2,
        step: 0.01,
        default: 0.07,
        help: "Grid-line and tile-border thickness (fraction of a cell)."
    },
    {
        key: "borderAlpha",
        label: "Border opacity",
        group: "Look",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0,
        help: "Opacity of a resting piece's border. 0 = invisible; the active (selected/dragged) " + "piece always shows its highlight."
    },
    {
        key: "gloss",
        label: "Tile gloss",
        group: "Look",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        help: "Strength of the top-light sheen on each tile. 0 = flat matte."
    },
    {
        key: "pieceGlow",
        label: "Piece glow",
        group: "Look",
        type: "range",
        min: 0,
        max: 0.8,
        step: 0.05,
        default: 0,
        help: "A soft coloured halo behind each piece (neon look). 0 = off."
    },
    {
        key: "panelRadius",
        label: "Popup round",
        group: "Popup",
        type: "range",
        min: 0,
        max: 40,
        step: 1,
        default: 18,
        help: "Corner radius of the start/solved cards, in pixels."
    },
    {
        key: "panelShadow",
        label: "Popup shadow",
        group: "Popup",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.7,
        help: "Drop-shadow strength under the cards. 0 = flat."
    },
    {
        key: "panelBlur",
        label: "Popup blur",
        group: "Popup",
        type: "range",
        min: 0,
        max: 24,
        step: 1,
        default: 4,
        help: "Backdrop blur of the dimmed area behind a card, in pixels."
    },
    {
        key: "panelOpacity",
        label: "Dim strength",
        group: "Popup",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.6,
        help: "How strongly the board is dimmed behind a card."
    },
    {
        key: "startPieces",
        label: "Start pieces",
        group: "Difficulty",
        type: "range",
        min: 2,
        max: 6,
        step: 1,
        default: 2,
        help: "How many pieces level 1 is cut into."
    },
    {
        key: "maxPieces",
        label: "Max pieces",
        group: "Difficulty",
        type: "range",
        min: 3,
        max: 12,
        step: 1,
        default: 7,
        help: "Piece count at the top of the difficulty ramp."
    },
    {
        key: "startSize",
        label: "Start size",
        group: "Difficulty",
        type: "range",
        min: 2,
        max: 6,
        step: 1,
        default: 3,
        help: "Figure side (cells) at level 1."
    },
    {
        key: "maxSize",
        label: "Max size",
        group: "Difficulty",
        type: "range",
        min: 4,
        max: 10,
        step: 1,
        default: 7,
        help: "Figure side (cells) at the top of the ramp."
    },
    {
        key: "rampLevels",
        label: "Ramp length",
        group: "Difficulty",
        type: "range",
        min: 4,
        max: 30,
        step: 1,
        default: 12,
        help: "Levels taken to climb from start to max difficulty."
    },
    {
        key: "allowFlips",
        label: "Allow flips",
        group: "Difficulty",
        type: "toggle",
        default: true,
        help: "Let later levels scramble pieces with a mirror, not just rotations."
    },
    {
        key: "minPieceCells",
        label: "Min piece size",
        group: "Difficulty",
        type: "range",
        min: 1,
        max: 4,
        step: 1,
        default: 2,
        help: "Smallest allowed piece, in cells."
    },
    {
        key: "hintPenalty",
        label: "Hint penalty",
        group: "Scoring",
        type: "range",
        min: 0,
        max: 8,
        step: 1,
        default: 3,
        help: "Moves added each time you use a hint."
    },
    {
        key: "parSlack",
        label: "2-star slack",
        group: "Scoring",
        type: "range",
        min: 1,
        max: 3,
        step: 0.1,
        default: 1.5,
        help: "Solve within par × this for two stars (par itself earns three)."
    }
];
function buildDefaults3(schema = CONFIG_SCHEMA2) {
    return buildDefaults(schema);
}
const DEFAULT_CONFIG2 = buildDefaults3();
function normalizeConfig3(input) {
    return normalizeConfig(CONFIG_SCHEMA2, input);
}
function flipOf(o) {
    return o >= 4 ? 1 : 0;
}
function rotOf(o) {
    return o & 3;
}
function orientation(flip, rot) {
    return (flip ? 4 : 0) + (rot % 4 + 4) % 4;
}
function rotateCellCW(cell) {
    return {
        r: cell.c,
        c: -cell.r
    };
}
function mirrorCell(cell) {
    return {
        r: cell.r,
        c: -cell.c
    };
}
function applyOrientation(cells, o) {
    const f = flipOf(o);
    const rot = rotOf(o);
    return cells.map((cell)=>{
        let x = f ? mirrorCell(cell) : {
            r: cell.r,
            c: cell.c
        };
        for(let i = 0; i < rot; i++)x = rotateCellCW(x);
        return x;
    });
}
function normalizeCells(cells) {
    let minR = Infinity;
    let minC = Infinity;
    for (const c of cells){
        if (c.r < minR) minR = c.r;
        if (c.c < minC) minC = c.c;
    }
    const out = cells.map((c)=>({
            r: c.r - minR,
            c: c.c - minC
        }));
    out.sort((a, b)=>a.r - b.r || a.c - b.c);
    return out;
}
function shapeKey(cells) {
    return normalizeCells(cells).map((c)=>`${c.r},${c.c}`).join(";");
}
function cellBounds(cells) {
    let minR = Infinity;
    let minC = Infinity;
    let maxR = -Infinity;
    let maxC = -Infinity;
    for (const c of cells){
        if (c.r < minR) minR = c.r;
        if (c.c < minC) minC = c.c;
        if (c.r > maxR) maxR = c.r;
        if (c.c > maxC) maxC = c.c;
    }
    return {
        rows: maxR - minR + 1,
        cols: maxC - minC + 1
    };
}
function rotateCW(o) {
    return orientation(flipOf(o), rotOf(o) + 1);
}
function rotateCCW(o) {
    return orientation(flipOf(o), rotOf(o) - 1);
}
function flip(o) {
    return orientation(1 - flipOf(o), (4 - rotOf(o)) % 4);
}
function cellKey(cell) {
    return `${cell.r},${cell.c}`;
}
function figureCells(fig) {
    const out = [];
    for(let r1 = 0; r1 < fig.h; r1++){
        for(let c = 0; c < fig.w; c++)out.push({
            r: r1,
            c
        });
    }
    return out;
}
function dissect(fig, pieceCount, rng, opts = {}) {
    const minCells = Math.max(1, opts.minCells ?? 2);
    const all = figureCells(fig);
    const total = all.length;
    if (total === 0) return [];
    const valid = new Set(all.map(cellKey));
    const wanted = Math.max(1, Math.min(pieceCount, Math.floor(total / minCells) || 1));
    if (wanted === 1) return [
        {
            cells: all
        }
    ];
    const order = shuffle(all, rng);
    const region = new Map();
    const regions = [];
    for(let i = 0; i < wanted; i++){
        const seed = order[i];
        region.set(cellKey(seed), i);
        regions.push([
            seed
        ]);
    }
    const claimed = new Set(regions.map((r1)=>cellKey(r1[0])));
    let remaining = total - wanted;
    while(remaining > 0){
        const grown = growStep(regions, claimed, region, rng, valid);
        if (!grown) break;
        remaining--;
    }
    const merged = mergeUndersized(regions, region, minCells);
    return merged.map((cells)=>({
            cells
        }));
}
function growStep(regions, claimed, region, rng, valid) {
    let bestIdx = -1;
    let bestSize = Infinity;
    const frontierCache = regions.map(()=>null);
    for(let i = 0; i < regions.length; i++){
        const fr = frontierOf(regions[i], claimed, valid);
        frontierCache[i] = fr;
        if (fr.length > 0 && regions[i].length < bestSize) {
            bestSize = regions[i].length;
            bestIdx = i;
        }
    }
    if (bestIdx < 0) return false;
    let idx = bestIdx;
    if (rng.bool(0.3)) {
        const eligible = [];
        for(let i = 0; i < regions.length; i++){
            if (frontierCache[i] && frontierCache[i].length > 0) eligible.push(i);
        }
        idx = rng.pick(eligible);
    }
    const frontier = frontierCache[idx];
    const cell = rng.pick(frontier);
    claimed.add(cellKey(cell));
    region.set(cellKey(cell), idx);
    regions[idx].push(cell);
    return true;
}
function frontierOf(cells, claimed, valid) {
    const seen = new Set();
    const out = [];
    for (const { r: r1, c } of cells){
        for (const n of [
            {
                r: r1 - 1,
                c
            },
            {
                r: r1 + 1,
                c
            },
            {
                r: r1,
                c: c - 1
            },
            {
                r: r1,
                c: c + 1
            }
        ]){
            const k = cellKey(n);
            if (valid.has(k) && !claimed.has(k) && !seen.has(k)) {
                seen.add(k);
                out.push(n);
            }
        }
    }
    return out;
}
function mergeUndersized(regions, region, minCells) {
    const alive = regions.map((cells)=>cells.slice());
    const dead = new Set();
    for(let i = 0; i < alive.length; i++){
        if (dead.has(i) || alive[i].length >= minCells) continue;
        const target = smallestAdjacentRegion(alive[i], region, dead, i);
        if (target < 0) continue;
        for (const cell of alive[i])region.set(cellKey(cell), target);
        alive[target].push(...alive[i]);
        alive[i] = [];
        dead.add(i);
    }
    return alive.filter((cells)=>cells.length > 0);
}
function smallestAdjacentRegion(cells, region, dead, self) {
    let best = -1;
    let bestSize = Infinity;
    const seen = new Set();
    for (const { r: r1, c } of cells){
        for (const n of [
            {
                r: r1 - 1,
                c
            },
            {
                r: r1 + 1,
                c
            },
            {
                r: r1,
                c: c - 1
            },
            {
                r: r1,
                c: c + 1
            }
        ]){
            const ri = region.get(cellKey(n));
            if (ri === undefined || ri === self || dead.has(ri) || seen.has(ri)) continue;
            seen.add(ri);
        }
    }
    for (const ri of seen){
        const size = countRegion(region, ri);
        if (size < bestSize) {
            bestSize = size;
            best = ri;
        }
    }
    return best;
}
function countRegion(region, idx) {
    let n = 0;
    for (const v of region.values())if (v === idx) n++;
    return n;
}
function shuffle(arr, rng) {
    const out = arr.slice();
    for(let i = out.length - 1; i > 0; i--){
        const j = rng.int(0, i);
        [out[i], out[j]] = [
            out[j],
            out[i]
        ];
    }
    return out;
}
function solvingOrientations(base) {
    const key = shapeKey(base);
    const set = new Set();
    for(let o = 0; o < 8; o++){
        if (shapeKey(applyOrientation(base, o)) === key) set.add(o);
    }
    return set;
}
function minOpsForAll(solving) {
    const out = new Array(8).fill(0);
    for(let start = 0; start < 8; start++){
        if (solving.has(start)) {
            out[start] = 0;
            continue;
        }
        const dist = new Array(8).fill(-1);
        dist[start] = 0;
        const queue = [
            start
        ];
        let found = 0;
        while(queue.length){
            const o = queue.shift();
            if (solving.has(o)) {
                found = dist[o];
                break;
            }
            for (const n of [
                rotateCW(o),
                flip(o)
            ]){
                if (dist[n] === -1) {
                    dist[n] = dist[o] + 1;
                    queue.push(n);
                }
            }
        }
        out[start] = found;
    }
    return out;
}
function makePieceShape(id, colorIndex, home) {
    const base = normalizeCells(home);
    const { rows, cols } = cellBounds(base);
    let anchorR = Infinity;
    let anchorC = Infinity;
    for (const cell of home){
        if (cell.r < anchorR) anchorR = cell.r;
        if (cell.c < anchorC) anchorC = cell.c;
    }
    const solving = solvingOrientations(base);
    return {
        id,
        colorIndex,
        home,
        base,
        baseKey: shapeKey(base),
        anchorR,
        anchorC,
        rows,
        cols,
        solving,
        minOps: minOpsForAll(solving)
    };
}
function orientedCells(shape, o) {
    return normalizeCells(applyOrientation(shape.base, o));
}
function scramble(pieces, rng, opts = {}) {
    const max = opts.allowFlips ? 8 : 4;
    return pieces.map((p)=>{
        const candidates = [];
        for(let o = 0; o < max; o++){
            if (!p.solving.has(o)) candidates.push(o);
        }
        return candidates.length === 0 ? 0 : rng.pick(candidates);
    });
}
function difficultyParams(level, config) {
    const t = clamp((level - 1) / Math.max(1, config.rampLevels - 1), 0, 1);
    const size = lerp(config.startSize, config.maxSize, t);
    const h = Math.max(2, Math.round(size));
    const w = Math.max(2, Math.round(size + t * 2));
    const cap = Math.max(1, Math.floor(w * h / Math.max(1, config.minPieceCells)));
    const pieceCount = clamp(Math.round(lerp(config.startPieces, config.maxPieces, t)), 1, cap);
    const allowFlips = config.allowFlips && level >= 4;
    return {
        figure: {
            w,
            h
        },
        pieceCount,
        allowFlips
    };
}
function buildLevel(config, level) {
    const rng = createRng(config.seed).fork(`level-${level}`);
    const { figure, pieceCount, allowFlips } = difficultyParams(level, config);
    const defs = dissect(figure, pieceCount, rng.fork("cut"), {
        minCells: config.minPieceCells
    });
    const pieces = defs.map((d, i)=>makePieceShape(i, i, d.cells));
    const starts = scramble(pieces, rng.fork("scramble"), {
        allowFlips
    });
    let par = 0;
    for(let i = 0; i < pieces.length; i++)par += pieces[i].minOps[starts[i]] + 1;
    return {
        level,
        figure,
        pieces,
        starts,
        par
    };
}
function computeLayout(viewport, figure, pieceBounds) {
    const vw = Math.max(1, viewport.w);
    const vh = Math.max(1, viewport.h);
    const pad = Math.round(Math.min(vw, vh) * 0.04);
    const gap = pad;
    const portrait = vh >= vw * 0.85;
    let figureRect;
    let trayRect;
    if (portrait) {
        const usableH = vh - 2 * pad - gap;
        const figH = usableH * 0.7;
        figureRect = {
            x: pad,
            y: pad,
            w: vw - 2 * pad,
            h: figH
        };
        trayRect = {
            x: pad,
            y: pad + figH + gap,
            w: vw - 2 * pad,
            h: usableH - figH
        };
    } else {
        const usableW = vw - 2 * pad - gap;
        const figW = usableW * 0.7;
        figureRect = {
            x: pad,
            y: pad,
            w: figW,
            h: vh - 2 * pad
        };
        trayRect = {
            x: pad + figW + gap,
            y: pad,
            w: usableW - figW,
            h: vh - 2 * pad
        };
    }
    const count = Math.max(1, pieceBounds.length);
    const cols = clampInt(Math.round(Math.sqrt(count * trayRect.w / Math.max(1, trayRect.h))), 1, count);
    const rows = Math.ceil(count / cols);
    const slotW = trayRect.w / cols;
    const slotH = trayRect.h / rows;
    let maxCols = 1;
    let maxRows = 1;
    for (const b of pieceBounds){
        if (b.cols > maxCols) maxCols = b.cols;
        if (b.rows > maxRows) maxRows = b.rows;
    }
    const cell = Math.max(2, Math.min(figureRect.w / figure.w, figureRect.h / figure.h) * 0.98);
    const trayCellRaw = Math.min(slotW * 0.9 / maxCols, slotH * 0.9 / maxRows);
    const trayCell = Math.max(2, Math.min(trayCellRaw, cell));
    const originX = figureRect.x + (figureRect.w - figure.w * cell) / 2;
    const originY = figureRect.y + (figureRect.h - figure.h * cell) / 2;
    const slots = [];
    for(let i = 0; i < pieceBounds.length; i++){
        const gr = Math.floor(i / cols);
        const gc = i % cols;
        const gx = trayRect.x + gc * slotW;
        const gy = trayRect.y + gr * slotH;
        slots.push({
            x: gx + (slotW - pieceBounds[i].cols * trayCell) / 2,
            y: gy + (slotH - pieceBounds[i].rows * trayCell) / 2
        });
    }
    return {
        cell,
        trayCell,
        figW: figure.w,
        figH: figure.h,
        originX,
        originY,
        figureRect,
        trayRect,
        slots
    };
}
function cellToScreen(layout, r1, c) {
    return {
        x: layout.originX + c * layout.cell,
        y: layout.originY + r1 * layout.cell
    };
}
function clampInt(v, min, max) {
    return Math.max(min, Math.min(max, Math.round(v)));
}
function computeStars(moves, par, slack) {
    if (moves <= par) return 3;
    if (moves <= par * slack) return 2;
    return 1;
}
function scoreLevel(moves, par, timeMs, config) {
    return {
        moves,
        par,
        timeMs,
        stars: computeStars(moves, par, config.parSlack)
    };
}
class GameState {
    config;
    level;
    pieces;
    #vw = 1;
    #vh = 1;
    #layout;
    #stableBounds;
    selectedId = null;
    draggingId = null;
    #pendingId = null;
    #downX = 0;
    #downY = 0;
    #dragOffX = 0;
    #dragOffY = 0;
    moves = 0;
    elapsedMs = 0;
    hintsUsed = 0;
    placements = 0;
    phase = "playing";
    #placedOrder = [];
    #occupied = new Set();
    constructor(config, level, viewport){
        this.config = config;
        this.level = level;
        this.#stableBounds = level.pieces.map((p)=>{
            const m = Math.max(p.rows, p.cols);
            return {
                rows: m,
                cols: m
            };
        });
        this.pieces = level.pieces.map((shape, i)=>({
                shape,
                orientation: level.starts[i],
                x: 0,
                y: 0,
                tx: 0,
                ty: 0,
                state: "tray",
                slotX: 0,
                slotY: 0
            }));
        this.#layout = computeLayout(viewport, level.figure, this.#stableBounds);
        this.resize(viewport.w, viewport.h);
    }
    get figure() {
        return this.level.figure;
    }
    get layout() {
        return this.#layout;
    }
    get solved() {
        return this.#placedOrder.length === this.pieces.length;
    }
    resize(w, h) {
        this.#vw = Math.max(1, w);
        this.#vh = Math.max(1, h);
        this.#layout = computeLayout({
            w: this.#vw,
            h: this.#vh
        }, this.level.figure, this.#stableBounds);
        for(let i = 0; i < this.pieces.length; i++){
            const p = this.pieces[i];
            p.slotX = this.#layout.slots[i].x;
            p.slotY = this.#layout.slots[i].y;
            if (p.state === "placed") {
                const s = cellToScreen(this.#layout, p.placedR ?? p.shape.anchorR, p.placedC ?? p.shape.anchorC);
                p.x = p.tx = s.x;
                p.y = p.ty = s.y;
            } else {
                const rest = this.#trayRest(p);
                p.x = p.tx = rest.x;
                p.y = p.ty = rest.y;
            }
        }
    }
    tick(dt) {
        if (dt <= 0) return;
        if (this.phase === "playing") this.elapsedMs += dt;
        const k = 1 - Math.exp(-dt / 20);
        for (const p of this.pieces){
            if (p.state === "dragging") continue;
            p.x += (p.tx - p.x) * k;
            p.y += (p.ty - p.y) * k;
        }
    }
    pickAt(x, y) {
        for(let i = this.pieces.length - 1; i >= 0; i--){
            const p = this.pieces[i];
            if (p.state === "placed") continue;
            if (this.#hit(p, x, y)) return p.shape.id;
        }
        return null;
    }
    pieceAt(x, y) {
        for(let i = this.pieces.length - 1; i >= 0; i--){
            if (this.#hit(this.pieces[i], x, y)) return this.pieces[i].shape.id;
        }
        return null;
    }
    pointerDown(x, y) {
        const id = this.pickAt(x, y);
        if (id == null) {
            this.selectedId = null;
            this.#pendingId = null;
            return false;
        }
        this.selectedId = id;
        this.#pendingId = id;
        this.#downX = x;
        this.#downY = y;
        return true;
    }
    #beginDrag(id) {
        const p = this.pieces[id];
        const tc = this.#layout.trayCell;
        const bc = this.#layout.cell;
        if (tc > 0 && tc !== bc) {
            const { rows, cols } = cellBounds(orientedCells(p.shape, p.orientation));
            const fx = cols > 0 ? (this.#downX - p.x) / (cols * tc) : 0.5;
            const fy = rows > 0 ? (this.#downY - p.y) / (rows * tc) : 0.5;
            p.x = this.#downX - fx * cols * bc;
            p.y = this.#downY - fy * rows * bc;
        }
        this.#pendingId = null;
        this.draggingId = id;
        p.state = "dragging";
        this.#dragOffX = this.#downX - p.x;
        this.#dragOffY = this.#downY - p.y;
    }
    pointerMove(x, y) {
        let id = this.draggingId;
        if (id == null) {
            if (this.#pendingId == null) return;
            if (this.pieces[this.#pendingId].state === "placed") {
                this.#pendingId = null;
                return;
            }
            const dx = x - this.#downX;
            const dy = y - this.#downY;
            if (dx * dx + dy * dy < 5 * 5) return;
            id = this.#pendingId;
            this.#beginDrag(id);
        }
        const p = this.pieces[id];
        p.x = p.tx = x - this.#dragOffX;
        p.y = p.ty = y - this.#dragOffY;
    }
    pointerUp() {
        this.#pendingId = null;
        if (this.draggingId == null) return;
        const p = this.pieces[this.draggingId];
        this.draggingId = null;
        if (this.#tryPlace(p)) return;
        p.state = "tray";
        const rest = this.#trayRest(p);
        p.tx = rest.x;
        p.ty = rest.y;
    }
    rotateSelected(id) {
        this.#reorient((o)=>rotateCW(o), id);
    }
    rotateSelectedCCW(id) {
        this.#reorient((o)=>rotateCCW(o), id);
    }
    flipSelected(id) {
        this.#reorient((o)=>flip(o), id);
    }
    selectNext() {
        const order = this.pieces.filter((p)=>p.state !== "placed").map((p)=>p.shape.id);
        if (order.length === 0) {
            this.selectedId = null;
            return;
        }
        const at = this.selectedId == null ? -1 : order.indexOf(this.selectedId);
        this.selectedId = order[(at + 1) % order.length];
    }
    undo() {
        const id = this.#placedOrder[this.#placedOrder.length - 1];
        if (id != null) this.removePlaced(id);
    }
    removePlaced(id) {
        const p = this.pieces[id];
        if (p.state !== "placed") return false;
        if (p.placedCells) {
            for (const k of p.placedCells)this.#occupied.delete(k);
        }
        p.placedCells = undefined;
        p.placedR = undefined;
        p.placedC = undefined;
        p.state = "tray";
        this.selectedId = id;
        const rest = this.#trayRest(p);
        p.tx = rest.x;
        p.ty = rest.y;
        const i = this.#placedOrder.indexOf(id);
        if (i >= 0) this.#placedOrder.splice(i, 1);
        this.moves++;
        this.phase = "playing";
        return true;
    }
    hint() {
        for (const p of this.pieces){
            if (p.state === "placed") continue;
            const keys = p.shape.home.map((c)=>`${c.r},${c.c}`);
            if (keys.some((k)=>this.#occupied.has(k))) continue;
            if (this.draggingId === p.shape.id) this.draggingId = null;
            p.orientation = 0;
            this.#placeAt(p, p.shape.anchorR, p.shape.anchorC, keys);
            this.moves += this.config.hintPenalty;
            this.hintsUsed++;
            return;
        }
    }
    #reorient(fn, id = this.draggingId ?? this.selectedId) {
        if (id == null) return;
        const p = this.pieces[id];
        if (!p || p.state === "placed") return;
        p.orientation = fn(p.orientation);
        this.selectedId = id;
        this.moves++;
        if (p.state === "tray") {
            const rest = this.#trayRest(p);
            p.tx = rest.x;
            p.ty = rest.y;
        }
    }
    #tryPlace(p) {
        const layout = this.#layout;
        const cell = layout.cell;
        const r0 = Math.round((p.y - layout.originY) / cell);
        const c0 = Math.round((p.x - layout.originX) / cell);
        const keys = [];
        for (const o of orientedCells(p.shape, p.orientation)){
            const r1 = r0 + o.r;
            const c = c0 + o.c;
            if (r1 < 0 || c < 0 || r1 >= layout.figH || c >= layout.figW) return false;
            const k = `${r1},${c}`;
            if (this.#occupied.has(k)) return false;
            keys.push(k);
        }
        this.#placeAt(p, r0, c0, keys);
        this.moves++;
        return true;
    }
    #placeAt(p, r0, c0, keys) {
        p.state = "placed";
        p.placedR = r0;
        p.placedC = c0;
        p.placedCells = keys;
        for (const k of keys)this.#occupied.add(k);
        const s = cellToScreen(this.#layout, r0, c0);
        p.tx = p.x = s.x;
        p.ty = p.y = s.y;
        this.placements++;
        if (this.selectedId === p.shape.id) this.selectedId = null;
        this.#placedOrder.push(p.shape.id);
        if (this.solved) this.phase = "solved";
    }
    #trayRest(p) {
        const m = Math.max(p.shape.rows, p.shape.cols);
        const { rows, cols } = cellBounds(orientedCells(p.shape, p.orientation));
        const cell = this.#layout.trayCell;
        return {
            x: p.slotX + (m - cols) * cell / 2,
            y: p.slotY + (m - rows) * cell / 2
        };
    }
    #hit(p, x, y) {
        const cell = p.state === "tray" ? this.#layout.trayCell : this.#layout.cell;
        for (const c of orientedCells(p.shape, p.orientation)){
            const cx = p.x + c.c * cell;
            const cy = p.y + c.r * cell;
            if (x >= cx && x < cx + cell && y >= cy && y < cy + cell) return true;
        }
        return false;
    }
}
function drawGame(out, game, config) {
    const pal = getPalette2(config.palette);
    const layout = game.layout;
    const cell = layout.cell;
    const gap = Math.max(1, cell * config.borderWidth);
    out.rect(0, 0, out.width, out.height, pal.background);
    if (config.bgShade > 0) {
        const k = config.bgShade;
        out.gradient(0, 0, out.width, out.height, [
            {
                at: 0,
                color: rgb(255, 255, 255, 0.05 * k)
            },
            {
                at: 0.5,
                color: rgb(255, 255, 255, 0)
            },
            {
                at: 1,
                color: rgb(0, 0, 0, 0.5 * k)
            }
        ], true);
    }
    const t = layout.trayRect;
    out.rect(t.x, t.y, t.w, t.h, pal.tray, config.cornerRadius * layout.trayCell * 1.2);
    const h = gap / 2;
    const rInt = config.cornerRadius * (cell - gap);
    const rOut = rInt > 0 ? rInt + gap : 0;
    const figHas = (r1, c)=>r1 >= 0 && r1 < layout.figH && c >= 0 && c < layout.figW;
    for(let r1 = 0; r1 < layout.figH; r1++){
        for(let c = 0; c < layout.figW; c++){
            const { x, y } = cellToScreen(layout, r1, c);
            out.rect(x - h, y - h, cell + gap, cell + gap, pal.outline, exteriorRadii(figHas, r1, c, rOut));
        }
    }
    for(let r1 = 0; r1 < layout.figH; r1++){
        for(let c = 0; c < layout.figW; c++){
            const { x, y } = cellToScreen(layout, r1, c);
            out.rect(x + h, y + h, cell - gap, cell - gap, pal.cellEmpty, rInt);
        }
    }
    const top = game.draggingId ?? game.selectedId;
    const drawOne = (p, selected)=>{
        const c = p.state === "tray" ? layout.trayCell : layout.cell;
        drawPiece(out, p, pal, config, c, Math.max(1, c * config.borderWidth), selected);
    };
    for (const p of game.pieces)if (p.state === "placed") drawOne(p, false);
    for (const p of game.pieces){
        if (p.state !== "placed" && p.shape.id !== top) drawOne(p, false);
    }
    if (top != null) drawOne(game.pieces[top], true);
    if (game.solved) {
        const f = layout.figureRect;
        out.glow(layout.originX + layout.figW * cell / 2, layout.originY + layout.figH * cell / 2, Math.max(f.w, f.h) * 0.6, withAlpha(pal.celebrate, 0.5), 1);
    }
}
function drawPiece(out, p, pal, config, cell, gap, selected) {
    const fill = pieceColor(pal, p.shape.colorIndex);
    const body = p.state === "placed" ? lighten(fill, 0.06) : fill;
    const border = selected ? pal.select : withAlpha(darken(fill, 0.35), config.borderAlpha);
    const cells = orientedCells(p.shape, p.orientation);
    const h = gap / 2;
    const s = cell - gap;
    const radius = config.cornerRadius * s;
    const rOut = radius > 0 ? radius + gap : 0;
    const present = new Set(cells.map((c)=>`${c.r},${c.c}`));
    const has = (r1, c)=>present.has(`${r1},${c}`);
    if (config.pieceGlow > 0) {
        let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
        for (const c of cells){
            if (c.r < minR) minR = c.r;
            if (c.r > maxR) maxR = c.r;
            if (c.c < minC) minC = c.c;
            if (c.c > maxC) maxC = c.c;
        }
        const cx = p.x + (minC + maxC + 1) / 2 * cell;
        const cy = p.y + (minR + maxR + 1) / 2 * cell;
        const rad = (Math.max(maxC - minC, maxR - minR) + 1) * cell * 0.7;
        out.glow(cx, cy, rad, withAlpha(selected ? pal.select : fill, 1), config.pieceGlow * (selected ? 1 : 0.7));
    }
    for (const c of cells){
        out.rect(p.x + c.c * cell - h, p.y + c.r * cell - h, cell + gap, cell + gap, border, exteriorRadii(has, c.r, c.c, rOut));
    }
    for (const c of cells){
        const x = p.x + c.c * cell + h;
        const y = p.y + c.r * cell + h;
        out.rect(x, y, s, s, body, radius);
        if (config.gloss > 0) {
            out.rect(x, y, s, s * 0.45, withAlpha(lighten(body, 0.25), 0.55 * config.gloss), radius);
        }
    }
}
function exteriorRadii(has, r1, c, radius) {
    if (radius <= 0) return [
        0,
        0,
        0,
        0
    ];
    const up = has(r1 - 1, c);
    const down = has(r1 + 1, c);
    const left = has(r1, c - 1);
    const right = has(r1, c + 1);
    return [
        !up && !left ? radius : 0,
        !up && !right ? radius : 0,
        !down && !right ? radius : 0,
        !down && !left ? radius : 0
    ];
}
const STRUCTURAL = [
    "seed",
    "startPieces",
    "maxPieces",
    "startSize",
    "maxSize",
    "rampLevels",
    "allowFlips",
    "minPieceCells"
];
class Shapes {
    config;
    #level = 1;
    #game;
    #builder = new DisplayListBuilder(0, 0);
    #vw = 1;
    #vh = 1;
    #time = 0;
    constructor(config){
        this.config = config;
        this.#build();
    }
    get game() {
        return this.#game;
    }
    get levelNumber() {
        return this.#level;
    }
    get time() {
        return this.#time;
    }
    get solved() {
        return this.#game.solved;
    }
    get moves() {
        return this.#game.moves;
    }
    get par() {
        return this.#game.level.par;
    }
    get elapsedMs() {
        return this.#game.elapsedMs;
    }
    #build() {
        const level = buildLevel(this.config, this.#level);
        this.#game = new GameState(this.config, level, {
            w: this.#vw,
            h: this.#vh
        });
    }
    update(dtMs) {
        if (!(dtMs > 0)) return;
        this.#time += dtMs;
        this.#game.tick(dtMs);
    }
    collect(width, height) {
        if (width !== this.#vw || height !== this.#vh) this.resize(width, height);
        const out = this.#builder.reset(width, height);
        drawGame(out, this.#game, this.config);
        return out;
    }
    resize(width, height) {
        this.#vw = Math.max(1, width);
        this.#vh = Math.max(1, height);
        this.#game.resize(this.#vw, this.#vh);
    }
    setConfig(patch) {
        const next = normalizeConfig3({
            ...this.config,
            ...patch
        });
        const structural = STRUCTURAL.some((k)=>next[k] !== this.config[k]);
        this.config = next;
        if (structural) this.#build();
    }
    pointerDown(x, y) {
        return this.#game.pointerDown(x, y);
    }
    pointerMove(x, y) {
        this.#game.pointerMove(x, y);
    }
    pointerUp() {
        this.#game.pointerUp();
    }
    rotate(id) {
        this.#game.rotateSelected(id);
    }
    rotateCCW(id) {
        this.#game.rotateSelectedCCW(id);
    }
    flip(id) {
        this.#game.flipSelected(id);
    }
    undo() {
        this.#game.undo();
    }
    removePlaced(id) {
        return this.#game.removePlaced(id);
    }
    pieceAt(x, y) {
        return this.#game.pieceAt(x, y);
    }
    hint() {
        this.#game.hint();
    }
    selectNext() {
        this.#game.selectNext();
    }
    nextLevel() {
        this.#level++;
        this.#build();
    }
    restart() {
        this.#build();
    }
    score() {
        return scoreLevel(this.#game.moves, this.#game.level.par, this.#game.elapsedMs, this.config);
    }
}
function createShapes(config = {}) {
    return new Shapes(normalizeConfig3({
        ...DEFAULT_CONFIG2,
        ...config
    }));
}
class ShapesAudio {
    #ctx = null;
    #muted;
    constructor(muted = false){
        this.#muted = muted;
    }
    get muted() {
        return this.#muted;
    }
    setMuted(muted) {
        this.#muted = muted;
    }
    resume() {
        try {
            this.#ctx ??= new AudioContext();
            if (this.#ctx.state === "suspended") void this.#ctx.resume();
        } catch  {}
    }
    click() {
        this.#blip(620, 0.05, 0.16, "triangle");
    }
    solved() {
        this.#blip(523.25, 0.16, 0.18, "sine", 0);
        this.#blip(783.99, 0.22, 0.18, "sine", 0.09);
    }
    destroy() {
        try {
            void this.#ctx?.close();
        } catch  {}
        this.#ctx = null;
    }
    #blip(freq, dur, peak, type, delay = 0) {
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
function stroke(body, size = 22) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` + `stroke="currentColor" stroke-width="2" stroke-linecap="round" ` + `stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
const ICONS = {
    rotateCW: stroke('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),
    flip: stroke('<path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/>' + '<path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/>' + '<path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/>'),
    undo: stroke('<path d="M9 14 4 9l5-5"/>' + '<path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>'),
    hint: stroke('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8' + 'c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
    volumeOn: stroke('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' + '<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>'),
    volumeOff: stroke('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' + '<line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'),
    menu: stroke('<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/>' + '<line x1="3" y1="18" x2="21" y2="18"/>', 20),
    refresh: stroke('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>' + '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>', 16),
    settings: stroke('<circle cx="12" cy="12" r="3"/>' + '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0' + "l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2" + "v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83" + "l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09" + "A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0" + "l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09" + "a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83" + "l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09" + 'a1.65 1.65 0 0 0-1.51 1z"/>', 16),
    back: stroke('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>', 16)
};
function starIcon(filled) {
    return `<svg viewBox="0 0 24 24" width="26" height="26" ` + `fill="${filled ? "currentColor" : "none"}" stroke="currentColor" ` + `stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">` + `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 ` + `5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}
const MUTE_KEY = "shapes-muted";
function loadMuted() {
    try {
        return globalThis.localStorage?.getItem(MUTE_KEY) === "1";
    } catch  {
        return false;
    }
}
function saveMuted(muted) {
    try {
        globalThis.localStorage?.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch  {}
}
const KEYMAP = {
    KeyR: "rotate",
    KeyE: "rotateCCW",
    KeyF: "flip",
    KeyZ: "undo",
    Backspace: "undo",
    KeyH: "hint",
    Tab: "selectNext",
    Enter: "next",
    KeyN: "next"
};
const rafScheduler2 = (cb)=>{
    const id = requestAnimationFrame(cb);
    return ()=>cancelAnimationFrame(id);
};
function mountShapes(opts = {}) {
    ensureStyles1();
    const container = opts.container ?? document.body;
    const maxDpr = opts.maxDpr ?? 2;
    const canvas = opts.canvas ?? document.createElement("canvas");
    if (!opts.canvas) {
        canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;";
        container.append(canvas);
    } else {
        canvas.style.touchAction = "none";
    }
    const initial = {
        ...opts.config
    };
    if ((opts.randomizeSeed ?? true) && !initial.seed) {
        initial.seed = Math.random().toString(36).slice(2, 9);
    }
    const scene = createShapes(initial);
    let renderer = new CanvasRenderer(canvas);
    const audio = new ShapesAudio(loadMuted());
    let lastPlacements = 0;
    const phase = observable(opts.title ?? true ? "title" : "playing");
    const intent = new IntentState(KEYMAP);
    const hud = buildHud(container);
    const start = buildStartScreen(container, ()=>{
        audio.resume();
        phase.set("playing");
    });
    const solved = buildSolvedScreen(container, ()=>advance());
    const unsubs = [];
    const muteBtn = iconBtn(ICONS.volumeOn, "Mute");
    muteBtn.classList.add("shp-mute");
    const refreshMute = ()=>{
        muteBtn.innerHTML = audio.muted ? ICONS.volumeOff : ICONS.volumeOn;
        muteBtn.title = audio.muted ? "Unmute" : "Mute";
        muteBtn.setAttribute("aria-label", muteBtn.title);
    };
    muteBtn.onclick = ()=>{
        audio.setMuted(!audio.muted);
        saveMuted(audio.muted);
        refreshMute();
        if (!audio.muted) audio.resume();
    };
    refreshMute();
    container.append(muteBtn);
    let vw = 1;
    let vh = 1;
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
    const advance = ()=>{
        scene.nextLevel();
        phase.set("playing");
    };
    let lastPopupSig = "";
    const applyPopupTheme = ()=>{
        const c = scene.config;
        const sig = `${c.palette}|${c.panelRadius}|${c.panelShadow}|${c.panelBlur}|` + `${c.panelOpacity}`;
        if (sig === lastPopupSig) return;
        lastPopupSig = sig;
        const pal = getPalette2(c.palette);
        const css = (k, v)=>container.style.setProperty(k, v);
        const accentLight = lighten(pal.select, 0.05);
        css("--shp-card-bg", toCss(withAlpha(lighten(pal.tray, 0.05), 0.97)));
        css("--shp-card-fg", toCss(pal.text));
        css("--shp-card-border", toCss(withAlpha(lighten(pal.outline, 0.12), 0.55)));
        css("--shp-card-radius", `${c.panelRadius}px`);
        css("--shp-card-shadow", c.panelShadow > 0 ? `0 ${Math.round(22 * c.panelShadow)}px ${Math.round(64 * c.panelShadow)}px ` + `rgba(0,0,0,${(0.55 * c.panelShadow).toFixed(3)})` : "none");
        css("--shp-overlay-bg", toCss(withAlpha(darken(pal.background, 0.25), c.panelOpacity)));
        css("--shp-overlay-blur", `${c.panelBlur}px`);
        css("--shp-accent", toCss(accentLight));
        css("--shp-accent-hover", toCss(lighten(pal.select, 0.18)));
        css("--shp-accent-fg", toCss(darken(pal.select, 0.72)));
        css("--shp-star", toCss(pal.select));
    };
    applyPopupTheme();
    const dispatch = (action)=>{
        switch(action){
            case "rotate":
                return scene.rotate();
            case "rotateCCW":
                return scene.rotateCCW();
            case "flip":
                return scene.flip();
            case "undo":
                return scene.undo();
            case "hint":
                return scene.hint();
            case "selectNext":
                return scene.selectNext();
            case "next":
                if (scene.solved) advance();
                return;
        }
    };
    const engine = new Engine({
        scheduler: rafScheduler2,
        step: (dt)=>scene.update(dt),
        render: ()=>{
            for (const action of intent.consumePressed())dispatch(action);
            intent.tick();
            if (renderer instanceof CanvasRenderer) {
                renderer.setPost({
                    vignette: scene.config.vignette
                });
            }
            applyPopupTheme();
            renderer.render(scene.collect(vw, vh));
            hud.update(scene);
            const placed = scene.game.placements;
            if (placed > lastPlacements) audio.click();
            lastPlacements = placed;
            if (scene.solved && phase.get() === "playing") {
                audio.solved();
                solved.show(scene);
                phase.set("solved");
            }
        }
    });
    unsubs.push(reactTo([
        phase
    ], ()=>{
        const p = phase.get();
        start.root.style.display = p === "title" ? "flex" : "none";
        solved.root.style.display = p === "solved" ? "flex" : "none";
        hud.root.style.display = p === "playing" ? "flex" : "none";
        hud.controls.style.display = p === "playing" ? "flex" : "none";
        muteBtn.style.display = p === "playing" ? "inline-flex" : "none";
        if (p === "title") engine.stop();
        else engine.start();
    }));
    const cleanups = [];
    const on = (target, type, fn, options)=>{
        target.addEventListener(type, fn, options);
        cleanups.push(()=>target.removeEventListener(type, fn, options));
    };
    const localXY = (e)=>{
        const r1 = canvas.getBoundingClientRect();
        return [
            e.clientX - r1.left,
            e.clientY - r1.top
        ];
    };
    const LONG_PRESS_MS = 400;
    let downX = 0;
    let downY = 0;
    let dragged = false;
    let lastTapId = null;
    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let lastPointerType = "mouse";
    let activeBeforePress = null;
    let longPressTimer = null;
    let longPressFired = false;
    const activePointers = new Set();
    let multiTouch = false;
    const cancelLongPress = ()=>{
        if (longPressTimer != null) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };
    const secondaryAction = (x, y)=>{
        if (phase.get() !== "playing") return;
        const id = scene.pieceAt(x, y);
        if (id == null) return;
        if (scene.game.pieces[id].state === "placed") scene.removePlaced(id);
        else scene.flip(id);
    };
    const handleTap = (x, y, t)=>{
        if (phase.get() !== "playing") return;
        const id = scene.pieceAt(x, y);
        if (id == null) {
            lastTapId = null;
            return;
        }
        if (scene.game.pieces[id].state === "placed") {
            const isDouble = id === lastTapId && t - lastTapAt <= 280 && Math.hypot(x - lastTapX, y - lastTapY) <= 40;
            lastTapId = id;
            lastTapAt = t;
            lastTapX = x;
            lastTapY = y;
            if (isDouble) {
                lastTapId = null;
                scene.removePlaced(id);
            }
            return;
        }
        lastTapId = id;
        lastTapAt = t;
        lastTapX = x;
        lastTapY = y;
        if (id === activeBeforePress) scene.rotate(id);
    };
    on(globalThis, "resize", ()=>resize());
    on(canvas, "contextmenu", (e)=>{
        e.preventDefault();
        if (lastPointerType === "touch") return;
        const me = e;
        const r1 = canvas.getBoundingClientRect();
        secondaryAction(me.clientX - r1.left, me.clientY - r1.top);
    });
    on(canvas, "pointerdown", (e)=>{
        const pe = e;
        lastPointerType = pe.pointerType || lastPointerType;
        if (pe.button > 0) return;
        audio.resume();
        activePointers.add(pe.pointerId);
        if (activePointers.size >= 2) {
            multiTouch = true;
            cancelLongPress();
            scene.pointerUp();
            dragged = false;
            lastTapId = null;
            if (!longPressFired) secondaryAction(downX, downY);
            return;
        }
        canvas.setPointerCapture?.(pe.pointerId);
        [downX, downY] = localXY(pe);
        dragged = false;
        longPressFired = false;
        activeBeforePress = scene.game.draggingId ?? scene.game.selectedId;
        scene.pointerDown(downX, downY);
        cancelLongPress();
        longPressTimer = setTimeout(()=>{
            longPressTimer = null;
            if (multiTouch || dragged) return;
            longPressFired = true;
            secondaryAction(downX, downY);
        }, LONG_PRESS_MS);
    });
    on(canvas, "pointermove", (e)=>{
        const pe = e;
        lastPointerType = pe.pointerType || lastPointerType;
        if (multiTouch) return;
        const [x, y] = localXY(pe);
        scene.pointerMove(x, y);
        if (scene.game.draggingId != null || (x - downX) ** 2 + (y - downY) ** 2 > 8 * 8) {
            dragged = true;
            cancelLongPress();
        }
    });
    on(canvas, "pointerup", (e)=>{
        const pe = e;
        activePointers.delete(pe.pointerId);
        cancelLongPress();
        if (multiTouch) {
            if (activePointers.size === 0) multiTouch = false;
            return;
        }
        scene.pointerUp();
        if (longPressFired) {
            longPressFired = false;
            return;
        }
        if (dragged) lastTapId = null;
        else handleTap(downX, downY, pe.timeStamp);
    });
    on(canvas, "pointercancel", (e)=>{
        activePointers.delete(e.pointerId);
        cancelLongPress();
        scene.pointerUp();
        dragged = false;
        longPressFired = false;
        if (activePointers.size === 0) multiTouch = false;
    });
    on(globalThis, "keydown", (e)=>{
        const ke = e;
        if (ke.code in KEYMAP) {
            ke.preventDefault();
            if (ke.code === "KeyR" && ke.shiftKey) {
                if (phase.get() === "playing") scene.rotateCCW();
                return;
            }
            intent.keyDown(ke.code);
        }
    });
    on(globalThis, "keyup", (e)=>intent.keyUp(e.code));
    on(globalThis, "blur", ()=>intent.reset());
    hud.bind(()=>scene.hint());
    resize();
    if ((opts.title ?? true) === false) engine.start();
    return {
        scene,
        engine,
        canvas,
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
        start: ()=>engine.start(),
        stop: ()=>engine.stop(),
        destroy () {
            engine.stop();
            cancelLongPress();
            for (const c of cleanups)c();
            for (const u of unsubs)u();
            renderer.dispose?.();
            audio.destroy();
            hud.root.remove();
            hud.controls.remove();
            muteBtn.remove();
            start.root.remove();
            solved.root.remove();
            if (!opts.canvas) canvas.remove();
        }
    };
}
function buildHud(container) {
    const root = el1("div", "shp-hud");
    const level = el1("span", "shp-stat");
    const moves = el1("span", "shp-stat");
    const time = el1("span", "shp-stat");
    root.append(level, moves, time);
    container.append(root);
    const controls = el1("div", "shp-controls");
    const hint = iconBtn(ICONS.hint, "Hint (H)");
    controls.append(hint);
    container.append(controls);
    return {
        root,
        controls,
        update (scene) {
            level.textContent = `Level ${scene.levelNumber}`;
            moves.textContent = `${scene.moves} / par ${scene.par}`;
            time.textContent = formatTime(scene.elapsedMs);
        },
        bind (onHint) {
            hint.onclick = onHint;
        }
    };
}
function buildStartScreen(container, onPlay) {
    const root = el1("div", "shp-overlay");
    const card = el1("div", "shp-card");
    const h = el1("h1", "shp-title");
    h.textContent = "Shapes";
    const p = el1("p", "shp-sub");
    p.textContent = "Drag pieces onto the figure. Tap to select, tap again to rotate; hold, right-click or " + "two-finger tap to flip. Double-tap a placed piece to take it back. Fewest moves wins.";
    const play = btn("Play", "Play");
    play.classList.add("shp-primary");
    play.onclick = onPlay;
    card.append(h, p, play);
    root.append(card);
    container.append(root);
    return {
        root
    };
}
function buildSolvedScreen(container, onNext) {
    const root = el1("div", "shp-overlay");
    const card = el1("div", "shp-card");
    const h = el1("h1", "shp-title");
    h.textContent = "Solved!";
    const stars = el1("div", "shp-stars");
    const detail = el1("p", "shp-sub");
    const next = btn("Next level", "Next");
    next.classList.add("shp-primary");
    next.onclick = onNext;
    card.append(h, stars, detail, next);
    root.append(card);
    container.append(root);
    return {
        root,
        show (scene) {
            const s = scene.score();
            stars.innerHTML = [
                0,
                1,
                2
            ].map((i)=>starIcon(i < s.stars)).join("");
            detail.textContent = `${s.moves} moves (par ${s.par}) · ${formatTime(s.timeMs)}`;
        }
    };
}
function el1(tag, className) {
    const e = document.createElement(tag);
    e.className = className;
    return e;
}
function btn(label, title) {
    const b = document.createElement("button");
    b.className = "shp-btn";
    b.type = "button";
    b.textContent = label;
    b.title = title;
    return b;
}
function iconBtn(svg, title) {
    const b = document.createElement("button");
    b.className = "shp-btn shp-icon";
    b.type = "button";
    b.innerHTML = svg;
    b.title = title;
    b.setAttribute("aria-label", title);
    return b;
}
function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}
const STYLE_ID1 = "shapes-runtime-style";
function ensureStyles1() {
    if (document.getElementById(STYLE_ID1)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID1;
    style.textContent = CSS;
    document.head.append(style);
}
const CSS = `
.shp-hud{position:fixed;top:0;left:0;right:0;z-index:8;display:flex;gap:16px;justify-content:center;
 padding:calc(10px + env(safe-area-inset-top,0px)) calc(10px + env(safe-area-inset-right,0px)) 10px
 calc(10px + env(safe-area-inset-left,0px));font:13px/1.4 ui-monospace,Menlo,monospace;
 color:#dfe7f5;pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.6);}
.shp-stat{opacity:.92;}
.shp-controls{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom,0px));left:0;right:0;z-index:8;
 display:flex;gap:12px;justify-content:center;}
.shp-btn{min-width:48px;min-height:48px;padding:0 14px;border-radius:12px;cursor:pointer;
 display:inline-flex;align-items:center;justify-content:center;
 font:15px/1 system-ui,sans-serif;color:#eef2fb;background:rgba(40,48,66,.82);
 border:1px solid rgba(130,150,200,.28);backdrop-filter:blur(6px);}
.shp-btn:hover{background:rgba(56,66,90,.92);}
.shp-btn:active{transform:translateY(1px);}
.shp-btn svg{display:block;}
.shp-icon{padding:0;}
.shp-mute{position:fixed;top:calc(16px + env(safe-area-inset-top,0px));
 right:calc(16px + env(safe-area-inset-right,0px));z-index:8;}
.shp-overlay{position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;
 background:var(--shp-overlay-bg,rgba(8,11,18,.6));
 backdrop-filter:blur(var(--shp-overlay-blur,3px));-webkit-backdrop-filter:blur(var(--shp-overlay-blur,3px));}
.shp-card{max-width:340px;text-align:center;padding:28px 26px;border-radius:var(--shp-card-radius,18px);
 background:var(--shp-card-bg,rgba(24,29,40,.96));border:1px solid var(--shp-card-border,rgba(130,150,200,.22));
 color:var(--shp-card-fg,#eaf0fb);box-shadow:var(--shp-card-shadow,0 20px 60px rgba(0,0,0,.45));}
.shp-title{margin:0 0 10px;font:600 28px/1.1 system-ui,sans-serif;letter-spacing:.5px;}
.shp-sub{margin:0 0 18px;font:14px/1.5 system-ui,sans-serif;opacity:.82;}
.shp-stars{display:flex;justify-content:center;gap:6px;color:var(--shp-star,#ffd873);margin-bottom:10px;}
.shp-primary{min-width:140px;color:var(--shp-accent-fg,#fff);
 background:var(--shp-accent,rgba(90,130,210,.92));border-color:transparent;}
.shp-primary:hover{background:var(--shp-accent-hover,rgba(108,150,230,1));}
/* Installed PWA: the OS status bar overlays the content but env(safe-area-inset-top) can report 0
   (non-notched iOS, black-translucent), hiding the top-anchored HUD + mute button under the clock.
   Enforce a minimum top clearance so they stay readable + reachable, mirroring the example chrome. */
@media (display-mode:standalone),(display-mode:fullscreen){
 .shp-mute{top:calc(16px + max(env(safe-area-inset-top,0px),28px));}
 .shp-hud{padding-top:calc(10px + max(env(safe-area-inset-top,0px),28px));}
}
`;
function createShapesExample(host) {
    const stage = document.createElement("div");
    stage.className = "stage";
    stage.dataset.world = "shapes";
    host.append(stage);
    const handle = mountShapes({
        container: stage,
        title: true,
        randomizeSeed: true
    });
    const panel = createControlPanel({
        config: handle.scene.config,
        schema: CONFIG_SCHEMA2,
        title: "Shapes",
        onChange: (patch)=>{
            handle.scene.setConfig(patch);
            panel.set(handle.scene.config);
        },
        onClose: ()=>setPanelOpen(false)
    });
    panel.el.style.display = "none";
    stage.append(panel.el);
    let menuOpen = false;
    let panelOpen = false;
    const applyVisibility = ()=>{
        menu.style.display = menuOpen ? "flex" : "none";
        panel.el.style.display = panelOpen ? "" : "none";
    };
    const setPanelOpen = (on)=>{
        panelOpen = on;
        applyVisibility();
    };
    const menuBtn = document.createElement("button");
    menuBtn.className = "shp-menu-btn";
    menuBtn.innerHTML = ICONS.menu;
    menuBtn.title = "Menu";
    menuBtn.setAttribute("aria-label", "Menu");
    menuBtn.onclick = ()=>{
        menuOpen = !menuOpen;
        applyVisibility();
    };
    stage.append(menuBtn);
    const menu = document.createElement("div");
    menu.className = "shp-menu";
    const menuItem = (icon, label, onClick)=>{
        const b = document.createElement("button");
        b.className = "shp-menu-item";
        b.type = "button";
        b.innerHTML = `${icon}<span>${label}</span>`;
        b.onclick = onClick;
        return b;
    };
    const newGame = menuItem(ICONS.refresh, "New puzzle", ()=>{
        handle.scene.setConfig({
            seed: Math.random().toString(36).slice(2, 9)
        });
        panel.set(handle.scene.config);
        menuOpen = false;
        applyVisibility();
    });
    const settings = menuItem(ICONS.settings, "Settings", ()=>{
        setPanelOpen(!panelOpen);
        menuOpen = false;
        applyVisibility();
    });
    const worlds = menuItem(ICONS.back, "Worlds", ()=>location.hash = "#/");
    menu.append(newGame, settings, worlds);
    stage.append(menu);
    return {
        destroy () {
            panel.destroy();
            handle.destroy();
            stage.remove();
        }
    };
}
const ROUTES = {
    "/": {
        factory: createChooser,
        themeColor: "#0a0f1e"
    },
    "/city": {
        factory: createCityExample,
        themeColor: "#0a0f1e"
    },
    "/nature": {
        factory: createNatureExample,
        themeColor: "#bfe0f5"
    },
    "/shapes": {
        factory: createShapesExample,
        themeColor: "#12161e"
    }
};
const mount = document.getElementById("app");
if (!mount) throw new Error("#app mount point missing");
const app = mount;
const themeMeta = document.querySelector('meta[name="theme-color"]');
let current = null;
let currentKey = "";
function routeKey() {
    const raw = location.hash.replace(/^#/, "") || "/";
    return Object.hasOwn(ROUTES, raw) ? raw : null;
}
function render() {
    const key = routeKey();
    if (key === null) {
        location.hash = "#/";
        return;
    }
    if (key === currentKey && current) return;
    current?.destroy();
    const route = ROUTES[key];
    themeMeta?.setAttribute("content", route.themeColor);
    current = route.factory(app);
    currentKey = key;
}
globalThis.addEventListener("hashchange", render);
render();
if ("serviceWorker" in navigator) {
    globalThis.addEventListener("load", ()=>{
        navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
}
