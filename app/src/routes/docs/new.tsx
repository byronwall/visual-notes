import { type VoidComponent } from "solid-js";
import DocumentEditor from "~/components/DocumentEditor";
import { useNavigate } from "@solidjs/router";
import { Box, Container, Stack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";

export const NewDocRoute: VoidComponent = () => {
  const navigate = useNavigate();

  const handleCreated = (id: string) => {
    console.log("[new-doc] created id", id);
    navigate(`/docs/${id}`);
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container pt="4" pb={{ base: "24", md: "32" }} px="4">
        <Box mx="auto" maxW="900px">
          <Stack gap="3">
            <Heading as="h1" fontSize="2xl" m="0">
              New note
            </Heading>
            <Box as="article" class="prose" maxW="none">
              <DocumentEditor
                initialTitle="Untitled note"
                initialMarkdown={"# Untitled\n\nStart writing..."}
                onCreated={handleCreated}
              />
            </Box>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default NewDocRoute;
