// Bible metadata: ordered books with testament and chapter counts
export type BibleBook = {
  name: string;
  short: string;
  testament: "OT" | "NT";
  chapters: number;
};

// KJV/ESV standard chapter counts
const BIBLE_BOOKS: BibleBook[] = [
  { name: "Genesis", short: "Gen", testament: "OT", chapters: 50 },
  { name: "Exodus", short: "Exod", testament: "OT", chapters: 40 },
  { name: "Leviticus", short: "Lev", testament: "OT", chapters: 27 },
  { name: "Numbers", short: "Num", testament: "OT", chapters: 36 },
  { name: "Deuteronomy", short: "Deut", testament: "OT", chapters: 34 },
  { name: "Joshua", short: "Josh", testament: "OT", chapters: 24 },
  { name: "Judges", short: "Judg", testament: "OT", chapters: 21 },
  { name: "Ruth", short: "Ruth", testament: "OT", chapters: 4 },
  { name: "1 Samuel", short: "1 Sam", testament: "OT", chapters: 31 },
  { name: "2 Samuel", short: "2 Sam", testament: "OT", chapters: 24 },
  { name: "1 Kings", short: "1 Kgs", testament: "OT", chapters: 22 },
  { name: "2 Kings", short: "2 Kgs", testament: "OT", chapters: 25 },
  { name: "1 Chronicles", short: "1 Chr", testament: "OT", chapters: 29 },
  { name: "2 Chronicles", short: "2 Chr", testament: "OT", chapters: 36 },
  { name: "Ezra", short: "Ezra", testament: "OT", chapters: 10 },
  { name: "Nehemiah", short: "Neh", testament: "OT", chapters: 13 },
  { name: "Esther", short: "Esth", testament: "OT", chapters: 10 },
  { name: "Job", short: "Job", testament: "OT", chapters: 42 },
  { name: "Psalms", short: "Ps", testament: "OT", chapters: 150 },
  { name: "Proverbs", short: "Prov", testament: "OT", chapters: 31 },
  { name: "Ecclesiastes", short: "Eccl", testament: "OT", chapters: 12 },
  { name: "Song of Solomon", short: "Song", testament: "OT", chapters: 8 },
  { name: "Isaiah", short: "Isa", testament: "OT", chapters: 66 },
  { name: "Jeremiah", short: "Jer", testament: "OT", chapters: 52 },
  { name: "Lamentations", short: "Lam", testament: "OT", chapters: 5 },
  { name: "Ezekiel", short: "Ezek", testament: "OT", chapters: 48 },
  { name: "Daniel", short: "Dan", testament: "OT", chapters: 12 },
  { name: "Hosea", short: "Hos", testament: "OT", chapters: 14 },
  { name: "Joel", short: "Joel", testament: "OT", chapters: 3 },
  { name: "Amos", short: "Amos", testament: "OT", chapters: 9 },
  { name: "Obadiah", short: "Obad", testament: "OT", chapters: 1 },
  { name: "Jonah", short: "Jonah", testament: "OT", chapters: 4 },
  { name: "Micah", short: "Mic", testament: "OT", chapters: 7 },
  { name: "Nahum", short: "Nah", testament: "OT", chapters: 3 },
  { name: "Habakkuk", short: "Hab", testament: "OT", chapters: 3 },
  { name: "Zephaniah", short: "Zeph", testament: "OT", chapters: 3 },
  { name: "Haggai", short: "Hag", testament: "OT", chapters: 2 },
  { name: "Zechariah", short: "Zech", testament: "OT", chapters: 14 },
  { name: "Malachi", short: "Mal", testament: "OT", chapters: 4 },
  { name: "Matthew", short: "Matt", testament: "NT", chapters: 28 },
  { name: "Mark", short: "Mark", testament: "NT", chapters: 16 },
  { name: "Luke", short: "Luke", testament: "NT", chapters: 24 },
  { name: "John", short: "John", testament: "NT", chapters: 21 },
  { name: "Acts", short: "Acts", testament: "NT", chapters: 28 },
  { name: "Romans", short: "Rom", testament: "NT", chapters: 16 },
  { name: "1 Corinthians", short: "1 Cor", testament: "NT", chapters: 16 },
  { name: "2 Corinthians", short: "2 Cor", testament: "NT", chapters: 13 },
  { name: "Galatians", short: "Gal", testament: "NT", chapters: 6 },
  { name: "Ephesians", short: "Eph", testament: "NT", chapters: 6 },
  { name: "Philippians", short: "Phil", testament: "NT", chapters: 4 },
  { name: "Colossians", short: "Col", testament: "NT", chapters: 4 },
  { name: "1 Thessalonians", short: "1 Thess", testament: "NT", chapters: 5 },
  { name: "2 Thessalonians", short: "2 Thess", testament: "NT", chapters: 3 },
  { name: "1 Timothy", short: "1 Tim", testament: "NT", chapters: 6 },
  { name: "2 Timothy", short: "2 Tim", testament: "NT", chapters: 4 },
  { name: "Titus", short: "Titus", testament: "NT", chapters: 3 },
  { name: "Philemon", short: "Phlm", testament: "NT", chapters: 1 },
  { name: "Hebrews", short: "Heb", testament: "NT", chapters: 13 },
  { name: "James", short: "Jas", testament: "NT", chapters: 5 },
  { name: "1 Peter", short: "1 Pet", testament: "NT", chapters: 5 },
  { name: "2 Peter", short: "2 Pet", testament: "NT", chapters: 3 },
  { name: "1 John", short: "1 Jn", testament: "NT", chapters: 5 },
  { name: "2 John", short: "2 Jn", testament: "NT", chapters: 1 },
  { name: "3 John", short: "3 Jn", testament: "NT", chapters: 1 },
  { name: "Jude", short: "Jude", testament: "NT", chapters: 1 },
  { name: "Revelation", short: "Rev", testament: "NT", chapters: 22 },
];

export const OT_BOOKS = BIBLE_BOOKS.filter((b) => b.testament === "OT");
export const NT_BOOKS = BIBLE_BOOKS.filter((b) => b.testament === "NT");

export function chapterRef(book: BibleBook, chapter: number): string {
  return `${book.name} ${chapter}`;
}
