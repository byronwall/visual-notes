// Copied from Diagram Studio (Draftably): src/engines/routing-engine.js.
// Only the parts this sandbox uses are typed.

export type Point = { x: number; y: number };
export type Side = "left" | "right" | "top" | "bottom";

export interface RouteNodeInput {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: "box";
}

export interface RouteEdgeInput {
  id: string;
  from: string;
  to: string;
  directed?: boolean;
  cfg: {
    flow?: "right" | "down";
    fromSide?: Side | "auto";
    toSide?: Side | "auto";
  };
}

export interface Route {
  id: string;
  from: string;
  to: string;
  fromSide: Side;
  toSide: Side;
  points: Point[];
  blocked: boolean;
}

export const RouteLab: {
  compute(
    input: {
      nodes: RouteNodeInput[];
      groups: never[];
      edges: RouteEdgeInput[];
    },
    options?: {
      direction?: "right" | "down";
      quick?: boolean;
      cornerRadius?: number;
    },
  ): { routes: Route[]; report: { crossings: number; milliseconds: number } };
};
