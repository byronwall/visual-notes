import { Box } from "styled-system/jsx";

export const RecordingDot = () => (
  <Box
    as="span"
    boxSize="2.5"
    borderRadius="full"
    bg="red.9"
    flexShrink="0"
    animation="pulse 1.4s ease-in-out infinite"
    aria-hidden="true"
  />
);
