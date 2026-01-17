import type { Editor } from "@tiptap/core";
import { createEditorTransaction } from "solid-tiptap";
import { Toggle } from "./Toggle";

export function Control(props: {
  editor: Editor;
  title: string;
  name: string;
  onChange: () => void;
  isActive?: (editor: Editor) => boolean;
  children: any;
}) {
  const active = createEditorTransaction(
    () => props.editor,
    (instance) =>
      props.isActive ? props.isActive(instance) : instance.isActive(props.name)
  );
  return (
    <Toggle
      title={props.title}
      pressed={active()}
      onChange={props.onChange}
    >
      {props.children}
    </Toggle>
  );
}
