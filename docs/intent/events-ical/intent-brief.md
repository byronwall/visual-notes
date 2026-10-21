# Events and iCal feeds

Bring the date-night calendar (`~/Projects/date-night-calendar`) into Visual Notes, then retire that site. Events live on notes, and subscribable iCal feeds publish a chosen set of them. There will be several feeds, such as "Date Nights" and "Indy programming events".

## Decisions

| Question | Decision |
| --- | --- |
| What is an event? | A **note**. `Event` (1:1 with `Doc`) holds the iCal-facing details (official URL, short summary, default place) and the event-level decision. Each dated show is an `EventOccurrence`. |
| Collections or loose? | Both. Catalog properties such as category, price, and rating are collection properties (for example in a "Date Nights" collection). A loose note can still have shows. |
| Decisions | Interested, tentative, booked, skipped, and rejected, on the event and on each show separately. A show's **effective decision** is its own decision, or the event's when the show is unreviewed. |
| Recurrence | Expand a repeat rule (daily, weekly, monthly by day or by nth weekday) into explicit shows. Feeds never publish RRULE. |
| Times | Shows are stored as UTC instants with an IANA zone, defaulting to `America/Indiana/Indianapolis`. `timeConfirmed = false` publishes an all-day "time TBD" entry. |
| Places | `Place` table (venue, restaurant, shop, other) with address and coordinates for the map. A place can link to a write-up note. Restaurants and shops are places with no shows. |
| Feed selection | A `CalendarFeed` rule selects the rows of one collection that match one of its views' filters, limited to a set of effective decisions. Manual `include` and `exclude` entries apply on top of the rule. |
| Feed access | `/cal/<token>.ics` needs no login. Rotating the token revokes the URL. |
| Multiple feeds | One URL per feed, so each feed is its own subscribed calendar. The iCal `UID` is `<occurrenceId>-<feedId>@visual-notes`, so one show can appear in two feeds without clients merging the entries. |
| Entry body | Title, LOCATION from the place address, URL from the official link, and a plain-text summary. No link back into Visual Notes. `SEQUENCE` increments when published fields change. |
| Past shows | Each feed keeps `pastDays` (default 90) of past shows, plus every upcoming show. |
| Date-night scope carried over | Places with the map, separate event and show decisions, and the MCP ingest tools. **Not** migrating the existing SQLite data. |

## Stack

Each layer is its own PR, based on the one below it.

1. **Foundation**: schema and migration; `src/lib/events/` (types, zod schemas, time-zone math, repeat expansion); `src/server/calendar/` (event and place stores); `src/services/events/` (queries and actions); the nav entry, `EventsTabs`, and `/events/*` route stubs.
2. **Feeds**: feed store, iCal writer, `/cal/[token]` route plus the middleware allowance, and the `/events/feeds` manager.
3. **Note event panel**: an "Event" section in the note side panel to edit details and shows, add repeats, pick places, and add the note to feeds.
4. **Events views**: `/events` upcoming list, `/events/calendar`, `/events/map` (Leaflet), and `/events/places`.
5. **MCP tools**: event, show, place, and feed tools, with dedupe by URL or title plus date.

## Code map

- `app/prisma/schema.prisma`: `Event`, `EventOccurrence`, `Place`, `CalendarFeed`, `CalendarFeedEntry`
- `app/src/lib/events/`: shared types, schemas, time and repeat helpers (pure; usable on client and server)
- `app/src/server/calendar/`: stores (plain async functions shared by actions, the iCal route, and MCP)
- `app/src/services/events/`: `query()` and `action()` wrappers for the UI
