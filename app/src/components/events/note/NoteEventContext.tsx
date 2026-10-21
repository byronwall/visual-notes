import { useAction } from "@solidjs/router";
import {
  createContext,
  createResource,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";
import { useToasts } from "~/components/Toast";
import type { EventPatch, OccurrencePatch } from "~/lib/events/schemas";
import type { NoteEvent, PlaceSummary } from "~/lib/events/types";
import type {
  OccurrenceInput,
  PlaceInput,
  RepeatOccurrencesInput,
} from "~/lib/events/schemas";
import {
  addPlace,
  createOccurrences,
  createRepeatingOccurrences,
  removeNoteEvent,
  removeOccurrence,
  saveNoteEvent,
  saveOccurrence,
} from "~/services/events/events.actions";
import { fetchNoteEvent } from "~/services/events/events.queries";
import { useFeedsRefresh } from "~/components/events/feeds/feedsRefresh";

type NoteEventApi = {
  docId: Accessor<string>;
  /** Latest event on the note; null when the note is not an event. */
  event: Accessor<NoteEvent | null | undefined>;
  saveEvent: (patch: EventPatch) => Promise<boolean>;
  removeEvent: () => Promise<boolean>;
  addShows: (shows: OccurrenceInput[]) => Promise<boolean>;
  addRepeat: (repeat: RepeatOccurrencesInput) => Promise<boolean>;
  saveShow: (id: string, patch: OccurrencePatch) => Promise<boolean>;
  removeShow: (id: string) => Promise<boolean>;
  createPlace: (input: PlaceInput) => Promise<PlaceSummary | null>;
};

const NoteEventContext = createContext<NoteEventApi>();

export const useNoteEvent = () => {
  const api = useContext(NoteEventContext);
  if (!api)
    throw new Error("useNoteEvent must be used inside NoteEventProvider");
  return api;
};

/**
 * Loads one note's event and wraps the event actions. Actions revalidate the
 * events query keys, but `createResource` does not track query keys, so each
 * write also refetches this resource.
 */
export function NoteEventProvider(props: {
  docId: string;
  children: JSX.Element;
}) {
  // Refetches pass a new count so a read after a write skips the query cache
  // (resources do not track revalidated query keys). The first read uses 0
  // on both server and client so hydration reuses the SSR result.
  let refetches = 0;
  const [resource, { refetch }] = createResource(
    () => props.docId,
    (id: string, info: { refetching: unknown }) =>
      fetchNoteEvent(id, info.refetching ? ++refetches : 0),
  );
  const { show: toast } = useToasts();
  // Decision and collection edits can change which feeds match by rule.
  const feedsRefresh = useFeedsRefresh();
  const runSaveEvent = useAction(saveNoteEvent);
  const runRemoveEvent = useAction(removeNoteEvent);
  const runCreate = useAction(createOccurrences);
  const runRepeat = useAction(createRepeatingOccurrences);
  const runSaveShow = useAction(saveOccurrence);
  const runRemoveShow = useAction(removeOccurrence);
  const runAddPlace = useAction(addPlace);

  const attempt = async <T,>(label: string, work: Promise<T>) => {
    try {
      const result = await work;
      await refetch();
      feedsRefresh.bump();
      return { ok: true as const, result };
    } catch (error) {
      console.error(`[note-event] ${label} failed`, error);
      toast({
        type: "error",
        title: `Could not ${label}`,
        message: error instanceof Error ? error.message : String(error),
      });
      return { ok: false as const };
    }
  };
  const ok = async (label: string, work: Promise<unknown>) =>
    (await attempt(label, work)).ok;

  const docId = () => props.docId;
  const api: NoteEventApi = {
    docId,
    event: () => resource.latest,
    saveEvent: (patch) =>
      ok("save the event", runSaveEvent({ docId: docId(), patch })),
    removeEvent: () => ok("remove the event", runRemoveEvent(docId())),
    addShows: (shows) =>
      ok("add the show", runCreate({ docId: docId(), shows })),
    addRepeat: (repeat) =>
      ok("add repeating shows", runRepeat({ docId: docId(), repeat })),
    saveShow: (id, patch) => ok("save the show", runSaveShow({ id, patch })),
    removeShow: (id) => ok("delete the show", runRemoveShow(id)),
    createPlace: async (input) => {
      const outcome = await attempt("create the place", runAddPlace(input));
      return outcome.ok ? (outcome.result as PlaceSummary) : null;
    },
  };

  return (
    <NoteEventContext.Provider value={api}>
      {props.children}
    </NoteEventContext.Provider>
  );
}
