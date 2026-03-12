import type { Accessor, VoidComponent } from "solid-js";
import { Box, Flex } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";

export type ControlPanelProps = {
  navHeight: Accessor<number>;
  searchQuery: Accessor<string>;
  setSearchQuery: (value: string) => void;
};

export const ControlPanel: VoidComponent<ControlPanelProps> = (props) => {
  const handleSearchInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    props.setSearchQuery(target.value);
  };

  return (
    <Box
      position="absolute"
      zIndex="10"
      left="4"
      top="4"
      maxW="sm"
      w="calc(100vw - 2rem)"
      style={{
        transform: `translateY(${props.navHeight()}px)`,
      }}
    >
      <Flex
        align="center"
        gap="3"
        bg="bg.default"
        borderWidth="1px"
        borderColor="border"
        borderRadius="l3"
        boxShadow="lg"
        px="4"
        py="3"
        style={{
          background: "rgba(255,255,255,0.92)",
          "backdrop-filter": "blur(12px)",
        }}
      >
        <Text fontSize="lg" fontWeight="semibold">
          Canvas
        </Text>
        <Box flex="0 1 19rem" minW="12rem">
          <Input
            size="sm"
            type="search"
            placeholder="Search notes"
            value={props.searchQuery()}
            onInput={handleSearchInput}
          />
        </Box>
      </Flex>
    </Box>
  );
};
