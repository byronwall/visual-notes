import { useNavigate } from "@solidjs/router";
import { PlusIcon } from "lucide-solid";
import { Show, Suspense, createSignal } from "solid-js";
import { openCapture } from "~/components/people/capture-state";
import { PeopleDirectory } from "~/components/people/PeopleDirectory";
import { PeopleShell } from "~/components/people/PeopleShell";
import { ProfileDialog } from "~/components/people/ProfileDialog";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

export default function PeopleRoute() {
  const navigate = useNavigate();
  const [creating, setCreating] = createSignal<{ name: string } | null>(null);
  return (
    <PeopleShell
      title="People"
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openCapture("fact")}
          >
            Remember a detail
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openCapture("interaction")}
          >
            Log interaction
          </Button>
          <Button size="sm" onClick={() => setCreating({ name: "" })}>
            <PlusIcon size={14} /> New person
          </Button>
        </>
      }
    >
      <Suspense fallback={<Skeleton h="40" />}>
        <PeopleDirectory onCreate={(name) => setCreating({ name })} />
      </Suspense>
      <Show when={creating()}>
        {(c) => (
          <ProfileDialog
            person={null}
            initialName={c().name}
            onClose={() => setCreating(null)}
            onSaved={(p) => navigate(`/people/${p.id}`)}
          />
        )}
      </Show>
    </PeopleShell>
  );
}
