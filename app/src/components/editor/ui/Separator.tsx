import { Box } from "styled-system/jsx";

export function Separator() {
  return (
    <Box
      display={{ base: "none", md: "flex" }}
      alignItems="center"
      aria-hidden="true"
    >
      <Box h="4" mx="1" borderLeftWidth="1px" borderColor="border" />
    </Box>
  );
}
