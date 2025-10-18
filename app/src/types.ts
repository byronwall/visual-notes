export type Passage = {
  id: string;
  ref: string;
  norm: string;
  done?: boolean;
};

export type PlanDay = {
  id: string;
  date?: string;
  label: string;
  passages: Passage[];
};

export type Plan = {
  id: string;
  title: string;
  days: PlanDay[];
  createdAt: string;
  version: 1;
};

