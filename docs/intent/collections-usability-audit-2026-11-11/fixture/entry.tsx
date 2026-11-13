import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { Box, Container } from "styled-system/jsx";
import { CollectionPage } from "~/components/collections/CollectionPage";
import type { CollectionBundle } from "~/lib/collections/types";
import "audit-styles";
import "~/panda.css";
const q = new URLSearchParams(location.search);
const names = [
  "Table",
  "Feedback — newest first",
  "Revision batch — provisional",
  "Batch 2 — bookmark-informed",
  "Batch 2 — for new readers",
  "Batch 2 — tightened",
  "Batch 2 — example-led",
  "Batch 3 — example-led",
  "Batch 4 — example-led",
  "Batch 5 — example-led",
  "Batch 6 — example-led",
  "Batch 7 — example-led",
  "Batch 8 — example-led",
  "Batch 10 — example-led",
  "Batch 11 — example-led",
];
const properties: any[] = [
  {
    id: "status",
    name: "Status",
    kind: "status",
    config: {
      options: [
        { id: "draft", name: "Draft", color: "gray", group: "todo" },
        { id: "progress", name: "In progress", color: "blue", group: "doing" },
        { id: "done", name: "Done", color: "green", group: "done" },
      ],
    },
  },
  {
    id: "tags",
    name: "Tags",
    kind: "multi_select",
    config: {
      options: [
        { id: "demo", name: "Demo", color: "blue" },
        { id: "ux", name: "UX", color: "purple" },
      ],
    },
  },
  {
    id: "rating",
    name: "Rating",
    kind: "select",
    config: {
      options: [1, 2, 3, 4, 5].map((n) => ({
        id: String(n),
        name: String(n),
        color: "yellow",
      })),
    },
  },
  { id: "feedback", name: "Feedback", kind: "text", config: {} },
  { id: "date", name: "Batch date", kind: "date", config: {} },
  { id: "project", name: "Project", kind: "text", config: {} },
  { id: "copy", name: "Post copy", kind: "text", config: {} },
  { id: "link", name: "Destination link", kind: "text", config: {} },
].map((p, position) => ({ ...p, position }));
const titles = [
  "Chart across related tables",
  "Components inside diagram nodes",
  "Feedback attached to the page",
  "Complexity versus code changes",
  "Readable passing rates",
];
const rows = Array.from({ length: +q.get("rows") || 110 }, (_, i) => ({
  id: "synthetic-" + i,
  title: titles[i % 5] + " — sample " + (i + 1),
  properties: {
    status: i % 4 === 0 ? "progress" : "draft",
    tags: [i % 2 ? "demo" : "ux"],
    rating: String((i % 5) + 1),
    feedback:
      i % 3
        ? ""
        : "Show the visual first, explain the practical benefit, and keep the full draft easy to compare.",
    date: { start: "2026-11-11" },
    project: [
      "Chart Lab",
      "Diagram Lab",
      "Portfolio Lab",
      "Code Lab",
      "Sports Lab",
    ][i % 5],
    copy: "Compare several records with their complete text. This synthetic draft demonstrates how long copy, review status, a rating, and feedback appear together in the collection. It contains no private content.",
    link: "https://example.com/project/" + (i + 1),
  },
  rank: null,
  createdAt: "2026-11-11T08:00:00Z",
  updatedAt: "2026-11-11T08:00:00Z",
}));
const viewType = q.get("type") || "table";
const bundle: CollectionBundle = {
  collection: {
    id: "synthetic-audit",
    name: "Post Ideas — Review Fixture",
    description: "Synthetic fixture",
    icon: null,
    showRowsInRecent: false,
  },
  properties,
  rows,
  today: "2026-11-11",
  views: names.slice(0, +q.get("views") || 15).map((name, position) => ({
    id: "view-" + position,
    collectionId: "synthetic-audit",
    hostDocId: null,
    name,
    type: viewType as any,
    position,
    config: {
      groupBy: "status",
      dateProperty: "date",
      ...(q.get("wide")
        ? { columnWidths: { title: 280, copy: 480, feedback: 280 } }
        : {}),
    },
  })),
};
const Demo = () => (
  <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
    <Container
      maxW="none"
      pt={{ base: "3", md: "5" }}
      pb="24"
      px={{ base: "4", md: "8" }}
    >
      <CollectionPage bundle={bundle} />
    </Container>
  </Box>
);
render(
  () => (
    <Router>
      <Route path="*" component={Demo} />
    </Router>
  ),
  document.getElementById("root")!,
);
