import { EventsCalendar } from "~/components/events/views/EventsCalendar";
import { EventsPageShell } from "~/components/events/views/EventsPageShell";

export default function EventsCalendarRoute() {
  return (
    <EventsPageShell title="Calendar">
      <EventsCalendar />
    </EventsPageShell>
  );
}
