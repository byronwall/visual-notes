import { type VoidComponent } from "solid-js";
import { Box } from "styled-system/jsx";
import { InPlaceEditableText } from "../InPlaceEditableText";

/**
 * The note's display title, editable in place. Shown when the note does not
 * open with a heading that already serves as its title.
 */
export const DocTitleField: VoidComponent<{
  value: string;
  placeholder: string;
  onCommit: (next: string) => Promise<void>;
}> = (props) => (
  <Box mb="4">
    <InPlaceEditableText
      value={props.value}
      placeholder={props.placeholder}
      onCommit={props.onCommit}
      fontSize="3xl"
      lineHeight="1.15"
      fontWeight="bold"
      fillWidth
      wrapPreview
    />
  </Box>
);
