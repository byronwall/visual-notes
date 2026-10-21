/**
 * Seeds an audit database with demo events for screenshots and smoke tests:
 * two collections ("Date Nights", "Indy Programming"), Indianapolis places,
 * events with shows relative to today, and one loose event note.
 *
 *   vite-node --config vitest.config.ts scripts/events-demo-seed.ts
 *
 * Run it with DATABASE_URL pointed at a synthetic audit database only.
 * Rerunning adds another copy; seed a fresh owner for clean screenshots.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "~/server/db";
import { createNoteRecord } from "~/server/notes/create-note";
import {
  addOccurrences,
  addRepeatingOccurrences,
  upsertNoteEvent,
} from "~/server/calendar/event-store";
import { createPlace } from "~/server/calendar/place-store";
import { addDays, instantToWallClock } from "~/lib/events/time";
import { DEFAULT_TIME_ZONE, type EventDecision } from "~/lib/events/types";
import type { OccurrenceInput } from "~/lib/events/schemas";

const today = instantToWallClock(new Date(), DEFAULT_TIME_ZONE).date;
const day = (offset: number) => addDays(today, offset);

async function createCollection(
  name: string,
  icon: string,
  extra: Array<{ name: string; options: string[] }>,
) {
  const opt = (n: string, i: number) => ({
    id: `opt_${name.slice(0, 3).toLowerCase()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
    name: n,
    color: ["blue", "green", "orange", "purple", "pink", "teal"][i % 6],
  });
  const collection = await prisma.collection.create({ data: { name, icon } });
  const props = await Promise.all(
    extra.map((p, position) =>
      prisma.collectionProperty.create({
        data: {
          collectionId: collection.id,
          name: p.name,
          kind: "select",
          position,
          config: { options: p.options.map(opt) } as Prisma.InputJsonValue,
        },
      }),
    ),
  );
  await prisma.collectionView.create({
    data: { collectionId: collection.id, name: "Table", type: "table" },
  });
  return { collection, props };
}

const places = {
  jazzKitchen: {
    name: "The Jazz Kitchen",
    street: "5377 N College Ave",
    latitude: 39.8517,
    longitude: -86.1449,
  },
  hilbert: {
    name: "Hilbert Circle Theatre",
    street: "45 Monument Cir",
    latitude: 39.7687,
    longitude: -86.1574,
  },
  newfields: {
    name: "Newfields",
    street: "4000 N Michigan Rd",
    latitude: 39.8257,
    longitude: -86.1856,
  },
  vogue: {
    name: "The Vogue",
    street: "6259 N College Ave",
    latitude: 39.8693,
    longitude: -86.1426,
  },
  launch: {
    name: "Launch Fishers",
    street: "12175 Visionary Way",
    city: "Fishers",
    latitude: 39.9557,
    longitude: -86.0139,
  },
  centralLibrary: {
    name: "Central Library",
    street: "40 E St Clair St",
    latitude: 39.7783,
    longitude: -86.1564,
  },
  milktooth: {
    name: "Milktooth",
    street: "534 Virginia Ave",
    latitude: 39.7593,
    longitude: -86.1462,
    kind: "restaurant" as const,
  },
  festiva: {
    name: "Festiva",
    street: "1101 E 54th St",
    latitude: 39.8477,
    longitude: -86.1405,
    kind: "restaurant" as const,
  },
  midlandAntiques: {
    name: "Midland Arts & Antiques Market",
    street: "907 E Michigan St",
    latitude: 39.7756,
    longitude: -86.1426,
    kind: "shop" as const,
  },
};

async function main() {
  const placeIds: Record<string, string> = {};
  for (const [key, p] of Object.entries(places)) {
    const created = await createPlace({
      kind: "venue",
      city: "Indianapolis",
      state: "IN",
      ...p,
    });
    placeIds[key] = created.id;
  }

  const dates = await createCollection("Date Nights", "💞", [
    {
      name: "Category",
      options: ["Music", "Theater", "Food", "Outdoors", "Art"],
    },
    { name: "Price", options: ["$", "$$", "$$$"] },
  ]);
  const prog = await createCollection("Indy Programming", "💻", [
    { name: "Group", options: ["IndyJS", "IndyPy", "Indy Rust", "Hackathon"] },
  ]);

  type Seed = {
    title: string;
    body: string;
    collection?: typeof dates;
    props?: Record<string, string>;
    url: string;
    summary: string;
    place: keyof typeof places;
    decision?: EventDecision;
    shows?: OccurrenceInput[];
    repeat?: {
      show: OccurrenceInput;
      rule: Parameters<typeof addRepeatingOccurrences>[1]["rule"];
      count: number;
    };
  };

  const seeds: Seed[] = [
    {
      title: "Late-night jazz at The Jazz Kitchen",
      body: "Small room, great sound. Get the 9:30 set and sit near the stage.",
      collection: dates,
      props: { Category: "Music", Price: "$$" },
      url: "https://www.thejazzkitchen.com",
      summary:
        "Intimate jazz club; the late set is quieter and closer to the band.",
      place: "jazzKitchen",
      decision: "interested",
      shows: [
        { date: day(3), time: "21:30", endTime: "23:30", decision: "booked" },
        { date: day(10), time: "21:30", endTime: "23:30" },
        { date: day(17), time: "21:30", endTime: "23:30", decision: "skipped" },
      ],
    },
    {
      title: "ISO: Rachmaninoff Piano Concerto No. 2",
      body: "Indianapolis Symphony Orchestra classical series.",
      collection: dates,
      props: { Category: "Music", Price: "$$$" },
      url: "https://www.indianapolissymphony.org",
      summary:
        "Big romantic concerto; dress up and grab dinner downtown first.",
      place: "hilbert",
      decision: "tentative",
      shows: [
        { date: day(5), time: "19:30", endTime: "21:45" },
        {
          date: day(6),
          time: "19:30",
          endTime: "21:45",
          decision: "tentative",
        },
      ],
    },
    {
      title: "Winterlights at Newfields",
      body: "Outdoor light installation through the gardens. Bundle up.",
      collection: dates,
      props: { Category: "Outdoors", Price: "$$" },
      url: "https://discovernewfields.org",
      summary: "Walk the lit-up gardens; book a timed entry.",
      place: "newfields",
      decision: "interested",
      shows: [
        { date: day(12), timeConfirmed: false },
        { date: day(19), time: "18:00", endTime: "21:00" },
      ],
    },
    {
      title: "Comedy night at The Vogue",
      body: "Touring stand-up. Doors at 7.",
      collection: dates,
      props: { Category: "Theater", Price: "$$" },
      url: "https://www.thevogue.com",
      summary: "Stand-up in a historic Broad Ripple venue.",
      place: "vogue",
      shows: [
        { date: day(8), time: "20:00", endTime: "22:00", status: "sold_out" },
      ],
    },
    {
      title: "Brunch at Milktooth",
      body: "Weekend brunch; expect a line after 10.",
      collection: dates,
      props: { Category: "Food", Price: "$$" },
      url: "https://www.milktoothindy.com",
      summary: "Inventive brunch in Fountain Square.",
      place: "milktooth",
      decision: "booked",
      shows: [{ date: day(4), time: "09:30", endTime: "11:00" }],
    },
    {
      title: "IndyJS monthly meetup",
      body: "Talks plus pizza. Second Wednesday of each month.",
      collection: prog,
      props: { Group: "IndyJS" },
      url: "https://www.meetup.com/indyjs",
      summary: "Two JavaScript talks and networking.",
      place: "launch",
      decision: "interested",
      repeat: {
        show: { date: day(2), time: "18:00", endTime: "20:00" },
        rule: { freq: "monthly", by: "nth-weekday" },
        count: 4,
      },
    },
    {
      title: "IndyPy: Python in production",
      body: "Lightning talks night.",
      collection: prog,
      props: { Group: "IndyPy" },
      url: "https://www.meetup.com/indypy",
      summary: "Lightning talks on running Python services.",
      place: "centralLibrary",
      shows: [{ date: day(9), time: "18:30", endTime: "20:30" }],
    },
    {
      title: "Hoosier Hack weekend",
      body: "48-hour hackathon. Bring a team or find one Friday night.",
      collection: prog,
      props: { Group: "Hackathon" },
      url: "https://example.com/hoosier-hack",
      summary: "Weekend hackathon with prizes and mentors.",
      place: "launch",
      decision: "tentative",
      shows: [{ date: day(15), endDate: day(17) }],
    },
    {
      title: "Anne's birthday dinner",
      body: "Loose event note, not in any collection.",
      url: "https://www.festivaindy.com",
      summary: "Birthday dinner at Festiva.",
      place: "festiva",
      decision: "booked",
      shows: [{ date: day(21), time: "19:00", endTime: "21:00" }],
    },
  ];

  for (const seed of seeds) {
    const { id } = await createNoteRecord({
      title: seed.title,
      markdown: seed.body,
    });
    if (seed.collection) {
      const properties: Record<string, string> = {};
      for (const [name, value] of Object.entries(seed.props ?? {})) {
        const prop = seed.collection.props.find((p) => p.name === name)!;
        const option = (
          prop.config as { options: Array<{ id: string; name: string }> }
        ).options.find((o) => o.name === value)!;
        properties[prop.id] = option.id;
      }
      await prisma.doc.update({
        where: { id },
        data: {
          collectionId: seed.collection.collection.id,
          collectionRank: String(Date.now()),
          properties,
        },
      });
    }
    await upsertNoteEvent(id, {
      url: seed.url,
      summary: seed.summary,
      placeId: placeIds[seed.place],
      decision: seed.decision ?? "unreviewed",
    });
    if (seed.shows) await addOccurrences(id, seed.shows);
    if (seed.repeat) await addRepeatingOccurrences(id, seed.repeat);
  }

  console.info(
    `[events-demo-seed] seeded ${seeds.length} events, ${Object.keys(places).length} places, collections ${dates.collection.id} ${prog.collection.id}`,
  );
  await prisma.$disconnect();
}

await main();
