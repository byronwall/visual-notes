/* Diagram Studio 5 — joint port selection and obstacle-aware routing.
 * Original local implementation, not libavoid. Pure input/output, Browser + Node.
 * Node positions are never changed. Explicit sides and waypoints are constraints.
 */

const SIDES = ['right', 'bottom', 'left', 'top'],
  EPS = 0.0001;
const round = n => Math.round(n * 100) / 100,
  clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const clone = v => JSON.parse(JSON.stringify(v)),
  cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const same = (a, b) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const vector = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};
const defaults = {
  clearance: 10,
  portGap: 16,
  edgeGap: 16,
  bendPenalty: 32,
  crossingPenalty: 360,
  sharedPenalty: 8,
  parallelPenalty: 18,
  portStability: 20,
  fanoutPenalty: 50,
  passes: 3,
  cornerRadius: 6,
  standoff: 20,
};
function settings(raw = {}) {
  const s = { ...defaults, ...raw },
    ranges = {
      clearance: [4, 30],
      portGap: [6, 28],
      bendPenalty: [0, 100],
      crossingPenalty: [0, 1200],
      sharedPenalty: [0, 20],
      portStability: [0, 150],
      fanoutPenalty: [0, 160],
      passes: [1, 5],
      edgeGap: [4, 48],
      parallelPenalty: [0, 60],
      cornerRadius: [0, 16],
      standoff: [0, 40],
    };
  for (const [k, [lo, hi]] of Object.entries(ranges)) {
    if (typeof s[k] !== 'number' || !Number.isFinite(s[k]))
      throw Error('Routing ' + k + ' must be a finite number.');
    s[k] = clamp(s[k], lo, hi);
  }
  s.passes = Math.round(s.passes);
  return s;
}
function inflate(r, p) {
  return {
    ...r,
    x: round(r.x - p),
    y: round(r.y - p),
    w: round(r.w + 2 * p),
    h: round(r.h + 2 * p),
  };
}
function contains(p, r) {
  return p.x > r.x + EPS && p.x < r.x + r.w - EPS && p.y > r.y + EPS && p.y < r.y + r.h - EPS;
}
// An `across` obstacle can be crossed vertically but not run along: a header band beside
// its title. With `gates`, only on those lines: the band is crossed only by a line straight
// into or out of a member's top.
const passes = (r, x) => r.across && (!r.gates || r.gates.some(g => Math.abs(g - x) < EPS));
function blocked(a, b, obs) {
  if (same(a, b)) return obs.some(r => !r.across && contains(a, r));
  if (Math.abs(a.x - b.x) < EPS)
    return obs.some(
      r =>
        !passes(r, a.x) &&
        a.x > r.x + EPS &&
        a.x < r.x + r.w - EPS &&
        Math.max(a.y, b.y) > r.y + EPS &&
        Math.min(a.y, b.y) < r.y + r.h - EPS,
    );
  if (Math.abs(a.y - b.y) < EPS)
    return obs.some(
      r =>
        a.y > r.y + EPS &&
        a.y < r.y + r.h - EPS &&
        Math.max(a.x, b.x) > r.x + EPS &&
        Math.min(a.x, b.x) < r.x + r.w - EPS,
    );
  return true;
}
function compress(ps) {
  const out = [];
  for (const raw of ps) {
    const p = { x: round(raw.x), y: round(raw.y) };
    if (out.length && same(out.at(-1), p)) continue;
    while (out.length >= 2) {
      const a = out.at(-2),
        b = out.at(-1);
      const collinear =
        (Math.abs(a.x - b.x) < EPS && Math.abs(b.x - p.x) < EPS) ||
        (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - p.y) < EPS);
      // Never erase a reversal: it would hide a backtracking stub.
      if (collinear && (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) >= 0) out.pop();
      else break;
    }
    out.push(p);
  }
  return out;
}
function segments(ps) {
  return ps.slice(1).map((b, i) => [ps[i], b]);
}
function intersection(a, b, c, d) {
  const h = Math.abs(a.y - b.y) < EPS,
    k = Math.abs(c.y - d.y) < EPS;
  if (h === k) {
    const axis = h ? 'x' : 'y',
      line = h ? 'y' : 'x';
    if (Math.abs(a[line] - c[line]) > EPS) return null;
    const amount =
      Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) -
      Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
    return amount > EPS ? { shared: amount } : null;
  }
  const [u, v, w, z] = h ? [a, b, c, d] : [c, d, a, b];
  const p = { x: w.x, y: u.y };
  if (
    p.x < Math.min(u.x, v.x) - EPS ||
    p.x > Math.max(u.x, v.x) + EPS ||
    p.y < Math.min(w.y, z.y) - EPS ||
    p.y > Math.max(w.y, z.y) + EPS
  )
    return null;
  return p;
}
// Lane spacing is separate from port spacing and node clearance. Measure the
// length of overlapping parallel runs, not merely exact shared coordinates.
function parallelNear(a, b, c, d, gap) {
  const h = Math.abs(a.y - b.y) < EPS,
    k = Math.abs(c.y - d.y) < EPS;
  if (h !== k) return null;
  const axis = h ? 'x' : 'y',
    line = h ? 'y' : 'x';
  const overlap =
    Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) -
    Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
  const separation = Math.abs(a[line] - c[line]);
  return overlap > 1 && separation < gap - 0.05
    ? { overlap, separation, deficit: (overlap * (gap - separation)) / gap }
    : null;
}
function parallelConflicts(points, used, gap) {
  let deficit = 0,
    pairs = 0,
    minGap = Infinity;
  for (const r of used)
    for (const [a, b] of segments(points))
      for (const [c, d] of segments(r.points)) {
        const p = parallelNear(a, b, c, d, gap);
        if (!p) continue;
        // Duplicate terminals need a short common fan-out; do not count the single
        // endpoint itself, but a shared run with positive length still counts.
        pairs++;
        deficit += p.deficit;
        minGap = Math.min(minGap, p.separation);
      }
  return {
    lanePairs: pairs,
    laneDeficit: round(deficit),
    minGap: Number.isFinite(minGap) ? round(minGap) : null,
  };
}
// Lane deficit against `used` from runs at least `min` apart.
function siblingDeficit(points, used, min, gap) {
  let deficit = 0;
  for (const r of used)
    for (const [a, b] of segments(points))
      for (const [c, d] of segments(r.points)) {
        const p = parallelNear(a, b, c, d, gap);
        if (p && p.separation >= min) deficit += p.deficit;
      }
  return deficit;
}
function conflicts(points, used) {
  const hits = new Set();
  let shared = 0;
  for (const r of used) {
    for (const [a, b] of segments(points))
      for (const [c, d] of segments(r.points)) {
        const p = intersection(a, b, c, d);
        if (!p) continue;
        if (p.shared) {
          shared += p.shared;
          continue;
        }
        // A shared shape terminal is connectivity, not an edge crossing.
        if (
          (same(p, points[0]) || same(p, points.at(-1))) &&
          (same(p, r.points[0]) || same(p, r.points.at(-1)))
        )
          continue;
        hits.add(r.id + ':' + round(p.x) + ',' + round(p.y));
      }
  }
  return { crossings: hits.size, shared };
}
// Soft clearance: a run parallel to a box side inside `band` costs more the closer
// it gets. Group borders (`border`) count from both sides. The hard clearance
// still decides what is passable, so tight gaps stay routable.
const STANDOFF_WEIGHT = 0.5,
  // A line along a group border reads as part of the frame: worse than one beside a box.
  BORDER_WEIGHT = 2;
