import { type VoidComponent, Show, createEffect, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { apiFetch } from "~/utils/base-url";
import DocumentEditor from "./DocumentEditor";
import { TitleEditPopover } from "./TitleEditPopover";
import { extractFirstHeading } from "~/utils/extractHeading";
import { updateDocTitle } from "~/services/docs.service";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { IconButton } from "~/components/ui/icon-button";
import { Box, HStack, Spacer, Stack } from "styled-system/jsx";
import { PencilIcon } from "lucide-solid";

type DocumentData = {
  id: string;
  title: string;
  markdown?: string;
  html?: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

const DocumentViewer: VoidComponent<{
  doc: DocumentData;
  onDeleted?: () => void;
}> = (props) => {
  try {
    console.log("[DocumentViewer] render docId=", props.doc?.id);
  } catch {}

  const navigate = useNavigate();
  const [busy, setBusy] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [title, setTitle] = createSignal(props.doc.title);
  const firstH1 = () =>
    extractFirstHeading({
      markdown: props.doc.markdown,
      html: props.doc.html,
    }) || "";
  const showSync = () => firstH1() && firstH1() !== title();

  const handleOpenEdit = () => {
    try {
      console.log("[DocumentViewer] open title edit for doc:", props.doc.id);
    } catch {}
    setEditing(true);
  };
  const handleCancelEdit = () => setEditing(false);
  const handleConfirmEdit = async (newTitle: string) => {
    try {
      await updateDocTitle(props.doc.id, newTitle);
      setTitle(newTitle);
      try {
        console.log("[DocumentViewer] title updated:", newTitle);
      } catch {}
    } catch (e) {
      alert((e as Error).message || "Failed to update title");
    } finally {
      setEditing(false);
    }
  };
  const handleSync = async () => {
    const newTitle = firstH1();
    if (!newTitle) return;
    try {
      await updateDocTitle(props.doc.id, newTitle);
      setTitle(newTitle);
    } catch (e) {
      alert((e as Error).message || "Failed to sync title");
    }
  };

  // Update page title to match note title
  createEffect(() => {
    const t = title();
    if (typeof document !== "undefined" && t) {
      document.title = `${t} • Visual Notes`;
    }
  });

  return (
    <Box class="prose" maxW="none">
      <HStack gap="3" alignItems="center" flexWrap="wrap">
        <HStack gap="2" alignItems="center" flexWrap="wrap" minW="0">
          <Heading as="h2" fontSize="xl" m="0">
            {title()}
          </Heading>
          <IconButton
            type="button"
            size="xs"
            variant="plain"
            colorPalette="gray"
            aria-label="Edit title"
            onClick={handleOpenEdit}
          >
            <PencilIcon size={16} />
          </IconButton>
          <Show when={showSync()}>
            <Button
              type="button"
              size="xs"
              variant="outline"
              colorPalette="gray"
              onClick={handleSync}
              title={`Match H1: ${firstH1()}`}
            >
              Match H1
            </Button>
          </Show>
          <Show when={editing()}>
            <TitleEditPopover
              initialTitle={title()}
              onConfirm={handleConfirmEdit}
              onCancel={handleCancelEdit}
            />
          </Show>
        </HStack>
        <Spacer />
        <Button
          size="sm"
          colorPalette="red"
          disabled={busy()}
          onClick={async () => {
            if (!confirm("Delete this note? This cannot be undone.")) return;
            try {
              setBusy(true);
              console.log("[DocumentViewer] deleting docId=", props.doc?.id);
              const res = await apiFetch(`/api/docs/${props.doc.id}`, {
                method: "DELETE",
              });
              if (!res.ok) {
                const msg =
                  (await res.json().catch(() => ({})))?.error ||
                  "Failed to delete note";
                throw new Error(msg);
              }
              console.log("[DocumentViewer] deleted docId=", props.doc?.id);
              if (props.onDeleted) {
                try {
                  props.onDeleted();
                } catch (err) {
                  console.error("[DocumentViewer] onDeleted threw", err);
                }
              } else {
                navigate("/docs");
              }
            } catch (e) {
              console.error(e);
              alert((e as Error).message || "Failed to delete note");
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete Note
        </Button>
      </HStack>
      <Stack gap="3">
        <DocumentEditor docId={props.doc.id} />
      </Stack>

      {/* Inline properties moved to page-level top section in docs/[id].tsx */}
    </Box>
  );
};

export default DocumentViewer;
