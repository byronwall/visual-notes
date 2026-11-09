import { useAction } from "@solidjs/router";
import { Trash2Icon } from "lucide-solid";
import { createSignal, For, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { toaster } from "~/components/ui/toast";
import {
  ANNOTATION_COLORS,
  type AnnotationTypeView,
} from "~/lib/annotations/types";
import {
  createAnnotationTypeAction,
  deleteAnnotationTypeAction,
  updateAnnotationTypeAction,
} from "~/services/annotations/annotations.actions";
import { swatchStyle, useAnnotationLayer } from "./annotation-context";

// Manage annotation types: name, color, whether agents act on it, and which
// type a new highlight starts with.

const ColorPicker: VoidComponent<{
  value: string;
  onChange: (color: string) => void;
}> = (props) => (
  <HStack gap="1">
    <For each={ANNOTATION_COLORS}>
      {(color) => (
        <button
          type="button"
          aria-label={color}
          aria-pressed={props.value === color}
          onClick={() => props.onChange(color)}
          style={{
            ...swatchStyle(color, 9),
            width: "16px",
            height: "16px",
            "border-radius": "999px",
            outline:
              props.value === color
                ? "2px solid var(--colors-fg-default)"
                : "none",
            "outline-offset": "1px",
          }}
        />
      )}
    </For>
  </HStack>
);

const ForAi: VoidComponent<{
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}> = (props) => (
  <Checkbox.Root
    checked={props.checked}
    disabled={props.disabled}
    onCheckedChange={(details) => props.onChange(details.checked === true)}
    size="sm"
  >
    <Checkbox.HiddenInput />
    <Checkbox.Control>
      <Checkbox.Indicator />
    </Checkbox.Control>
    <Checkbox.Label fontSize="xs">For AI</Checkbox.Label>
  </Checkbox.Root>
);

export const AnnotationTypesDialog: VoidComponent<{
  open: boolean;
  onClose: () => void;
}> = (props) => {
  const layer = useAnnotationLayer();
  const runCreate = useAction(createAnnotationTypeAction);
  const runUpdate = useAction(updateAnnotationTypeAction);
  const runDelete = useAction(deleteAnnotationTypeAction);
  const [name, setName] = createSignal("");
  const [color, setColor] = createSignal<string>("blue");
  const [forAi, setForAi] = createSignal(false);

  const attempt = async (run: () => Promise<unknown>) => {
    try {
      await run();
      layer.refresh();
    } catch (error) {
      toaster.create({
        title: (error as Error).message || "Could not save",
        type: "error",
      });
    }
  };

  const row = (type: AnnotationTypeView) => (
    <HStack
      gap="3"
      py="1.5"
      borderBottomWidth="1px"
      borderColor="border"
      data-testid="annotation-type-row"
    >
      <ColorPicker
        value={type.color}
        onChange={(c) =>
          void attempt(() => runUpdate({ id: type.id, color: c }))
        }
      />
      <Input
        size="sm"
        flex="1"
        value={type.name}
        onChange={(event) =>
          void attempt(() =>
            runUpdate({ id: type.id, name: event.currentTarget.value }),
          )
        }
      />
      <ForAi
        checked={type.forAi}
        disabled={type.builtIn === "request"}
        onChange={(v) =>
          void attempt(() => runUpdate({ id: type.id, forAi: v }))
        }
      />
      <Button
        size="2xs"
        variant={type.isDefault ? "solid" : "outline"}
        disabled={type.isDefault}
        onClick={() =>
          void attempt(() => runUpdate({ id: type.id, isDefault: true }))
        }
      >
        {type.isDefault ? "Default" : "Make default"}
      </Button>
      <IconButton
        size="2xs"
        variant="plain"
        aria-label={`Delete ${type.name}`}
        disabled={Boolean(type.builtIn) || type.isDefault}
        onClick={() => void attempt(() => runDelete(type.id))}
      >
        <Trash2Icon />
      </IconButton>
    </HStack>
  );

  return (
    <SimpleDialog
      open={props.open}
      onClose={props.onClose}
      title="Annotation types"
      maxW="40rem"
      phoneSheet
    >
      <Stack gap="3">
        <Box fontSize="sm" color="fg.muted">
          Agents act on types marked For AI. They can read every type as
          context.
        </Box>
        <Box>
          <For each={layer.types()}>{row}</For>
        </Box>
        <HStack gap="3">
          <ColorPicker value={color()} onChange={setColor} />
          <Input
            size="sm"
            flex="1"
            placeholder="New type name"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <ForAi checked={forAi()} onChange={setForAi} />
          <Button
            size="xs"
            disabled={!name().trim()}
            onClick={() =>
              void attempt(async () => {
                await runCreate({
                  name: name(),
                  color: color(),
                  forAi: forAi(),
                });
                setName("");
              })
            }
          >
            Add type
          </Button>
        </HStack>
      </Stack>
    </SimpleDialog>
  );
};