function standoffCost(ps, near) {
  let n = 0;
  for (const [a, b] of segments(ps)) {
    const h = Math.abs(a.y - b.y) < EPS;
    if (!h && Math.abs(a.x - b.x) >= EPS) continue;
    const lo = h ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
      hi = h ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
      at = h ? a.y : a.x;
    for (const r of near) {
      const run = Math.min(hi, h ? r.x + r.w : r.y + r.h) - Math.max(lo, h ? r.x : r.y);
      if (run <= 1) continue;
      const s0 = h ? r.y : r.x,
        s1 = h ? r.y + r.h : r.x + r.w;
      let d;
      if (r.border) d = Math.min(Math.abs(at - s0), Math.abs(at - s1));
      else if (at <= s0) d = s0 - at;
      else if (at >= s1) d = at - s1;
      // Inside a box (only an edge's own end lets it in): as close as it gets.
      else d = 0;
      if (d < r.band) n += run * (1 - d / r.band) * (r.weight ?? 1);
    }
  }
  return n * STANDOFF_WEIGHT;
}
function standoffLines(near, xs, ys) {
  for (const r of near) {
    const add = r.border ? [-r.band, r.band] : [-r.band];
    for (const k of add) {
      xs.push(r.x + k, r.x + r.w - k);
      ys.push(r.y + k, r.y + r.h - k);
    }
  }
}
function cost(ps, used, s, near = []) {
  const c = conflicts(ps, used);
  return (
    (near.length ? standoffCost(ps, near) : 0) +
    segments(ps).reduce((n, [a, b]) => n + distance(a, b), 0) +
    Math.max(0, ps.length - 2) * s.bendPenalty +
    c.crossings * s.crossingPenalty +
    c.shared * s.sharedPenalty +
    parallelConflicts(ps, used, s.edgeGap).laneDeficit * s.parallelPenalty +
    segments(ps)
      .slice(1, -1)
      .reduce((sum, [a, b]) => sum + Math.max(0, 8 - distance(a, b)) * 4, 0)
  );
}
class Heap {
  constructor() {
    this.q = [];
  }
  push(v) {
    let i = this.q.length;
    this.q.push(v);
    while (i) {
      const p = (i - 1) >> 1;
      if (this.q[p].f <= v.f) break;
      this.q[i] = this.q[p];
      i = p;
    }
    this.q[i] = v;
  }
  pop() {
    const r = this.q[0],
      v = this.q.pop();
    if (this.q.length) {
      let i = 0;
      while (i * 2 + 1 < this.q.length) {
        let j = i * 2 + 1;
        if (j + 1 < this.q.length && this.q[j + 1].f < this.q[j].f) j++;
        if (this.q[j].f >= v.f) break;
        this.q[i] = this.q[j];
        i = j;
      }
      this.q[i] = v;
    }
    return r;
  }
  get length() {
    return this.q.length;
  }
}
/** A* moves on the grid: right, down, left, up, with the axis each runs along. */
const STEPS = [
  [1, 0, 0],
  [0, 1, 1],
  [-1, 0, 0],
  [0, -1, 1],
];
const FAR = 100000;
/** Search window margins round the two boxes, tried in turn; null is the whole grid. */
const WINDOWS = [80, null];
function search(start, end, obs, used, s, near = [], limit = 16000, win = null) {
  const xs = [start.x, end.x],
    ys = [start.y, end.y];
  // A wall's far side (`obsFor`) lies millions of units out: a line there would let a search
  // escape round the walls instead of failing.
  for (const r of obs)
    for (const [list, v] of [
      [xs, r.x],
      [xs, r.x + r.w],
      [ys, r.y],
      [ys, r.y + r.h],
    ])
      if (Math.abs(v) < FAR) list.push(v);
  standoffLines(near, xs, ys);
  for (const p of [start, end]) {
    xs.push(p.x - s.edgeGap, p.x + s.edgeGap);
    ys.push(p.y - s.edgeGap, p.y + s.edgeGap);
  }
  // Extra lanes beside existing paths allow rerouting without bundling them.
  for (const r of used)
    for (const p of r.points) {
      xs.push(p.x - s.edgeGap, p.x + s.edgeGap);
      ys.push(p.y - s.edgeGap, p.y + s.edgeGap);
    }
  xs.push(Math.min(...xs) - 32, Math.max(...xs) + 32);
  ys.push(Math.min(...ys) - 32, Math.max(...ys) + 32);
  // A window keeps only the grid lines inside it, with its own edges as the outermost lanes.
  const inX = v => !win || (v >= win.x0 && v <= win.x1),
    inY = v => !win || (v >= win.y0 && v <= win.y1);
  if (win) {
    xs.push(win.x0, win.x1);
    ys.push(win.y0, win.y1);
  }
  const X = [...new Set(xs.filter(inX).map(round))].sort((a, b) => a - b),
    Y = [...new Set(ys.filter(inY).map(round))].sort((a, b) => a - b),
    nx = X.length,
    ny = Y.length;
  const startCell = Y.indexOf(round(start.y)) * nx + X.indexOf(round(start.x)),
    endCell = Y.indexOf(round(end.y)) * nx + X.indexOf(round(end.x));
  const heap = new Heap(),
    // Per grid state (cell * 2 + axis): best cost so far and the state it came from. Per grid
    // edge (lower cell * 2 + axis): its cost, NaN until computed.
    scores = new Float64Array(nx * ny * 2).fill(Infinity),
    prev = new Int32Array(nx * ny * 2).fill(-1),
    cache = new Float64Array(nx * ny * 2).fill(NaN);
  // Compile route geometry once per search; avoid allocating paths and segment
  // arrays for every grid edge visited by A*. Touching terminals are excluded.
  const existing = used.flatMap(r =>
    segments(r.points).map(([a, b]) => ({
      a,
      b,
      id: r.id,
      first: r.points[0],
      last: r.points.at(-1),
      x0: Math.min(a.x, b.x),
      x1: Math.max(a.x, b.x),
      y0: Math.min(a.y, b.y),
      y1: Math.max(a.y, b.y),
    })),
  );
  // A segment farther than this from a grid edge can neither cross, share nor run parallel
  // within the edge gap, so its cost terms are zero; skipping it changes no result.
  const reach = Math.max(s.edgeGap, EPS) + 1;
  // Grid edges run along one grid line, so only what lies across that line can block or cost
  // them. Each line's share of the obstacles, standoff boxes and route segments is gathered once,
  // in their original order (so sums add up identically), and the exact tests below run on it.
  const lineCache = [new Map(), new Map()];
  function onLine(horizontal, at) {
    const memo = lineCache[horizontal ? 0 : 1];
    let hit = memo.get(at);
    if (hit) return hit;
    const lo = horizontal ? 'y' : 'x',
      size = horizontal ? 'h' : 'w',
      t0 = horizontal ? 'y0' : 'x0',
      t1 = horizontal ? 'y1' : 'x1';
    hit = {
      obs: obs.filter(r => r[lo] - 1 < at && r[lo] + r[size] + 1 > at),
      near: near.filter(r => r[lo] - r.band - 1 <= at && r[lo] + r[size] + r.band + 1 >= at),
      existing: existing.filter(t => t[t1] >= at - reach && t[t0] <= at + reach),
    };
    memo.set(at, hit);
    return hit;
  }
  function segmentCost(a, b, line) {
    let shared = 0;
    const hits = new Set(),
      x0 = Math.min(a.x, b.x) - reach,
      x1 = Math.max(a.x, b.x) + reach,
      y0 = Math.min(a.y, b.y) - reach,
      y1 = Math.max(a.y, b.y) + reach,
      close = line.existing.filter(t => t.x1 >= x0 && t.x0 <= x1 && t.y1 >= y0 && t.y0 <= y1);
    for (const t of close) {
      const p = intersection(a, b, t.a, t.b);
      if (!p) continue;
      if (p.shared) {
        shared += p.shared;
        continue;
      }
      if ((same(p, start) || same(p, end)) && (same(p, t.first) || same(p, t.last))) continue;
      hits.add(t.id + ':' + p.x + ',' + p.y);
    }
    let lanes = 0;
    for (const t of close) {
      const q = parallelNear(a, b, t.a, t.b, s.edgeGap);
      if (q) lanes += q.deficit;
    }
    return (
      distance(a, b) +
      (near.length ? standoffCost([a, b], line.near) : 0) +
      hits.size * s.crossingPenalty +
      shared * s.sharedPenalty +
      lanes * s.parallelPenalty
    );
  }

  for (const dir of [0, 1]) {
    const key = startCell * 2 + dir;
    scores[key] = 0;
    heap.push({ key, g: 0, f: distance(start, end) });
  }
  let result = null,
    visits = 0;
  while (heap.length && visits++ < limit) {
    const c = heap.pop();
    if (c.g !== scores[c.key]) continue;
    const cell = Math.floor(c.key / 2),
      dir = c.key % 2;
    if (cell === endCell) {
      result = c.key;
      break;
    }
    const x = cell % nx,
      y = Math.floor(cell / nx);
    for (let i = 0; i < 4; i++) {
      const [dx, dy, nd] = STEPS[i],
        xx = x + dx,
        yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= nx || yy >= ny) continue;
      const nc = yy * nx + xx,
        key = nc * 2 + nd,
        // The grid edge between two neighbouring cells: the lower cell, and which way it runs.
        ck = Math.min(cell, nc) * 2 + nd;
      let k = cache[ck];
      if (k !== k) {
        const a = { x: X[x], y: Y[y] },
          b = { x: X[xx], y: Y[yy] },
          line = nd ? onLine(false, a.x) : onLine(true, a.y);
        k = blocked(a, b, line.obs) ? Infinity : segmentCost(a, b, line);
        cache[ck] = k;
      }
      if (k === Infinity) continue;
      const g = c.g + k + (dir !== nd ? s.bendPenalty : 0);
      if (g >= scores[key] - 0.001) continue;
      scores[key] = g;
      prev[key] = c.key;
      heap.push({ key, g, f: g + Math.abs(X[xx] - end.x) + Math.abs(Y[yy] - end.y) });
    }
  }
  if (result === null) return null;
  const ps = [];
  for (let k = result; k !== -1; k = prev[k]) {
    const cell = Math.floor(k / 2);
    ps.push({ x: X[cell % nx], y: Y[Math.floor(cell / nx)] });
  }
  return compress(ps.reverse());
}
function doglegs(a, b, obs, s, used = [], near = []) {
  const choices = [
      [a, b],
      [a, { x: b.x, y: a.y }, b],
      [a, { x: a.x, y: b.y }, b],
    ],
    xs = new Set([(a.x + b.x) / 2]),
    ys = new Set([(a.y + b.y) / 2]);
  for (const r of obs) {
    if (r.x < Math.max(a.x, b.x) + 80 && r.x + r.w > Math.min(a.x, b.x) - 80) {
      ys.add(r.y);
      ys.add(r.y + r.h);
    }
    if (r.y < Math.max(a.y, b.y) + 80 && r.y + r.h > Math.min(a.y, b.y) - 80) {
      xs.add(r.x);
      xs.add(r.x + r.w);
    }
  }
  for (const r of used)
    for (const [u, v] of segments(r.points)) {
      if (Math.abs(u.x - v.x) < EPS) {
        xs.add(u.x - s.edgeGap);
        xs.add(u.x + s.edgeGap);
      } else {
        ys.add(u.y - s.edgeGap);
        ys.add(u.y + s.edgeGap);
      }
    }
  const lines = { x: [], y: [] };
  standoffLines(near, lines.x, lines.y);
  for (const x of lines.x)
    if (x > Math.min(a.x, b.x) - 80 && x < Math.max(a.x, b.x) + 80) xs.add(x);
  for (const y of lines.y)
    if (y > Math.min(a.y, b.y) - 80 && y < Math.max(a.y, b.y) + 80) ys.add(y);
  xs.add(Math.min(a.x, b.x) - s.portGap);
  xs.add(Math.max(a.x, b.x) + s.portGap);
  ys.add(Math.min(a.y, b.y) - s.portGap);
  ys.add(Math.max(a.y, b.y) + s.portGap);
  for (const x of xs) choices.push([a, { x, y: a.y }, { x, y: b.y }, b]);
  for (const y of ys) choices.push([a, { x: a.x, y }, { x: b.x, y }, b]);
  return choices.map(compress).filter(ps => !segments(ps).some(([c, d]) => blocked(c, d, obs)));
}
function port(rect, side, offset = 0) {
  const r = rect,
    shape = r.shape || 'box';
  let x = r.x + r.w / 2,
    y = r.y + r.h / 2;
  if (side === 'left' || side === 'right') {
    y += clamp(offset, -r.h / 2 + 10, r.h / 2 - 10);
    let inset = 0;
    if (['circle', 'icon', 'pill'].includes(shape)) {
      const radius = shape === 'pill' ? Math.min(r.h / 2, r.w / 2) : r.w / 2;
      inset = radius * (1 - Math.sqrt(Math.max(0, 1 - ((y - r.y - r.h / 2) / (r.h / 2)) ** 2)));
    }
    if (shape === 'diamond') inset = (Math.abs(y - r.y - r.h / 2) * r.w) / r.h;
    x = side === 'left' ? r.x + inset : r.x + r.w - inset;
  } else {
    x += clamp(offset, -r.w / 2 + 10, r.w / 2 - 10);
    let inset = 0;
    if (['circle', 'icon'].includes(shape))
      inset = (r.h / 2) * (1 - Math.sqrt(Math.max(0, 1 - ((x - r.x - r.w / 2) / (r.w / 2)) ** 2)));
    if (shape === 'pill') {
      const radius = Math.min(r.h / 2, r.w / 2),
        beyond = Math.max(0, Math.abs(x - r.x - r.w / 2) - (r.w / 2 - radius));
      inset = radius - Math.sqrt(Math.max(0, radius * radius - beyond * beyond));
    }
    if (shape === 'diamond') inset = (Math.abs(x - r.x - r.w / 2) * r.h) / r.w;
    y = side === 'top' ? r.y + inset : r.y + r.h - inset;
  }
  return { x: round(x), y: round(y) };
}
// A full fan's pitch: closer than the port gap, still clear of `edges-too-close` (< 10px).
const TIGHT_PITCH = 12;
// `tight`: more edges face this side than it has full-gap slots, so its fan takes `TIGHT_PITCH`
// from the first port on. Handing the tight slots out from the start keeps the fan nested:
// the nearer ends take the middle slots and the farther ones the outer slots.
function slot(id, side, r, used, s, other, tight = false, spread = true) {
  const vertical = side === 'left' || side === 'right',
    span = (vertical ? r.h : r.w) - 24,
    cross = vertical ? 'y' : 'x',
    desired = center(other)[cross] - center(r)[cross];
  const separation = tight
    ? Math.min(TIGHT_PITCH, Math.max(s.portGap, s.edgeGap))
    : Math.max(s.portGap, s.edgeGap);
  const occupied = [];
  for (const q of used) {
    if (q.from === id && q.fromSide === side) occupied.push(q.fromOffset);
    if (q.to === id && q.toSide === side) occupied.push(q.toOffset);
  }
  const options = [0];
  for (let i = 1; i <= 16; i++)
    for (const sign of [1, -1])
      if (i * separation <= span / 2 + EPS) options.push(sign * i * separation);
  options.sort((a, b) => Math.abs(a) - Math.abs(b) || (desired < 0 ? a - b : b - a));
  for (const n of options) if (occupied.every(v => Math.abs(n - v) >= separation - 0.01)) return n;
  // A full side packs its fan tighter, at `TIGHT_PITCH`, before it gives up on spacing.
  if (spread && !tight && TIGHT_PITCH < separation) {
    const pitch = TIGHT_PITCH,
      closer = [];
    for (let i = 1; i <= 16; i++)
      for (const sign of [1, -1]) if (i * pitch <= span / 2 + EPS) closer.push(sign * i * pitch);
    closer.sort((a, b) => Math.abs(a) - Math.abs(b) || (desired < 0 ? a - b : b - a));
    for (const n of closer) if (occupied.every(v => Math.abs(n - v) >= pitch - 0.01)) return n;
  }
  // Crowded small sides degrade to evenly-spaced choices. Overlap is reported.
  let best = 0,
    score = -1;
  for (let n = -span / 2; n <= span / 2; n += 2) {
    const d = Math.min(...occupied.map(v => Math.abs(n - v)));
    if (d > score) {
      score = d;
      best = n;
    }
  }
  return round(best);
}
const AXIS_PENALTY = 100,
  TRAILING = { right: 'right', down: 'bottom' },
  LEADING = { right: 'left', down: 'top' };
