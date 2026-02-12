import { Box } from "styled-system/jsx";

export function Separator() {
  return (
    <Box
      display={{ base: "none", md: "flex" }}
      alignItems="center"
      aria-hidden="true"
    >
      <Box h="full" borderLeftWidth="1px" borderColor="gray.outline.border" />
    </Box>
  );
}
