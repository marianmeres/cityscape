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
function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}
function lerp(a, b, t) {
    return a + (b - a) * t;
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
function rgb(r1, g, b, a = 1) {
    return {
        r: clamp(Math.round(r1), 0, 255),
        g: clamp(Math.round(g), 0, 255),
        b: clamp(Math.round(b), 0, 255),
        a: clamp(a, 0, 1)
    };
}
function withAlpha(c, a) {
    return {
        r: c.r,
        g: c.g,
        b: c.b,
        a: clamp(a, 0, 1)
    };
}
function toCss(c) {
    return `rgba(${c.r},${c.g},${c.b},${round3(c.a)})`;
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
const PALETTES = {
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
    }
};
const PALETTE_NAMES = Object.keys(PALETTES);
function getPalette(name) {
    return PALETTES[name] ?? PALETTES.slate;
}
function pieceColor(palette, index) {
    const hue = (palette.hueBase + index * 137.508) % 360;
    return hsl(hue, palette.sat, palette.light);
}
const CONFIG_SCHEMA = [
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
        options: PALETTE_NAMES.map((n)=>({
                value: n,
                label: PALETTES[n].label
            }))
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
function buildDefaults1(schema = CONFIG_SCHEMA) {
    return buildDefaults(schema);
}
const DEFAULT_CONFIG = buildDefaults1();
function normalizeConfig1(input) {
    return normalizeConfig(CONFIG_SCHEMA, input);
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
    rotateSelected() {
        this.#reorient((o)=>rotateCW(o));
    }
    rotateSelectedCCW() {
        this.#reorient((o)=>rotateCCW(o));
    }
    flipSelected() {
        this.#reorient((o)=>flip(o));
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
        const id = this.#placedOrder.pop();
        if (id == null) return;
        const p = this.pieces[id];
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
        this.moves++;
        this.phase = "playing";
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
    #reorient(fn) {
        const id = this.draggingId ?? this.selectedId;
        if (id == null) return;
        const p = this.pieces[id];
        if (p.state === "placed") return;
        p.orientation = fn(p.orientation);
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
function drawGame(out, game, paletteName) {
    const pal = getPalette(paletteName);
    const layout = game.layout;
    const cell = layout.cell;
    const gap = Math.max(1, cell * 0.07);
    out.rect(0, 0, out.width, out.height, pal.background);
    const t = layout.trayRect;
    out.rect(t.x, t.y, t.w, t.h, pal.tray);
    const h = gap / 2;
    for(let r1 = 0; r1 < layout.figH; r1++){
        for(let c = 0; c < layout.figW; c++){
            const { x, y } = cellToScreen(layout, r1, c);
            out.rect(x - h, y - h, cell + gap, cell + gap, pal.outline);
        }
    }
    for(let r1 = 0; r1 < layout.figH; r1++){
        for(let c = 0; c < layout.figW; c++){
            const { x, y } = cellToScreen(layout, r1, c);
            out.rect(x + h, y + h, cell - gap, cell - gap, pal.cellEmpty);
        }
    }
    const top = game.draggingId ?? game.selectedId;
    const drawOne = (p, selected)=>{
        const c = p.state === "tray" ? layout.trayCell : layout.cell;
        drawPiece(out, p, pal, c, Math.max(1, c * 0.07), selected);
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
function drawPiece(out, p, pal, cell, gap, selected) {
    const fill = pieceColor(pal, p.shape.colorIndex);
    const body = p.state === "placed" ? lighten(fill, 0.06) : fill;
    const border = selected ? pal.select : darken(fill, 0.35);
    const cells = orientedCells(p.shape, p.orientation);
    const h = gap / 2;
    const s = cell - gap;
    for (const c of cells){
        out.rect(p.x + c.c * cell - h, p.y + c.r * cell - h, cell + gap, cell + gap, border);
    }
    for (const c of cells){
        const x = p.x + c.c * cell + h;
        const y = p.y + c.r * cell + h;
        out.rect(x, y, s, s, body);
        out.rect(x, y, s, s * 0.4, withAlpha(lighten(body, 0.25), 0.5));
    }
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
        drawGame(out, this.#game, this.config.palette);
        return out;
    }
    resize(width, height) {
        this.#vw = Math.max(1, width);
        this.#vh = Math.max(1, height);
        this.#game.resize(this.#vw, this.#vh);
    }
    setConfig(patch) {
        const next = normalizeConfig1({
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
    rotate() {
        this.#game.rotateSelected();
    }
    rotateCCW() {
        this.#game.rotateSelectedCCW();
    }
    flip() {
        this.#game.flipSelected();
    }
    undo() {
        this.#game.undo();
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
    return new Shapes(normalizeConfig1({
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
const rafScheduler = (cb)=>{
    const id = requestAnimationFrame(cb);
    return ()=>cancelAnimationFrame(id);
};
function mountShapes(opts = {}) {
    ensureStyles();
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
        scheduler: rafScheduler,
        step: (dt)=>scene.update(dt),
        render: ()=>{
            for (const action of intent.consumePressed())dispatch(action);
            intent.tick();
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
    on(globalThis, "resize", ()=>resize());
    on(canvas, "pointerdown", (e)=>{
        const pe = e;
        audio.resume();
        canvas.setPointerCapture?.(pe.pointerId);
        scene.pointerDown(...localXY(pe));
    });
    on(canvas, "pointermove", (e)=>scene.pointerMove(...localXY(e)));
    on(canvas, "pointerup", ()=>scene.pointerUp());
    on(canvas, "pointercancel", ()=>scene.pointerUp());
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
    hud.bind({
        rotate: ()=>scene.rotate(),
        flip: ()=>scene.flip(),
        undo: ()=>scene.undo(),
        hint: ()=>scene.hint()
    });
    const muteBtn = iconBtn(ICONS.volumeOn, "Mute");
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
    hud.controls.append(muteBtn);
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
            for (const c of cleanups)c();
            for (const u of unsubs)u();
            renderer.dispose?.();
            audio.destroy();
            hud.root.remove();
            hud.controls.remove();
            start.root.remove();
            solved.root.remove();
            if (!opts.canvas) canvas.remove();
        }
    };
}
function buildHud(container) {
    const root = el("div", "shp-hud");
    const level = el("span", "shp-stat");
    const moves = el("span", "shp-stat");
    const time = el("span", "shp-stat");
    root.append(level, moves, time);
    container.append(root);
    const controls = el("div", "shp-controls");
    const rotate = iconBtn(ICONS.rotateCW, "Rotate (R)");
    const flip = iconBtn(ICONS.flip, "Flip (F)");
    const undo = iconBtn(ICONS.undo, "Undo (Z)");
    const hint = iconBtn(ICONS.hint, "Hint (H)");
    controls.append(rotate, flip, undo, hint);
    container.append(controls);
    return {
        root,
        controls,
        update (scene) {
            level.textContent = `Level ${scene.levelNumber}`;
            moves.textContent = `${scene.moves} / par ${scene.par}`;
            time.textContent = formatTime(scene.elapsedMs);
        },
        bind (h) {
            rotate.onclick = h.rotate;
            flip.onclick = h.flip;
            undo.onclick = h.undo;
            hint.onclick = h.hint;
        }
    };
}
function buildStartScreen(container, onPlay) {
    const root = el("div", "shp-overlay");
    const card = el("div", "shp-card");
    const h = el("h1", "shp-title");
    h.textContent = "Shapes";
    const p = el("p", "shp-sub");
    p.textContent = "Reassemble the figure. Drag pieces in, rotate & flip to fit — fewest moves wins.";
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
    const root = el("div", "shp-overlay");
    const card = el("div", "shp-card");
    const h = el("h1", "shp-title");
    h.textContent = "Solved!";
    const stars = el("div", "shp-stars");
    const detail = el("p", "shp-sub");
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
function el(tag, className) {
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
const STYLE_ID = "shapes-runtime-style";
function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
}
const CSS = `
.shp-hud{position:fixed;top:0;left:0;right:0;z-index:8;display:flex;gap:16px;justify-content:center;
 padding:10px;font:13px/1.4 ui-monospace,Menlo,monospace;color:#dfe7f5;pointer-events:none;
 text-shadow:0 1px 2px rgba(0,0,0,.6);}
.shp-stat{opacity:.92;}
.shp-controls{position:fixed;bottom:16px;left:0;right:0;z-index:8;display:flex;gap:12px;justify-content:center;}
.shp-btn{min-width:48px;min-height:48px;padding:0 14px;border-radius:12px;cursor:pointer;
 display:inline-flex;align-items:center;justify-content:center;
 font:15px/1 system-ui,sans-serif;color:#eef2fb;background:rgba(40,48,66,.82);
 border:1px solid rgba(130,150,200,.28);backdrop-filter:blur(6px);}
.shp-btn:hover{background:rgba(56,66,90,.92);}
.shp-btn:active{transform:translateY(1px);}
.shp-btn svg{display:block;}
.shp-icon{padding:0;}
.shp-overlay{position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;
 background:rgba(8,11,18,.6);backdrop-filter:blur(3px);}
.shp-card{max-width:340px;text-align:center;padding:28px 26px;border-radius:18px;
 background:rgba(24,29,40,.96);border:1px solid rgba(130,150,200,.22);color:#eaf0fb;
 box-shadow:0 20px 60px rgba(0,0,0,.45);}
.shp-title{margin:0 0 10px;font:600 28px/1.1 system-ui,sans-serif;letter-spacing:.5px;}
.shp-sub{margin:0 0 18px;font:14px/1.5 system-ui,sans-serif;opacity:.82;}
.shp-stars{display:flex;justify-content:center;gap:6px;color:#ffd873;margin-bottom:10px;}
.shp-primary{min-width:140px;background:rgba(90,130,210,.92);border-color:rgba(150,180,240,.5);}
.shp-primary:hover{background:rgba(108,150,230,1);}
`;
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
const PALETTES1 = {
    navy,
    vaporwave,
    ink,
    dawn
};
const PALETTE_NAMES1 = [
    "navy",
    "vaporwave",
    "ink",
    "dawn"
];
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
        options: PALETTE_NAMES1.map((n)=>({
                value: n,
                label: PALETTES1[n].label
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
function buildDefaults2(schema = CONFIG_SCHEMA1) {
    return buildDefaults(schema);
}
buildDefaults2();
const STYLE_ID1 = "cityscape-panel-style";
function createControlPanel(opts) {
    ensureStyles1();
    const schema = opts.schema ?? CONFIG_SCHEMA1;
    const unsubs = [];
    const setters = new Map();
    const collapsed = observable(opts.collapsed ?? false);
    const root = el1("div", "cityscape-panel");
    const header = el1("div", "csp-header");
    const heading = el1("div", "csp-title");
    heading.textContent = opts.title ?? "Cityscape";
    const spacer = el1("div", "csp-spacer");
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
    const body = el1("div", "csp-body");
    const groups = deriveGroups(schema);
    for (const group of groups){
        const fields = schema.filter((f)=>f.group === group);
        if (fields.length === 0) continue;
        const section = el1("div", "csp-group");
        const gh = el1("div", "csp-group-title");
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
    const row = el1("label", "csp-field");
    row.title = f.help ?? "";
    const labelRow = el1("div", "csp-label");
    const name = el1("span", "csp-name");
    name.textContent = f.label;
    const value = el1("span", "csp-value");
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
function el1(tag, className) {
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
function ensureStyles1() {
    if (document.getElementById(STYLE_ID1)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID1;
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
const handle = mountShapes({
    title: true,
    randomizeSeed: true
});
const panel = createControlPanel({
    config: handle.scene.config,
    schema: CONFIG_SCHEMA,
    title: "Shapes",
    onChange: (patch)=>{
        handle.scene.setConfig(patch);
        panel.set(handle.scene.config);
    },
    onClose: ()=>setPanelOpen(false)
});
panel.el.style.display = "none";
document.body.append(panel.el);
let menuOpen = false;
let panelOpen = false;
const applyVisibility = ()=>{
    menu.style.display = menuOpen ? "flex" : "none";
    panel.el.style.display = panelOpen ? "" : "none";
};
function setPanelOpen(on) {
    panelOpen = on;
    applyVisibility();
}
const menuBtn = document.createElement("button");
menuBtn.className = "shp-menu-btn";
menuBtn.innerHTML = ICONS.menu;
menuBtn.title = "Menu";
menuBtn.setAttribute("aria-label", "Menu");
menuBtn.onclick = ()=>{
    menuOpen = !menuOpen;
    applyVisibility();
};
document.body.append(menuBtn);
const menu = document.createElement("div");
menu.className = "shp-menu";
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
const worlds = document.createElement("a");
worlds.className = "shp-menu-item";
worlds.innerHTML = `${ICONS.back}<span>Worlds</span>`;
worlds.href = "../";
menu.append(newGame, settings, worlds);
document.body.append(menu);
function menuItem(icon, label, onClick) {
    const b = document.createElement("button");
    b.className = "shp-menu-item";
    b.type = "button";
    b.innerHTML = `${icon}<span>${label}</span>`;
    b.onclick = onClick;
    return b;
}
