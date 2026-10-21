import { PlacesView } from "~/components/events/places/PlacesView";
import { EventsPageShell } from "~/components/events/views/EventsPageShell";

export default function EventsPlacesRoute() {
  return (
    <EventsPageShell title="Places">
      <PlacesView />
    </EventsPageShell>
  );
}
