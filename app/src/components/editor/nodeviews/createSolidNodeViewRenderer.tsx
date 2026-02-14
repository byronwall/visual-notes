import {
  type NodeViewRenderer,
  type NodeViewRendererOptions,
  type NodeViewRendererProps,
} from "@tiptap/core";
import { createMemo, createSignal, type Component } from "solid-js";
import { Dynamic, render } from "solid-js/web";
import {
  SolidNodeViewContext,
  type SolidNodeViewState,
} from "./useSolidNodeView";

type SolidNodeViewRendererOptions = NodeViewRendererOptions & {
  useDomAsContentDOM?: boolean;
  setSelection?: (
    anchor: number,
    head: number,
    root: Document | ShadowRoot
  ) => void;
  update?: (args: {
    oldNode: NodeViewRendererProps["node"];
    oldDecorations: NodeViewRendererProps["decorations"];
    newNode: NodeViewRendererProps["node"];
    newDecorations: NodeViewRendererProps["decorations"];
    updateProps: () => void;
  }) => boolean;
};

function createInitialState(
  props: NodeViewRendererProps
): SolidNodeViewState {
  return {
    editor: props.editor,
    node: props.node,
    decorations: props.decorations,
    innerDecorations: props.innerDecorations,
    selected: false,
    extension: props.extension,
    HTMLAttributes: props.HTMLAttributes,
    view: props.view,
    getPos: () => props.getPos(),
    updateAttributes: (attributes = {}) =>
      props.editor
        .chain()
        .focus()
        .updateAttributes(props.node.type.name, attributes)
        .run(),
    deleteNode: () => {
      const pos = props.getPos();
      if (typeof pos !== "number") return;
      const transaction = props.editor.state.tr.delete(
        pos,
        pos + props.node.nodeSize
      );
      props.editor.view.dispatch(transaction);
    },
  };
}

export function createSolidNodeViewRenderer(
  component: Component,
  options?: Partial<SolidNodeViewRendererOptions>
): NodeViewRenderer {
  return (props: NodeViewRendererProps) => {
    let node = props.node;
    let decorations = props.decorations;
    const useDomAsContentDOM = options?.useDomAsContentDOM === true;

    const contentDOMElement = props.node.isLeaf || useDomAsContentDOM
      ? null
      : document.createElement(
          options?.contentDOMElementTag || (props.node.isInline ? "span" : "div")
        );

    if (contentDOMElement) {
      contentDOMElement.style.whiteSpace = "inherit";
    }

    const onDragStart = (event: DragEvent) => {
      const pos = props.getPos();
      if (typeof pos !== "number") return;
      props.editor.chain().setNodeSelection(pos).run();
    };

    const [state, setState] = createSignal<SolidNodeViewState>({
      ...createInitialState(props),
      onDragStart,
    });

    const NodeViewProvider: Component = () => {
      const dynamicComponent = createMemo(() => component);
      return (
        <SolidNodeViewContext.Provider value={{ state }}>
          <Dynamic component={dynamicComponent()} />
        </SolidNodeViewContext.Provider>
      );
    };

    const mount = document.createElement("div");
    const dispose = render(() => <NodeViewProvider />, mount);

    const renderedRoot = mount.firstElementChild as HTMLElement | null;
    const dom = renderedRoot || document.createElement(props.node.isInline ? "span" : "div");

    const maybeMoveContentDOM = () => {
      if (!contentDOMElement) return;
      const content = dom.querySelector("[data-node-view-content]");
      if (!content) return;
      if (!content.contains(contentDOMElement)) {
        content.append(contentDOMElement);
      }
    };

    maybeMoveContentDOM();

    const updateProps = (next: Partial<SolidNodeViewState>) => {
      setState((prev) => ({ ...prev, ...next }));
      maybeMoveContentDOM();
    };

    return {
      dom,
      get contentDOM() {
        if (node.isLeaf) return null;
        if (useDomAsContentDOM) return dom;
        maybeMoveContentDOM();
        return contentDOMElement;
      },
      update(
        nextNode: NodeViewRendererProps["node"],
        nextDecorations: NodeViewRendererProps["decorations"]
      ) {
        if (nextNode.type !== node.type) {
          return false;
        }

        if (typeof options?.update === "function") {
          const oldNode = node;
          const oldDecorations = decorations;

          node = nextNode;
          decorations = nextDecorations;

          return options.update({
            oldNode,
            oldDecorations,
            newNode: nextNode,
            newDecorations: nextDecorations,
            updateProps: () =>
              updateProps({ node: nextNode, decorations: nextDecorations }),
          });
        }

        if (nextNode === node && nextDecorations === decorations) {
          return true;
        }

        node = nextNode;
        decorations = nextDecorations;
        updateProps({ node: nextNode, decorations: nextDecorations });
        return true;
      },
      ...(options?.setSelection
        ? {
            setSelection(anchor: number, head: number, root: Document | ShadowRoot) {
              options.setSelection?.(anchor, head, root);
            },
          }
        : {}),
      stopEvent(event: Event) {
        if (options?.stopEvent) {
          return options.stopEvent({ event });
        }

        const target = event.target as HTMLElement | null;
        if (!target) return false;
        const contentDOM = useDomAsContentDOM ? dom : contentDOMElement;
        const isInElement =
          dom.contains(target) && !(contentDOM && contentDOM.contains(target));
        if (!isInElement) return false;

        // Default behavior: keep native form-control interactions inside
        // node views from being intercepted by ProseMirror.
        const control = target.closest(
          "input, button, select, textarea, summary, [contenteditable='true']"
        );
        return !!control;
      },
      ignoreMutation(
        mutation: Parameters<
          NonNullable<NodeViewRendererOptions["ignoreMutation"]>
        >[0]["mutation"]
      ) {
        if (!options?.ignoreMutation) return false;
        return options.ignoreMutation({ mutation });
      },
      selectNode() {
        dom.classList.add("ProseMirror-selectednode");
        updateProps({ selected: true });
      },
      deselectNode() {
        dom.classList.remove("ProseMirror-selectednode");
        updateProps({ selected: false });
      },
      destroy() {
        dispose();
      },
    };
  };
}
