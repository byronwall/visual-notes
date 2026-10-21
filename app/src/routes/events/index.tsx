import { EventsPageShell } from "~/components/events/views/EventsPageShell";
import { UpcomingList } from "~/components/events/views/UpcomingList";

export default function EventsUpcomingRoute() {
  return (
    <EventsPageShell title="Upcoming">
      <UpcomingList />
    </EventsPageShell>
  );
}
