import { Show } from "solid-js";
import { css } from "styled-system/css";
import * as Field from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

const cell = css({
  minW: "0",
  display: "flex",
  flexDirection: "column",
  gap: "1.5",
  sm: { gridColumn: "var(--span)" },
});

/** One labelled text field in the place form grid. */
export function PlaceField(props: {
  id: string;
  label: string;
  span: number;
  value: string;
  onInput: (value: string) => void;
  type?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <Field.Root class={cell} style={{ "--span": `span ${props.span}` }}>
      <Field.Label for={props.id}>{props.label}</Field.Label>
      <Show
        when={props.multiline}
        fallback={
          <Input
            id={props.id}
            name={props.id}
            size="sm"
            type={props.type ?? "text"}
            inputMode={props.id.endsWith("itude") ? "decimal" : undefined}
            placeholder={props.placeholder}
            value={props.value}
            onInput={(e) => props.onInput(e.currentTarget.value)}
          />
        }
      >
        <Textarea
          id={props.id}
          name={props.id}
          size="sm"
          rows={3}
          value={props.value}
          onInput={(e) => props.onInput(e.currentTarget.value)}
        />
      </Show>
    </Field.Root>
  );
}
