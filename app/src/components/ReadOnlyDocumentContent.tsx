import "highlight.js/styles/github.css";

import { Box } from "styled-system/jsx";
import { documentContentStyles } from "./document-content-styles";

type ReadOnlyDocumentContentProps = {
  html: string;
  class?: string;
};

export function ReadOnlyDocumentContent(props: ReadOnlyDocumentContentProps) {
  return (
    <Box
      class={props.class}
      borderWidth="1px"
      borderColor="gray.outline.border"
      borderRadius="l2"
      bg="bg.default"
      px={{ base: "4", md: "6" }}
      py={{ base: "4", md: "5" }}
      css={documentContentStyles}
    >
      <Box class="vn-doc-content" innerHTML={props.html} />
    </Box>
  );
}
