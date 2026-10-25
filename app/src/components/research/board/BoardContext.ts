import { createContext, useContext, type Accessor } from "solid-js";
import type { TopicData } from "../createTopicData";

export type BoardDensity = "detailed" | "compact";

/** What every card row on the board needs, so rows don't drill props through columns. */
export type BoardContextValue = {
  data: TopicData;
  selectedId: Accessor<string | null>;
  onSelect: (id: string) => void;
  density: Accessor<BoardDensity>;
  /** Set while a row is hovered; related rows highlight. */
  setHovered: (id: string | null) => void;
  isRelated: (id: string) => boolean;
  /** Null when there is no search; otherwise rows outside the set dim. */
  matches: Accessor<Set<string> | null>;
};

export const BoardContext = createContext<BoardContextValue>();

export const useBoard = () => {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard outside TopicBoard");
  return value;
};
