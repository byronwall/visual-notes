import { useAction, useNavigate } from "@solidjs/router";
import { PlusIcon } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { Kbd } from "~/components/ui/kbd";
import { SimplePopover } from "~/components/ui/simple-popover";
import { createDoc } from "~/services/docs.service";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inputClass = css({
  w: "320px",
  maxW: "full",
  h: "9",
  px: "2.5",
  borderRadius: "l2",
  bg: "bg.muted",
  fontSize: "sm",
  outline: "none",
  _placeholder: { color: "fg.subtle" },
  _focusVisible: { bg: "bg.default", boxShadow: "0 0 0 1px token(colors.gray.7)" },
});

export const PathQuickCreate = (props: {
  path: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const navigate = useNavigate();
  const runCreate = useAction(createDoc);
  const [title, setTitle] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  const close = () => {
    props.onOpenChange(false);
    setError("");
  };

  const submit = async () => {
    const value = title().trim();
    if (!value || saving()) return;
    setSaving(true);
    setError("");
    try {
      const created = await runCreate({
        title: value,
        markdown: `# ${value}\n`,
        html: `<h1>${escapeHtml(value)}</h1>`,
        path: props.path,
      });
      setTitle("");
      props.onOpenChange(false);
      navigate(`/docs/${created.id}`);
    } catch (err) {
      console.error("[path-view] quick create failed", err);
      setError("Could not create the note. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SimplePopover
      open={props.open}
      onClose={close}
      placement="bottom-end"
      offset={6}
      class={css({ p: "3", maxW: "calc(100vw - 32px)" })}
      anchor={
        <Button
          size="sm"
          variant="outline"
          onClick={() => props.onOpenChange(!props.open)}
          title="New note at this path (N)"
          aria-label="New note"
        >
          <PlusIcon size={14} />
          {/* Icon-only on phones so the path title keeps the row. */}
          <span class={css({ display: { base: "none", sm: "inline" } })}>New note</span>
          <Kbd size="sm" display={{ base: "none", md: "inline-flex" }}>
            N
          </Kbd>
        </Button>
      }
    >
      <form
        class={css({ display: "flex", flexDirection: "column", gap: "2" })}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label for="path-quick-create-title" class={css({ fontSize: "xs", color: "fg.muted" })}>
          New note in{" "}
          <span class={css({ fontFamily: "mono", color: "fg.default" })}>{props.path}</span>
        </label>
        <input
          id="path-quick-create-title"
          class={inputClass}
          value={title()}
          onInput={(event) => setTitle(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          placeholder="Title"
          maxLength={200}
        />
        <div class={css({ display: "flex", alignItems: "center", gap: "2" })}>
          <span class={css({ flex: "1", fontSize: "xs", color: "red.11", minH: "4" })}>
            <Show when={error()}>{error()}</Show>
          </span>
          <Button size="xs" variant="plain" type="button" onClick={close}>
            Cancel
          </Button>
          <Button
            size="xs"
            variant="solid"
            type="submit"
            disabled={!title().trim()}
            loading={saving()}
          >
            Create
          </Button>
        </div>
      </form>
    </SimplePopover>
  );
};
