import {
  DECISION_LABELS,
  type CalendarFeed,
  type EventDecision,
} from "~/lib/events/types";
import type { FeedRuleOption } from "~/services/events/feeds.queries";

const listDecisions = (decisions: EventDecision[]) =>
  decisions.map((d) => DECISION_LABELS[d].toLowerCase()).join(", ");

/** One sentence describing what the rule publishes. */
export function describeRule(
  feed: Pick<CalendarFeed, "collectionId" | "viewId" | "decisions">,
  collection: FeedRuleOption | undefined,
) {
  const decisions = feed.decisions.length
    ? ` marked ${listDecisions(feed.decisions)}`
    : "";
  if (!feed.collectionId) {
    return feed.decisions.length
      ? `Shows from any note${decisions}.`
      : "Manual entries only. Pick a collection or decisions to publish by rule.";
  }
  const name = collection?.name ?? "a deleted collection";
  const view = collection?.views.find((v) => v.id === feed.viewId);
  const scope = view
    ? `rows of ${name} in the “${view.name}” view`
    : `rows of ${name}`;
  return `Shows from ${scope}${decisions}.`;
}