const HOOK_PENALTY = 80;
// Side conventions without a declared direction, and the price of a far side's loop per unit.
const ARRIVE_BELOW = 40,
  ARRIVE_RIGHT = 12,
  LEAVE_BACK = 12,
  DETOUR_WEIGHT = 0.5,
  // Per unit of a line's run inside a container that holds only one of its ends.
  LINGER_WEIGHT = 0.3;
/** Length of a route's axis-aligned segments that lies inside rectangle `r`. */
function insideLength(ps, r) {
  let n = 0;
  for (let i = 1; i < ps.length; i++) {
    const p = ps[i - 1],
      q = ps[i];
    if (Math.abs(p.y - q.y) < EPS) {
      if (p.y <= r.y || p.y >= r.y + r.h) continue;
      n += Math.max(0, Math.min(Math.max(p.x, q.x), r.x + r.w) - Math.max(Math.min(p.x, q.x), r.x));
    } else if (Math.abs(p.x - q.x) < EPS) {
      if (p.x <= r.x || p.x >= r.x + r.w) continue;
      n += Math.max(0, Math.min(Math.max(p.y, q.y), r.y + r.h) - Math.max(Math.min(p.y, q.y), r.y));
    }
  }
  return n;
}
// Fan siblings this far apart or more read as separate lines (the audit's `edges-too-close` is < 10).
const FAN_PITCH = 10;
// A detour round a group's title band longer than this many times the crossing route.
const DETOUR_RATIO = 1.75;
const pathLength = ps => segments(ps).reduce((n, [a, b]) => n + distance(a, b), 0);
const PORT_SLACK = 4;
const FAR_PENALTY = 100,
  OWN_STANDOFF = 1;
