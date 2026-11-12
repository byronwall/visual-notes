import { useSearchParams } from "@solidjs/router";
import { untrack } from "solid-js";
import { Box } from "styled-system/jsx";
import { SimpleSelect } from "~/components/ui/simple-select";
import {
  CONTACT_WINDOWS,
  CONTACT_WINDOW_LABELS,
  type ContactWindow,
} from "~/lib/people/types";
import {
  fetchOrganizations,
  fetchPeopleContexts,
} from "~/services/people/people.queries";
import { createKeptAsync } from "~/utils/kept-async";

const param = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : "";

/** Directory filters read from and written to the URL. */
export function usePeopleFilters() {
  const [params, setParams] = useSearchParams();
  const contact = () => {
    const v = param(params.contact);
    return (CONTACT_WINDOWS as readonly string[]).includes(v)
      ? (v as ContactWindow)
      : undefined;
  };
  return {
    q: () => param(params.q),
    context: () => param(params.context) || undefined,
    organizationId: () => param(params.org) || undefined,
    contact,
    archived: () => params.archived === "1",
    page: () => Math.max(0, Number(params.page ?? 0) || 0),
    selected: () => param(params.p) || undefined,
    any: () =>
      !!(
        params.q ||
        params.context ||
        params.org ||
        params.contact ||
        params.archived
      ),
    set: (next: Record<string, string | undefined>) =>
      setParams(
        { ...next, page: "page" in next ? next.page : undefined },
        { replace: true },
      ),
    select: (id: string | undefined) => setParams({ p: id }, { replace: true }),
    reset: () =>
      setParams(
        {
          q: undefined,
          context: undefined,
          org: undefined,
          contact: undefined,
          archived: undefined,
          page: undefined,
        },
        { replace: true },
      ),
  };
}

export function PeopleFilters(props: {
  filters: ReturnType<typeof usePeopleFilters>;
}) {
  // The filters object is a stable set of URL accessors.
  const f = untrack(() => props.filters);
  const contexts = createKeptAsync(() => fetchPeopleContexts());
  const orgs = createKeptAsync(() => fetchOrganizations({}));
  const select = (
    label: string,
    value: string,
    items: { label: string; value: string }[],
    onChange: (v: string) => void,
  ) => (
    <Box w={{ base: "full", sm: "11rem" }} flexShrink="0">
      <SimpleSelect
        items={[{ label, value: "" }, ...items]}
        value={value}
        placeholder={label}
        onChange={onChange}
        size="sm"
        sameWidth={false}
        skipPortal={false}
      />
    </Box>
  );
  return (
    <>
      {select(
        "All contexts",
        f.context() ?? "",
        (contexts.latest ?? []).map((c) => ({
          label: `${c.context} (${c.count})`,
          value: c.context,
        })),
        (v) => f.set({ context: v || undefined }),
      )}
      {select(
        "All organizations",
        f.organizationId() ?? "",
        (orgs.latest ?? []).map((o) => ({ label: o.name, value: o.id })),
        (v) => f.set({ org: v || undefined }),
      )}
      {select(
        "Any contact",
        f.contact() ?? "",
        CONTACT_WINDOWS.map((w) => ({
          label: CONTACT_WINDOW_LABELS[w],
          value: w,
        })),
        (v) => f.set({ contact: v || undefined }),
      )}
    </>
  );
}
