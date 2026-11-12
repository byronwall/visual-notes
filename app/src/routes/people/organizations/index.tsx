import { useNavigate } from "@solidjs/router";
import { PlusIcon } from "lucide-solid";
import { Show, Suspense, createSignal } from "solid-js";
import { OrganizationDialog } from "~/components/people/OrganizationDialog";
import { OrganizationsList } from "~/components/people/OrganizationsList";
import { PeopleShell } from "~/components/people/PeopleShell";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

export default function OrganizationsRoute() {
  const navigate = useNavigate();
  const [creating, setCreating] = createSignal(false);
  return (
    <PeopleShell
      title="Organizations"
      heading="People"
      tabs
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon size={14} /> New organization
        </Button>
      }
    >
      <Suspense fallback={<Skeleton h="40" />}>
        <OrganizationsList />
      </Suspense>
      <Show when={creating()}>
        <OrganizationDialog
          organization={null}
          onClose={() => setCreating(false)}
          onSaved={(o) => navigate(`/people/organizations/${o.id}`)}
        />
      </Show>
    </PeopleShell>
  );
}