// Crossing pairs the repair pass tries before it stops, to bound its time on busy drawings. Each
// try routes up to four lines again (most of the router's time on a 30-box file). Across the
// quality corpus, held-out set and examples every repair that was kept came within the first four
// tries; later ones only cost time.
const MAX_REPAIRS = 4;
// Gate a group's header bands to the terminal lines of a route through a member's top.
function gate(obs, start, fs, end, ts) {
  if (!obs.some(r => r.gates)) return obs;
  const gates = [...(fs === 'top' ? [start.x] : []), ...(ts === 'top' ? [end.x] : [])];
  return obs.map(r => (r.gates ? { ...r, gates } : r));
}
function compute(input, rawOptions = {}) {
  const facingFans = rawOptions.facing !== false,
    titleBands = rawOptions.titleBands !== false;
  const began = Date.now(),
    s = settings(rawOptions),
    rects = new Map(input.nodes.map(n => [n.id, { ...n }])),
    groups = new Map((input.groups || []).map(g => [g.id, { ...g }]));
  for (const [id, g] of groups) if (g.collapsed) rects.set(id, { ...g, shape: 'box' });
  const all = new Map([...groups, ...rects]);
  const near = s.standoff
    ? [
        ...[...rects.values()].map(r => ({ ...r, band: s.standoff })),
        ...[...groups.values()]
          .filter(g => !g.collapsed)
          .map(g => ({ ...g, band: s.standoff, border: true, weight: BORDER_WEIGHT })),
      ]
    : [];
  function ancestors(id) {
    const list = [];
    for (let p = all.get(id)?.parentId; p; p = all.get(p)?.parentId) {
      if (list.includes(p)) break;
      list.push(p);
    }
    return list;
  }
  const previous = new Map((rawOptions.previous || []).map(r => [r.id, r]));
  const edges = input.edges
    .filter(e => rects.has(e.from) && rects.has(e.to))
    .map(e => ({ ...e, cfg: e.cfg || {} }));
  edges.sort((a, b) => {
    const locks = e =>
      (e.cfg.waypoints?.length ? 4 : 0) +
      (e.cfg.fromSide && e.cfg.fromSide !== 'auto' ? 1 : 0) +
      (e.cfg.toSide && e.cfg.toSide !== 'auto' ? 1 : 0);
    return (
      locks(b) - locks(a) ||
      distance(center(rects.get(a.from)), center(rects.get(a.to))) -
        distance(center(rects.get(b.from)), center(rects.get(b.to))) ||
      cmp(a.id, b.id)
    );
  });
  // Edges whose route took the title-band exception (`DETOUR_RATIO`): their bands are
  // crossable straight across anywhere, not only on a top member's terminal line.
  const openBands = new Set(),
    opened = new WeakSet(),
    syncOpen = () => {
      openBands.clear();
      for (const r of routes) if (opened.has(r)) openBands.add(r.id);
    };
  // How many edges have their other end beyond each side of a box: a fan that outgrows the
  // side's full-gap slots spreads at `TIGHT_PITCH` (`slot`'s `tight`).
  const facingCount = new Map(),
    // Whether `other`'s centre lies past side `side` of box `id`, mostly in that direction.
    beyond = (id, other, side) => {
      const r = rects.get(id),
        o = center(rects.get(other)),
        c = center(r),
        level = Math.abs(o.x - c.x) >= Math.abs(o.y - c.y);
      return {
        left: level && o.x < r.x,
        right: level && o.x > r.x + r.w,
        top: !level && o.y < r.y,
        bottom: !level && o.y > r.y + r.h,
      }[side];
    };
  // Only unlabelled fans out of a box: arrowheads into one side, and labels, need the full gap.
  for (const e of edges)
    if (e.from !== e.to && !e.label)
      for (const side of SIDES)
        if (beyond(e.from, e.to, side))
          facingCount.set(e.from + '|' + side, (facingCount.get(e.from + '|' + side) ?? 0) + 1);
  const crowdedSide = (id, side) => {
    const r = rects.get(id),
      span = (side === 'left' || side === 'right' ? r.h : r.w) - 24,
      gap = Math.max(s.portGap, s.edgeGap),
      slots = pitch => 1 + 2 * Math.floor(span / 2 / pitch + EPS),
      full = slots(gap);
    // Only when the tighter pitch makes room for more: otherwise the side is just full.
    return (
      facingFans &&
      (facingCount.get(id + '|' + side) ?? 0) > full &&
      slots(Math.min(TIGHT_PITCH, gap)) > full
    );
  };
  const obsFor = (e, open = openBands.has(e.id)) => {
    const allowed = new Set([...ancestors(e.from), ...ancestors(e.to)]),
      obstacles = [...rects.values()].map(r => inflate(r, s.clearance));
    for (const [id, g] of groups) {
      if (g.collapsed) continue;
      if (!allowed.has(id)) obstacles.push(inflate(g, s.clearance));
      else {
        // The title blocks the header band. Beside it, a line may cross the band
        // straight into the group but not run along it under the border.
        const title = Math.max(1, Math.min(g.w - 6, g.titleWidth ?? Infinity)),
          band = { y: g.y + 2, h: (g.titleHeight ?? 28) + s.clearance },
          lip = Math.max(s.clearance, s.standoff);
        obstacles.push({ id: id + ':header', x: g.x + 3, w: title, ...band });
        if (titleBands)
          // The whole band, from a clearance above the border, is crossed only by a line
          // straight into or out of a member's top: never run along or through.
          obstacles.push({
            id: id + ':header-band',
            x: g.x - lip,
            w: g.w + 2 * lip,
            y: g.y - lip,
            h: band.y + band.h - g.y + lip,
            across: true,
            ...(open ? {} : { gates: [] }),
          });
        else if (title < g.w - 6)
          obstacles.push({
            id: id + ':header-band',
            x: g.x + 3 + title,
            w: g.w - 6 - title,
            ...band,
            across: true,
          });
      }
    }
    const common = ancestors(e.from).find(id => ancestors(e.to).includes(id));
    const g = groups.get(common);
    if (g) {
      const wall = 2000000;
      obstacles.push(
        { id: 'wall-l', x: g.x - wall, y: g.y - wall, w: wall, h: 2 * wall },
        { id: 'wall-r', x: g.x + g.w, y: g.y - wall, w: wall, h: 2 * wall },
        { id: 'wall-t', x: g.x, y: g.y - wall, w: g.w, h: wall },
        { id: 'wall-b', x: g.x, y: g.y + g.h, w: g.w, h: wall },
      );
    }
    return obstacles;
  };
  function validPath(points, e, fs, ts, obs) {
    if (points.length < 2) return false;
    obs = gate(obs, points[0], fs, points.at(-1), ts);
    const start = points[0],
      next = points[1],
      end = points.at(-1),
      prev = points.at(-2),
      v = vector[fs],
      w = vector[ts];
    if (
      v.x * (next.x - start.x) + v.y * (next.y - start.y) <= EPS ||
      w.x * (prev.x - end.x) + w.y * (prev.y - end.y) <= EPS
    )
      return false;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
      const obstacles = obs.filter(
        r => !(i === 1 && r.id === e.from) && !(i === points.length - 1 && r.id === e.to),
      );
      if (blocked(a, b, obstacles)) return false;
      if (i >= 2) {
        const c = points[i - 2];
        if ((b.x - a.x) * (a.x - c.x) + (b.y - a.y) * (a.y - c.y) < -EPS) return false;
      }
    }
    return true;
  }
  function simplify(points, e, fs, ts, obs, used) {
    if (e.cfg.waypoints?.length) return points;
    let result = compress(points),
      bestCost = cost(result, used, s, near);
    // Replacing a subpath removes staircase artefacts only if the complete path
    // remains obstacle-safe, respects terminal normals, and does not add a lane
    // conflict or crossing. This is geometric simplification, not SVG cosmetics.
    for (let sweep = 0; sweep < 4; sweep++) {
      let improved = false;
      const before = conflicts(result, used),
        beforeLane = parallelConflicts(result, used, s.edgeGap);
      outer: for (let span = result.length - 1; span >= 2; span--)
        for (let i = 0; i + span < result.length; i++) {
          const j = i + span,
            a = result[i],
            b = result[j];
          for (const mid of [[{ x: a.x, y: b.y }], [{ x: b.x, y: a.y }], []]) {
            const p = compress([...result.slice(0, i + 1), ...mid, ...result.slice(j)]);
            if (p.length >= result.length || !validPath(p, e, fs, ts, obs)) continue;
            const c = conflicts(p, used),
              lane = parallelConflicts(p, used, s.edgeGap),
              score = cost(p, used, s, near);
            if (
              c.crossings > before.crossings ||
              lane.laneDeficit > beforeLane.laneDeficit + 0.1 ||
              score >= bestCost - 0.01
            )
              continue;
            result = p;
            bestCost = score;
            improved = true;
            break outer;
          }
        }
      if (!improved) break;
    }
    return result;
  }
  // A line may cross a title band straight into any member, not only a top one, when the
  // way round the group is over `DETOUR_RATIO` times the length of the crossing route.
  function find(e, used, old, wall = []) {
    const gated = findIn(e, used, old, false, wall);
    if (!titleBands || !obsFor(e, false).some(r => r.gates)) return gated;
    const a = rects.get(e.from),
      b = rects.get(e.to),
      ca = center(a),
      cb = center(b),
      // No route between the boxes is shorter than the gap between them.
      floor =
        Math.max(0, Math.abs(ca.x - cb.x) - (a.w + b.w) / 2) +
        Math.max(0, Math.abs(ca.y - cb.y) - (a.h + b.h) / 2),
      gatedLength = gated.blocked ? Infinity : pathLength(gated.points);
    if (gatedLength <= DETOUR_RATIO * floor) return gated;
    const open = findIn(e, used, old, true, wall);
    if (open.blocked || gatedLength <= DETOUR_RATIO * pathLength(open.points)) return gated;
    opened.add(open);
    return open;
  }
  function findIn(e, used, old, open, wall = []) {
    const a = rects.get(e.from),
      b = rects.get(e.to),
      cfg = e.cfg,
      edgeObs = wall.length ? [...obsFor(e, open), ...wall] : obsFor(e, open),
      ca = center(a),
      cb = center(b);
    const from =
        cfg.fromSide && cfg.fromSide !== 'auto'
          ? [cfg.fromSide]
          : rawOptions.quick && old
            ? [old.fromSide]
            : SIDES,
      to =
        cfg.toSide && cfg.toSide !== 'auto'
          ? [cfg.toSide]
          : rawOptions.quick && old
            ? [old.toSide]
            : SIDES;
    // A forward edge in a layout with a declared reading direction leaves its source's
    // trailing side and enters its target's leading side (bottom → top going down), so
    // it reads as parent → child. Other sides cost `AXIS_PENALTY` each, more than the
    // standoff or fan-out a clean Z pays, so they win only when the axis sides are blocked.
    const flow = [cfg.flow, rawOptions.direction].find(d => d === 'right' || d === 'down');
    const along = flow === 'down' ? cb.y - ca.y : cb.x - ca.x,
      forward = flow && e.from !== e.to && along > 20,
      axis = c =>
        forward
          ? (c.fs !== TRAILING[flow] ? AXIS_PENALTY : 0) +
            (c.ts !== LEADING[flow] ? AXIS_PENALTY : 0)
          : 0,
      onAxis = (side, end) => forward && side === (end === 'from' ? TRAILING : LEADING)[flow];
    const candidates = [];
    let best = null;
    // A line that leaves a box and turns to run alongside it, just past the stub, reads as
    // hugging its own box. Runs beside the edge's own ends pay the standoff again.
    const own = facingFans ? near.filter(r => !r.border && (r.id === e.from || r.id === e.to)) : [];
    // Ports already on side `side` of node `id`, from this edge's end of the fan.
    const taken = (id, side, end) =>
      used.filter(r => r[end] === id && r[end + 'Side'] === side).length;
    // A side faces the other end when it points toward it. A fan spreads along a
    // facing side for free until the side runs out of port slots (`slot` spacing),
    // and only then pays the fan-out penalty that pushes it round to another side.
    const facing = (side, from, to) =>
      vector[side].x * (to.x - from.x) + vector[side].y * (to.y - from.y) > 0.01;
    // A facing side holds its fan at `TIGHT_PITCH` once full spacing runs out.
    const roomy = (side, r, n) => {
      const span = (side === 'left' || side === 'right' ? r.h : r.w) - 24,
        pitch = facingFans
          ? Math.min(TIGHT_PITCH, Math.max(s.portGap, s.edgeGap))
          : Math.max(s.portGap, s.edgeGap);
      return n < 1 + 2 * Math.floor(span / 2 / pitch + EPS);
    };
    function fan(side, r, from, to, end, id) {
      const n = taken(id, side, end);
      if (!n || (end === 'from' ? onAxis(side, 'from') : onAxis(side, 'to'))) return 0;
      if (facingFans && facing(side, from, to) && roomy(side, r, n)) return 0;
      return n * s.fanoutPenalty;
    }
    // Route length beyond the gap between the two boxes, which no route can avoid.
    const floor =
      Math.max(0, Math.abs(ca.x - cb.x) - (a.w + b.w) / 2) +
      Math.max(0, Math.abs(ca.y - cb.y) - (a.h + b.h) / 2);
    const excess = points => Math.max(0, pathLength(points) - floor);
    // Containers that hold one end but not the other: the line should leave (or enter) them by
    // the short way and run outside, not along their inside to reach something beyond.
    const passing = facingFans
      ? [
          ...ancestors(e.from)
            .filter(g => !ancestors(e.to).includes(g))
            .map(g => ({ g: groups.get(g), box: a })),
          ...ancestors(e.to)
            .filter(g => !ancestors(e.from).includes(g))
            .map(g => ({ g: groups.get(g), box: b })),
        ].filter(p => p.g && !p.g.collapsed)
      : [];
    // Run inside each such container beyond the shortest way between the box and its border.
    const lingering = points =>
      passing.reduce((sum, { g, box }) => {
        const shortest = Math.min(
          box.x - g.x,
          g.x + g.w - (box.x + box.w),
          box.y - g.y,
          g.y + g.h - (box.y + box.h),
        );
        return sum + Math.max(0, insideLength(points, g) - Math.max(0, shortest));
      }, 0);
    function score(points, c) {
      const v = vector[c.fs],
        w = vector[c.ts],
        delta = { x: cb.x - ca.x, y: cb.y - ca.y };
      // Leaving or arriving by a far side (one that points away from the other end)
      // draws a hook round the box; it is worth a detour only when the facing sides
      // are blocked.
      const far = facingFans ? FAR_PENALTY : 18;
      const awayOut = v.x * delta.x + v.y * delta.y < -0.01,
        awayIn = w.x * -delta.x + w.y * -delta.y < -0.01;
      // A far side also pays for the loop it draws: the length beyond the shortest way between
      // the boxes, so a line into a box's back from round the far side of a group loses to a
      // crossing (NEXT.md item 1).
      // Only a side the router chose pays it; a side the file fixed is the author's call.
      const detour =
        facingFans && ((awayOut && from.length > 1) || (awayIn && to.length > 1))
          ? DETOUR_WEIGHT * excess(points)
          : 0;
      const backwards = (awayOut ? far : 0) + (awayIn ? far : 0) + detour;
      // Diagrams read left to right and top to bottom: lines arrive on a box's left or top and
      // leave by its right or bottom. Arriving from below costs most; it reads as backwards.
      const convention = facingFans
        ? (c.ts === 'bottom' ? ARRIVE_BELOW : 0) +
          (c.ts === 'right' ? ARRIVE_RIGHT : 0) +
          (c.fs === 'top' || c.fs === 'left' ? LEAVE_BACK : 0)
        : 0;
      const stability = old
        ? (c.fs !== old.fromSide ? s.portStability : 0) +
          (c.ts !== old.toSide ? s.portStability : 0)
        : 0;
      const fanout = fan(c.fs, a, ca, cb, 'from', e.from) + fan(c.ts, b, cb, ca, 'to', e.to);
      // Out of one side and back into the same side of the other end: a U-turn, which a line
      // into a perpendicular side draws with one bend fewer.
      const hook = facingFans && c.fs === c.ts && points.length > 3 ? HOOK_PENALTY : 0;
      // A fan planned at `TIGHT_PITCH` keeps to its side: leaving by another side costs, and
      // the close pitch to its siblings there is the plan, not a lane conflict.
      let packed = 0;
      for (const [end, id, other, side] of facingFans
        ? [
            ['from', e.from, e.to, c.fs],
            ['to', e.to, e.from, c.ts],
          ]
        : []) {
        if (id === other) continue;
        const siblings = used.filter(q => q[end] === id && q[end + 'Side'] === side);
        const want =
          end === 'from' && !e.label
            ? SIDES.filter(x => crowdedSide(id, x) && beyond(id, other, x))
            : [];
        if (want.length && !want.includes(side)) packed += 2 * s.fanoutPenalty;
        // Lines fanning out of (or into) one side nest in the gap beside it. Siblings closer than
        // the edge gap but still apart (`FAN_PITCH`) are the fan's shape, not a lane conflict:
        // charging them pushed a tree's third child out of its parent's side. A fan planned at
        // `TIGHT_PITCH` is that close by design.
        packed -=
          siblingDeficit(points, siblings, want.includes(side) ? 0 : FAN_PITCH, s.edgeGap) *
          s.parallelPenalty;
      }
      return (
        LINGER_WEIGHT * lingering(points) +
        packed +
        cost(points, used, s, near) +
        (own.length ? standoffCost(points, own) * OWN_STANDOFF : 0) +
        backwards +
        convention +
        hook +
        stability +
        fanout +
        axis(c)
      );
    }
    const remember = (points, c, o = c.obs) => {
      if (!points) return;
      const full = compress([c.start, ...points, c.end]);
      for (let i = 2; i < full.length; i++) {
        const a = full[i - 2],
          b = full[i - 1],
          d = full[i];
        if (
          ((Math.abs(a.x - b.x) < EPS && Math.abs(b.x - d.x) < EPS) ||
            (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - d.y) < EPS)) &&
          (b.x - a.x) * (d.x - b.x) + (b.y - a.y) * (d.y - b.y) < -0.001
        )
          return;
      }

      // No doubled-back first/last segments after attaching shape stubs.
      if (
        full.length < 2 ||
        segments(full).some(([u, v], i) => i > 0 && i < full.length - 2 && blocked(u, v, o))
      )
        return;
      const scoreValue = score(full, c);
      if (!best || scoreValue < best.score - 0.01) best = { ...c, points: full, score: scoreValue };
    };
    // A diamond's ports sit on its four vertices, one edge each; a further edge goes to a free
    // vertex. Only when all four are taken do they share.
    const vertices = r => facingFans && r.shape === 'diamond',
      vertexTaken = (id, side) =>
        used.some(
          q => (q.from === id && q.fromSide === side) || (q.to === id && q.toSide === side),
        ),
      vertexClosed = (r, id, side, sides) =>
        vertices(r) &&
        sides.length > 1 &&
        vertexTaken(id, side) &&
        sides.some(x => !vertexTaken(id, x));
    for (const fs of from)
      for (const ts of to) {
        if (e.from === e.to && fs === ts) continue;
        if (vertexClosed(a, e.from, fs, from) || vertexClosed(b, e.to, ts, to)) continue;
        let fo = vertices(a)
            ? 0
            : slot(e.from, fs, a, used, s, b, !e.label && crowdedSide(e.from, fs), facingFans),
          toff = vertices(b) ? 0 : slot(e.to, ts, b, used, s, a, false, facingFans);
        const sameAxis = (fs === 'left' || fs === 'right') === (ts === 'left' || ts === 'right');
        if (sameAxis && e.from !== e.to && !vertices(b)) {
          const vertical = fs === 'left' || fs === 'right',
            axis = vertical ? 'y' : 'x',
            limit = (vertical ? b.h : b.w) / 2 - 12;
          const desired = port(a, fs, fo)[axis] - center(b)[axis];
          const taken = used.flatMap(q => [
            ...(q.from === e.to && q.fromSide === ts ? [q.fromOffset] : []),
            ...(q.to === e.to && q.toSide === ts ? [q.toOffset] : []),
          ]);
          if (
            Math.abs(desired) <= limit &&
            taken.every(v => Math.abs(desired - v) >= Math.max(s.portGap, s.edgeGap) - 0.01)
          )
            toff = desired;
        }
        // A lane may say where along the target's side the edge arrives.
        if (typeof cfg.toOffset === 'number' && cfg.toSide === ts && !vertices(b))
          toff = cfg.toOffset;
        const start = port(a, fs, fo),
          end = port(b, ts, toff),
          obs = gate(edgeObs, start, fs, end, ts);
        // Stacked neighbours closer than two stubs: meet halfway across the gap
        // between the facing sides instead of hooking round the outside.
        const gap = s.standoff
            ? {
                right: b.x - a.x - a.w,
                left: a.x - b.x - b.w,
                bottom: b.y - a.y - a.h,
                top: a.y - b.y - b.h,
              }[fs]
            : 0,
          tight =
            vector[fs].x === -vector[ts].x &&
            vector[fs].y === -vector[ts].y &&
            gap > 0 &&
            gap < 2 * (s.clearance + 3),
          stub = tight ? gap / 2 : s.clearance + 3,
          ends = tight ? obs.filter(r => r.id !== e.from && r.id !== e.to) : null;
        // A diamond's vertex is a point, so a stub turning a clearance out runs along the
        // diamond's corners. It leaves a full standoff out where there is room.
        const stubAt = (r, side, p, n) => ({
            x: round(side === 'left' ? r.x - n : side === 'right' ? r.x + r.w + n : p.x),
            y: round(side === 'top' ? r.y - n : side === 'bottom' ? r.y + r.h + n : p.y),
          }),
          clearOf = (p, q, id) => !blocked(p, q, ends || obs.filter(r => r.id !== id)),
          long = Math.max(stub, s.standoff);
        let as = stubAt(a, fs, start, stub),
          bs = stubAt(b, ts, end, stub);
        if (!clearOf(start, as, e.from) || !clearOf(end, bs, e.to)) continue;
        if (!tight && vertices(a) && long > stub) {
          const far = stubAt(a, fs, start, long);
          if (clearOf(start, far, e.from)) as = far;
        }
        if (!tight && vertices(b) && long > stub) {
          const far = stubAt(b, ts, end, long);
          if (clearOf(end, far, e.to)) bs = far;
        }
        const c = { fs, ts, fo, toff, start, end, as, bs, obs };
        if (tight) {
          if (cfg.waypoints?.length) continue;
          const o = [...ends, { ...a, id: e.from }, { ...b, id: e.to }];
          for (const path of doglegs(as, bs, o, s, used, near)) remember(path, c, o);
          continue;
        }
        // Through any waypoints, so a side facing away from the first one ranks last.
        const via = [start, ...(cfg.waypoints || []), end];
        c.lower =
          via.reduce((sum, p, i) => (i ? sum + distance(via[i - 1], p) : 0), 0) +
          axis(c) +
          (old && fs !== old.fromSide ? s.portStability : 0) +
          (old && ts !== old.toSide ? s.portStability : 0);
        candidates.push(c);
        if (cfg.waypoints?.length) continue;
        // Preserve genuinely straight facing connections even when two 13px
        // stubs would overlap inside a narrow but valid inter-node gap.
        const v = vector[fs],
          w = vector[ts],
          dx = end.x - start.x,
          dy = end.y - start.y;
        if (
          (start.x === end.x || start.y === end.y) &&
          v.x * dx + v.y * dy > 0 &&
          w.x * -dx + w.y * -dy > 0 &&
          !blocked(
            start,
            end,
            obs.filter(r => r.id !== e.from && r.id !== e.to),
          )
        )
          remember([start, end], c);
        for (const path of doglegs(as, bs, obs, s, used, near)) remember(path, c);
      }
    candidates.sort((a, b) => a.lower - b.lower || cmp(a.fs + ':' + a.ts, b.fs + ':' + b.ts));
    // Search is reserved for candidates whose lower bound can beat the best.
    // Dragging keeps this bounded; settled diagrams receive refinement passes.
    let searches = 0;
    for (const c of candidates) {
      if (best && c.lower > best.score) continue;
      if (searches++ >= (rawOptions.quick ? 1 : 3)) break;
      if (
        best &&
        !conflicts(best.points, used).crossings &&
        !parallelConflicts(best.points, used, s.edgeGap).lanePairs &&
        !cfg.waypoints?.length &&
        best.points.length <= 6
      )
        break;
      const points = [c.as, ...(cfg.waypoints || []), c.bs],
        path = [];
      let ok = true;
      for (let i = 1; i < points.length; i++) {
        const p = points[i - 1],
          q = points[i];
        // Crossing and standoff costs dwarf the distance heuristic, so an open search floods most
        // of the grid. It searches the two boxes' span plus a margin first, and widens only when
        // that fails.
        const span = {
            x0: Math.min(a.x, b.x, p.x, q.x),
            y0: Math.min(a.y, b.y, p.y, q.y),
            x1: Math.max(a.x + a.w, b.x + b.w, p.x, q.x),
            y1: Math.max(a.y + a.h, b.y + b.h, p.y, q.y),
          },
          grow = (r, m) => ({ x0: r.x0 - m, y0: r.y0 - m, x1: r.x1 + m, y1: r.y1 + m });
        let part = null;
        for (const m of rawOptions.window === false ? [null] : WINDOWS) {
          const win = m === null ? null : grow(span, m);
          // The standoff makes some searches wander; it gets a larger budget.
          part = search(p, q, c.obs, used, s, near, near.length ? 64000 : 16000, win);
          if (part) break;
        }
        if (!part) {
          ok = false;
          break;
        }
        path.push(...part);
      }
      if (ok) remember(path, c);
    }
    if (!best && rawOptions.quick && old) return findIn(e, used, null, open, wall);
    if (!best) {
      const fs = from[0],
        ts = to[0],
        start = port(a, fs),
        end = port(b, ts);
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        fromSide: fs,
        toSide: ts,
        fromOffset: 0,
        toOffset: 0,
        points: compress([start, { x: end.x, y: start.y }, end]),
        blocked: true,
        reason: 'No clear route within the search budget and current side / waypoint constraints.',
      };
    }
    best.points = simplify(best.points, e, best.fs, best.ts, edgeObs, used);
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      fromSide: best.fs,
      toSide: best.ts,
      fromOffset: best.fo,
      toOffset: best.toff,
      points: best.points,
      blocked: false,
    };
  }
  let routes = [];
  for (const e of edges) routes.push(find(e, routes, previous.get(e.id)));
  syncOpen();
  const metrics = rs => {
    let crossings = 0,
      shared = 0,
      lanePairs = 0,
      laneDeficit = 0,
      minGap = Infinity;
    for (let i = 0; i < rs.length; i++) {
      const used = rs.slice(0, i),
        c = conflicts(rs[i].points, used),
        p = parallelConflicts(rs[i].points, used, s.edgeGap);
      crossings += c.crossings;
      shared += c.shared;
      lanePairs += p.lanePairs;
      laneDeficit += p.laneDeficit;
      if (p.minGap !== null) minGap = Math.min(minGap, p.minGap);
    }
    return {
      crossings,
      shared: round(shared),
      lanePairs,
      laneDeficit: round(laneDeficit),
      minimumConflictingGap: Number.isFinite(minGap) ? round(minGap) : null,
      requestedEdgeGap: s.edgeGap,
      blocked: rs.filter(r => r.blocked).length,
      bends: rs.reduce((n, r) => n + Math.max(0, r.points.length - 2), 0),
      length: round(
        rs.reduce((n, r) => n + segments(r.points).reduce((v, [a, b]) => v + distance(a, b), 0), 0),
      ),
    };
  };
  const total = rs => {
    const m = metrics(rs);
    return (
      m.blocked * 1e8 +
      m.length +
      m.bends * s.bendPenalty +
      m.crossings * s.crossingPenalty +
      m.shared * s.sharedPenalty +
      m.laneDeficit * s.parallelPenalty
    );
  };
  const before = metrics(routes);
  // A route that leaves or enters by a side pointing away from its other end took the long way
  // round, often because the facing side was full when it was routed. Edges routed later may
  // have moved off since, so the improvement passes try it again.
  const far = r => {
    if (r.from === r.to) return false;
    const ca = center(rects.get(r.from)),
      cb = center(rects.get(r.to)),
      v = vector[r.fromSide],
      w = vector[r.toSide];
    return (
      v.x * (cb.x - ca.x) + v.y * (cb.y - ca.y) < -0.01 ||
      w.x * (ca.x - cb.x) + w.y * (ca.y - cb.y) < -0.01
    );
  };
  let accepted = 0;
  if (!rawOptions.quick)
    for (let pass = 1; pass < s.passes; pass++) {
      const currentMetrics = metrics(routes);
      if (
        !currentMetrics.crossings &&
        !currentMetrics.shared &&
        !currentMetrics.blocked &&
        !currentMetrics.lanePairs &&
        !routes.some(far)
      )
        break;
      const order = [...edges].sort((a, b) => {
        const ra = routes.find(r => r.id === a.id),
          rb = routes.find(r => r.id === b.id);
        return (
          Number(rb.blocked) - Number(ra.blocked) ||
          conflicts(
            rb.points,
            routes.filter(r => r !== rb),
          ).crossings -
            conflicts(
              ra.points,
              routes.filter(r => r !== ra),
            ).crossings ||
          cmp(a.id, b.id)
        );
      });
      for (const e of order) {
        const i = routes.findIndex(r => r.id === e.id),
          used = routes.filter((_, j) => j !== i),
          c = conflicts(routes[i].points, used);
        if (
          !routes[i].blocked &&
          !c.crossings &&
          !c.shared &&
          !parallelConflicts(routes[i].points, used, s.edgeGap).lanePairs &&
          !far(routes[i])
        )
          continue;
        const next = find(e, used, routes[i]),
          candidate = [...routes];
        candidate[i] = next;
        if (total(candidate) < total(routes) - 0.1) {
          routes = candidate;
          syncOpen();
          accepted++;
        }
      }
    }
  // Edges are routed one at a time, so a crossing priced when the later edge was routed is never
  // repaired: moving either line alone costs more than the crossing. Try each crossing pair
  // together: route one with the other's line as a wall, then the other round it, and keep the
  // pair when the drawing as a whole costs less (NEXT.md item 9, R6).
  let repaired = 0;
  if (!rawOptions.quick && facingFans) {
    // A repair buys its crossing with length or bends, never with a line that reads backwards:
    // into a box from below, out of or into a far side, or a U-turn (FEEL.md: never arrive from
    // below; a loop round the outside is worse than one crossing).
    const backwards = r =>
      r.toSide === 'bottom' || far(r) || (r.fromSide === r.toSide && r.points.length > 3);
    // Lines along a box or a group border cost here as they do when routed.
    const value = rs => total(rs) + rs.reduce((n, r) => n + standoffCost(r.points, near), 0);
    // A route as a wall: each segment a sliver half a lane wide each way. Segments at an end the
    // two edges share stay open, so a fan off one side can still leave beside it.
    const wallOf = (r, e) => {
      const ends = new Set([e.from, e.to]),
        segs = segments(r.points);
      return segs
        .filter(
          (_, k) => !(k === 0 && ends.has(r.from)) && !(k === segs.length - 1 && ends.has(r.to)),
        )
        .map(([a, b]) =>
          inflate(
            {
              x: Math.min(a.x, b.x),
              y: Math.min(a.y, b.y),
              w: Math.abs(a.x - b.x),
              h: Math.abs(a.y - b.y),
            },
            s.edgeGap / 2,
          ),
        );
    };
    const byId = new Map(edges.map(e => [e.id, e])),
      fixed = e => e.cfg.waypoints?.length > 0;
    const tried = new Set();
    for (let sweep = 0; sweep < 2; sweep++) {
      let changed = false;
      for (let i = 0; i < routes.length; i++)
        for (let j = i + 1; j < routes.length; j++) {
          if (!conflicts(routes[i].points, [routes[j]]).crossings) continue;
          const key = routes[i].id + '|' + routes[j].id;
          if (tried.has(key) || tried.size >= MAX_REPAIRS) continue;
          tried.add(key);
          let best = null,
            bestValue = value(routes) - 0.1;
          for (const [m, k] of [
            [i, j],
            [j, i],
          ]) {
            const em = byId.get(routes[m].id),
              ek = byId.get(routes[k].id);
            if (fixed(em)) continue;
            const rest = routes.filter((_, q) => q !== m && q !== k),
              tries = [],
              moved = find(em, [...rest, routes[k]], routes[m], wallOf(routes[k], em));
            if (!moved.blocked) {
              const one = [...routes];
              one[m] = moved;
              tries.push(one);
              if (!fixed(ek)) {
                const two = [...one];
                two[k] = find(ek, [...rest, moved], routes[k]);
                tries.push(two);
              }
            }
            // Or in the other order: `k` first, as if `m` were not there, then `m` round it.
            if (!fixed(ek)) {
              const first = find(ek, rest, routes[k]),
                then = find(em, [...rest, first], routes[m], wallOf(first, em));
              if (!then.blocked) {
                const swap = [...routes];
                swap[k] = first;
                swap[m] = then;
                tries.push(swap);
              }
            }
            for (const t of tries) {
              if (
                t.some((r, q) => r !== routes[q] && backwards(r) && !backwards(routes[q])) ||
                metrics(t).crossings >= metrics(routes).crossings
              )
                continue;
              const v = value(t);
              if (v < bestValue) {
                best = t;
                bestValue = v;
              }
            }
          }
          if (best) {
            routes = best;
            syncOpen();
            repaired++;
            changed = true;
          }
        }
      if (!changed) break;
    }
  }
  // Slide complete internal orthogonal segments into nearby free channels.
  // Endpoints, sides, node coordinates and authored waypoint routes stay fixed.
  let nudged = 0;
  if (!rawOptions.quick)
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let ri = 0; ri < routes.length; ri++) {
        const route = routes[ri],
          e = edges.find(e => e.id === route.id);
        if (route.blocked || e.cfg.waypoints?.length) continue;
        const used = routes.filter((_, j) => j !== ri),
          obs = obsFor(e);
        if (!parallelConflicts(route.points, used, s.edgeGap).lanePairs) continue;
        let best = route.points,
          bestValue = cost(best, used, s, near),
          before = conflicts(best, used);
        for (let i = 1; i < route.points.length - 2; i++) {
          const a = route.points[i],
            b = route.points[i + 1],
            h = Math.abs(a.y - b.y) < EPS,
            axis = h ? 'y' : 'x';
          const choices = new Set();
          for (const other of used)
            for (const [c, d] of segments(other.points)) {
              if (Math.abs(c.y - d.y) < EPS !== h) continue;
              if (parallelNear(a, b, c, d, s.edgeGap * 2)) {
                choices.add(round(c[axis] + s.edgeGap));
                choices.add(round(c[axis] - s.edgeGap));
              }
            }
          for (const value of choices) {
            const p = clone(route.points);
            p[i][axis] = value;
            p[i + 1][axis] = value;
            const clean = compress(p);
            if (
              !validPath(clean, e, route.fromSide, route.toSide, obs) ||
              conflicts(clean, used).crossings > before.crossings
            )
              continue;
            const score = cost(clean, used, s, near);
            if (score < bestValue - 0.1) {
              best = clean;
              bestValue = score;
            }
          }
        }
        if (best !== route.points) {
          routes[ri] = {
            ...route,
            points: simplify(best, e, route.fromSide, route.toSide, obs, used),
          };
          changed = true;
          nudged++;
        }
      }
      if (!changed) break;
    }
  // Tidy: make routes look drafted on purpose. Ports on a side sit symmetrically
  // about its centre, edges fanning from one side turn on one line, and parallel
  // runs in a corridor keep one pitch. A move stands only when every moved route
  // stays valid and nothing gets worse: no crossing, shared run, lane conflict,
  // short step or standoff cost is added.
  const tidyOn = !rawOptions.quick && rawOptions.tidy !== false;
  let tidied = 0;
  if (tidyOn) {
    const byId = new Map(edges.map(e => [e.id, e])),
      obsCache = new Map(),
      obsOf = e => {
        if (!obsCache.has(e.id)) obsCache.set(e.id, obsFor(e));
        return obsCache.get(e.id);
      },
      steps = ps =>
        segments(ps)
          .slice(1, -1)
          .filter(([a, b]) => distance(a, b) < 12).length;
    // Whether `p` lies on the polyline `ps`.
    const onPath = (p, ps) =>
      segments(ps).some(
        ([a, b]) =>
          (Math.abs(a.x - b.x) < EPS &&
            Math.abs(p.x - a.x) < EPS &&
            p.y > Math.min(a.y, b.y) - EPS &&
            p.y < Math.max(a.y, b.y) + EPS) ||
          (Math.abs(a.y - b.y) < EPS &&
            Math.abs(p.y - a.y) < EPS &&
            p.x > Math.min(a.x, b.x) - EPS &&
            p.x < Math.max(a.x, b.x) + EPS),
      );
    // `throughWaypoints` lets a waypoint route change when it still passes every waypoint.
    // Runs alongside a box side, outside it and closer than a stub (clearance + 3), for longer
    // than a port gap.
    const boxes = [...rects.values()],
      hugs = ps => {
        let n = 0;
        for (const [a, b] of segments(ps)) {
          const h = Math.abs(a.y - b.y) < EPS;
          if (!h && Math.abs(a.x - b.x) >= EPS) continue;
          const at = h ? a.y : a.x,
            lo = h ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
            hi = h ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
          for (const r of boxes) {
            const s0 = h ? r.y : r.x,
              s1 = h ? r.y + r.h : r.x + r.w,
              run = Math.min(hi, h ? r.x + r.w : r.y + r.h) - Math.max(lo, h ? r.x : r.y),
              d = at < s0 ? s0 - at : at > s1 ? at - s1 : -1;
            if (run > s.portGap && d > EPS && d < s.clearance + 5) n++;
          }
        }
        return n;
      };
    const attempt = (changes, extra = {}, throughWaypoints = false, slack = 0.5) => {
      const next = routes.map((r, i) =>
        changes.has(i) ? { ...r, ...extra[i], points: compress(changes.get(i)) } : r,
      );
      for (const i of changes.keys()) {
        const r = next[i],
          e = byId.get(r.id),
          waypoints = e.cfg.waypoints || [];
        // Waypoint routes stay as authored, as in the nudge pass.
        if (waypoints.length && !(throughWaypoints && waypoints.every(p => onPath(p, r.points))))
          return false;
        if (!validPath(r.points, e, r.fromSide, r.toSide, obsOf(e))) return false;
        if (steps(r.points) > steps(routes[i].points)) return false;
      }
      const m0 = metrics(routes),
        m1 = metrics(next);
      if (
        m1.crossings > m0.crossings ||
        m1.shared > m0.shared + 0.01 ||
        m1.lanePairs > m0.lanePairs ||
        m1.laneDeficit > m0.laneDeficit + 0.1
      )
        return false;
      let before = 0,
        after = 0;
      for (const i of changes.keys()) {
        before += standoffCost(routes[i].points, near);
        after += standoffCost(next[i].points, near);
      }
      if (after > before + slack) return false;
      // Slack never buys a new hug: a run closer than a stub's length to a box beside it.
      if (slack > 0.5) {
        let h0 = 0,
          h1 = 0;
        for (const i of changes.keys()) {
          h0 += hugs(routes[i].points);
          h1 += hugs(next[i].points);
        }
        if (h1 > h0) return false;
      }
      routes = next;
      tidied++;
      return true;
    };
    const flat = r => !['pill', 'circle', 'diamond', 'icon'].includes(r.shape),
      ends = ['from', 'to'],
      tip = (ps, end, k = 0) => (end === 'from' ? ps[k] : ps[ps.length - 1 - k]);

    // Ports: shift a side's ports so their mean sits on the side's centre.
    const sides = new Map();
    routes.forEach((r, i) => {
      for (const end of ends) {
        const key = r[end] + '|' + r[end + 'Side'];
        if (!sides.has(key)) sides.set(key, []);
        sides.get(key).push({ i, end });
      }
    });
    for (const [key, list] of sides) {
      const [id, side] = key.split('|'),
        rect = rects.get(id),
        vertical = side === 'left' || side === 'right',
        axis = vertical ? 'y' : 'x',
        mid = center(rect)[axis],
        limit = (vertical ? rect.h : rect.w) / 2 - 10,
        at = [...new Set(list.map(({ i, end }) => round(tip(routes[i].points, end)[axis])))];
      // Diamonds and round shapes keep their ports on the tips.
      if (at.length < 2 || !flat(rect)) continue;
      const d = round(mid - at.reduce((n, v) => n + v, 0) / at.length);
      if (Math.abs(d) < 2 || at.some(v => Math.abs(v + d - mid) > limit + EPS)) continue;
      const changes = new Map(),
        extra = {};
      for (const { i, end } of list) {
        const ps = clone(changes.get(i) ?? routes[i].points),
          offset = round(tip(ps, end)[axis] + d - mid),
          moved = port(rect, side, offset);
        Object.assign(tip(ps, end), moved);
        extra[i] = { ...extra[i], [end + 'Offset']: offset };
        if (ps.length === 2) {
          // A straight route slides as a whole, moving its other port too.
          const other = end === 'from' ? 'to' : 'from',
            far = rects.get(routes[i][other]),
            otherOffset = round(tip(ps, other)[axis] + d - center(far)[axis]);
          if (!flat(far)) {
            changes.clear();
            break;
          }
          Object.assign(tip(ps, other), port(far, routes[i][other + 'Side'], otherOffset));
          extra[i][other + 'Offset'] = otherOffset;
        } else tip(ps, end, 1)[axis] = moved[axis];
        changes.set(i, ps);
      }
      if (!changes.size) continue;
      // A line that turns in beside the side runs alongside it a stub away; the shift can
      // lengthen that run into a hug. Turn a full standoff out instead, where the line allows.
      const across = vertical ? 'x' : 'y',
        face = { left: rect.x, right: rect.x + rect.w, top: rect.y, bottom: rect.y + rect.h }[side],
        out = side === 'left' || side === 'top' ? -1 : 1,
        wide = new Map(
          [...changes].map(([i, ps]) => {
            const end = list.find(l => l.i === i).end,
              q = clone(ps);
            if (
              q.length >= 4 &&
              Math.abs(tip(q, end, 1)[across] - tip(q, end, 2)[across]) < EPS &&
              Math.abs(tip(q, end, 1)[across] - face) < s.standoff
            ) {
              tip(q, end, 1)[across] = face + out * s.standoff;
              tip(q, end, 2)[across] = face + out * s.standoff;
            }
            return [i, q];
          }),
        );
      // Centring a side is worth a little standoff: a port gap's shift barely moves a line.
      const slack = PORT_SLACK * changes.size;
      if (!attempt(wide, extra, false, slack)) attempt(changes, extra, false, slack);
    }

    // Fans: edges leaving (or entering) one side turn on a shared line.
    const fans = new Map();
    routes.forEach((r, i) => {
      if (r.points.length < 4) return;
      for (const end of ends) {
        const key = r[end] + '|' + end + '|' + r[end + 'Side'];
        if (!fans.has(key)) fans.set(key, []);
        fans.get(key).push(i);
      }
    });
    for (const [key, list] of fans) {
      if (list.length < 2) continue;
      const [, end, side] = key.split('|'),
        axis = side === 'left' || side === 'right' ? 'x' : 'y',
        turn = i => round(tip(routes[i].points, end, 1)[axis]),
        values = [...new Set(list.map(turn))];
      if (values.length < 2) continue;
      const spread = t => list.reduce((n, i) => n + Math.abs(turn(i) - t), 0);
      values.sort((a, b) => spread(a) - spread(b) || a - b);
      for (const t of values) {
        const changes = new Map();
        for (const i of list) {
          if (turn(i) === t) continue;
          const ps = clone(routes[i].points);
          tip(ps, end, 1)[axis] = t;
          tip(ps, end, 2)[axis] = t;
          changes.set(i, ps);
        }
        if (attempt(changes)) break;
      }
    }

    // Jogs: a step under 12px between two parallel runs straightens by sliding one run onto
    // the other's line. A run that ends at a port slides the port too, when its side has room
    // and no other port sits there.
    if (rawOptions.jogs !== false)
      for (let i = 0; i < routes.length; i++) {
        const separation = Math.max(s.portGap, s.edgeGap);
        // Slide the run of segment `j` to `value` on `axis`; null when its port can't follow.
        const slide = (ps, j, axis, value) => {
          const next = clone(ps),
            extra = {};
          next[j][axis] = value;
          next[j + 1][axis] = value;
          for (const [k, end] of [
            [j, 'from'],
            [j + 1, 'to'],
          ]) {
            if (k !== (end === 'from' ? 0 : ps.length - 1)) continue;
            const id = routes[i][end],
              side = routes[i][end + 'Side'],
              rect = rects.get(id);
            if (!rect || !flat(rect) || (side === 'left' || side === 'right') !== (axis === 'y'))
              return null;
            const offset = round(value - center(rect)[axis]);
            if (Math.abs(offset) > (axis === 'y' ? rect.h : rect.w) / 2 - 10 + EPS) return null;
            const crowded = routes.some((q, m) =>
              ends.some(
                e2 =>
                  (m !== i || e2 !== end) &&
                  q[e2] === id &&
                  q[e2 + 'Side'] === side &&
                  Math.abs(tip(q.points, e2)[axis] - value) < separation - 0.01,
              ),
            );
            if (crowded) return null;
            Object.assign(next[k], port(rect, side, offset));
            extra[end + 'Offset'] = offset;
          }
          return { next, extra };
        };
        const ps = routes[i].points;
        for (let k = 1; k < ps.length - 2; k++) {
          if (distance(ps[k], ps[k + 1]) >= 12) continue;
          // The step runs along `axis`'s other coordinate; its neighbours run across it.
          const axis = Math.abs(ps[k].x - ps[k + 1].x) < EPS ? 'y' : 'x';
          const options = [
            slide(ps, k - 1, axis, ps[k + 1][axis]),
            slide(ps, k + 1, axis, ps[k][axis]),
          ];
          if (options.some(o => o && attempt(new Map([[i, o.next]]), { [i]: o.extra }, true)))
            break;
        }
      }

    // Corridors: parallel inner runs close together keep one pitch.
    const pitch = s.edgeGap;
    for (const h of [true, false]) {
      const axis = h ? 'y' : 'x',
        along = h ? 'x' : 'y',
        runs = [];
      routes.forEach((r, i) =>
        segments(r.points).forEach(([a, b], k) => {
          if (k === 0 || k === r.points.length - 2 || distance(a, b) <= 12) return;
          if (Math.abs(a.y - b.y) < EPS !== h) return;
          runs.push({
            i,
            k,
            at: round(a[axis]),
            lo: Math.min(a[along], b[along]),
            hi: Math.max(a[along], b[along]),
          });
        }),
      );
      runs.sort((a, b) => a.at - b.at);
      for (let j = 1; j < runs.length; j++) {
        const run = runs[j],
          prev = runs
            .slice(0, j)
            .filter(
              q =>
                q.i !== run.i &&
                q.at < run.at &&
                Math.min(q.hi, run.hi) - Math.max(q.lo, run.lo) > 1,
            )
            .at(-1);
        if (!prev) continue;
        const gap = run.at - prev.at;
        if (Math.abs(gap - pitch) <= 1 || gap > 2.5 * pitch) continue;
        const target = round(prev.at + pitch),
          ps = clone(routes[run.i].points);
        if (
          Math.abs(ps[run.k][axis] - run.at) > EPS ||
          Math.abs(ps[run.k + 1][axis] - run.at) > EPS
        )
          continue;
        ps[run.k][axis] = target;
        ps[run.k + 1][axis] = target;
        if (attempt(new Map([[run.i, ps]]))) run.at = target;
      }
    }
  }
  routes.sort((a, b) => cmp(a.id, b.id));
  const report = {
    ...metrics(routes),
    initial: before,
    accepted,
    ...(facingFans && !rawOptions.quick ? { repaired } : {}),
    nudged,
    ...(tidyOn ? { tidied } : {}),
    edges: routes.length,
    milliseconds: Date.now() - began,
    passes: rawOptions.quick ? 1 : s.passes,
  };
  return { routes, report };
}
const api = {
  compute,
  settings,
  defaults,
  port,
  blocked,
  conflicts,
  parallelConflicts,
  metrics: routes => {
    let crossings = 0,
      shared = 0;
    routes.forEach((r, i) => {
      const c = conflicts(r.points, routes.slice(0, i));
      crossings += c.crossings;
      shared += c.shared;
    });
    return { crossings, shared };
  },
};

export const RouteLab = api;
