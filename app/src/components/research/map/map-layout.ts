import type { MapKind, MapNode, MapSide, MapTree } from "./map-model";

// A two-sided tidy tree. Every node has a fixed size, so positions come from
// the data alone: the server renders the same map the client does, and nothing
// here measures the DOM. A branch sits at the middle of its own block, so
// opening it pushes its neighbours apart evenly and never touches the other side.

export const NODE_SIZE: Record<MapKind, { w: number; h: number }> = {
  root: { w: 248, h: 116 },
  stream: { w: 248, h: 72 },
  section: { w: 116, h: 28 },
  card: { w: 272, h: 44 },
};

const GAP_X = 44;
const GAP_Y: Record<MapKind, number> = {
  root: 0,
  stream: 16,
  section: 10,
  card: 2,
};

export type MapBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  side: MapSide;
  depth: number;
};

export type MapBounds = { x: number; y: number; w: number; h: number };

export type MapLayout = {
  /** Visible nodes in reading order: root, right side, left side. */
  boxes: MapBox[];
  byId: Map<string, MapBox>;
  /** Connector path per child id. */
  links: Map<string, string>;
  bounds: MapBounds;
};

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const bend = (x2 - x1) / 2;
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
};

export const boundsOf = (boxes: MapBox[]): MapBounds => {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
};

export const layoutMap = (tree: MapTree, open: Set<string>): MapLayout => {
  const kidsOf = (node: MapNode) => (open.has(node.id) ? node.children : []);
  const blockOf = (kids: MapNode[]) =>
    kids.reduce((sum, kid) => sum + spanOf(kid), 0) +
    Math.max(0, kids.length - 1) * (kids[0] ? GAP_Y[kids[0].kind] : 0);
  const spans = new Map<string, number>();
  function spanOf(node: MapNode): number {
    const known = spans.get(node.id);
    if (known !== undefined) return known;
    const span = Math.max(NODE_SIZE[node.kind].h, blockOf(kidsOf(node)));
    spans.set(node.id, span);
    return span;
  }

  const boxes: MapBox[] = [];
  const links = new Map<string, string>();
  const rootSize = NODE_SIZE.root;
  const rootBox: MapBox = {
    id: tree.root.id,
    x: -rootSize.w / 2,
    y: -rootSize.h / 2,
    ...rootSize,
    side: "right",
    depth: 0,
  };
  boxes.push(rootBox);

  /** `inner` is the distance from the map's center to the node's near edge. */
  const place = (
    node: MapNode,
    inner: number,
    top: number,
    depth: number,
    parent: MapBox,
  ) => {
    const size = NODE_SIZE[node.kind];
    const span = spanOf(node);
    const right = node.side === "right";
    const box: MapBox = {
      id: node.id,
      x: right ? inner : -inner - size.w,
      y: top + (span - size.h) / 2,
      ...size,
      side: node.side,
      depth,
    };
    boxes.push(box);
    links.set(
      node.id,
      curve(
        right ? parent.x + parent.w : parent.x,
        parent.y + parent.h / 2,
        right ? box.x : box.x + box.w,
        box.y + box.h / 2,
      ),
    );
    const kids = kidsOf(node);
    let cursor = top + (span - blockOf(kids)) / 2;
    for (const kid of kids) {
      place(kid, inner + size.w + GAP_X, cursor, depth + 1, box);
      cursor += spanOf(kid) + GAP_Y[kid.kind];
    }
  };

  for (const side of ["right", "left"] as const) {
    const kids = tree.root.children.filter((node) => node.side === side);
    let cursor = -blockOf(kids) / 2;
    for (const kid of kids) {
      place(kid, rootSize.w / 2 + GAP_X, cursor, 1, rootBox);
      cursor += spanOf(kid) + GAP_Y[kid.kind];
    }
  }

  return {
    boxes,
    byId: new Map(boxes.map((box) => [box.id, box])),
    links,
    bounds: boundsOf(boxes),
  };
};
