import { EventsMapView } from "~/components/events/map/EventsMapView";
import { EventsPageShell } from "~/components/events/views/EventsPageShell";

export default function EventsMapRoute() {
  return (
    <EventsPageShell title="Map">
      <EventsMapView />
    </EventsPageShell>
  );
}
