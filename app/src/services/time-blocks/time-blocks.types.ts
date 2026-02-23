export type TimeBlockItem = {
  id: string;
  title: string | null;
  startTime: string;
  endTime: string;
  color: string | null;
  isFixedTime: boolean;
  comments: string | null;
  noteId: string | null;
  noteTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimeBlockDayMetadataItem = {
  id: string;
  date: string;
  key: string;
  value: string;
  contributor: string;
  comments: string | null;
  noteId: string | null;
  noteTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimeBlockCounts = {
  today: number;
  upcoming: number;
};

export type TimeBlockMetadataSummaryRow = {
  date: string;
  values: Record<
    string,
    {
      id: string;
      value: string;
      contributor: string;
      comments: string | null;
      noteId: string | null;
      noteTitle: string | null;
    }
  >;
};
