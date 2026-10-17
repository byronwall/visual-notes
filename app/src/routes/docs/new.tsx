import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { createSignal, type VoidComponent } from "solid-js";
import { Box, Container, HStack } from "styled-system/jsx";
import DocumentEditor, {
  type DocumentEditorApi,
} from "~/components/DocumentEditor";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";

// An empty H1 + paragraph: placeholders ("Untitled", "Start writing…") come
// from CSS, so there is no sample text to delete before typing.
const BLANK_NOTE_HTML = "<h1></h1><p></p>";

export const NewDocRoute: VoidComponent = () => {
  const navigate = useNavigate();
  const [api, setApi] = createSignal<DocumentEditorApi>();

  const handleCreated = (id: string) => {
    console.info("[new-doc] created id", id);
    navigate(`/docs/${id}`);
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>New note • Visual Notes</Title>
      <Container
        pt={{ base: "3", md: "4" }}
        pb="24"
        px={{ base: "4", md: "6" }}
      >
        <Box as="article" class="prose" mx="auto" maxW="46rem">
          <HStack
            gap="2"
            justifyContent="space-between"
            alignItems="center"
            mb="2"
            minH="8"
          >
            <Text
              fontSize="xs"
              color={api()?.error() ? "red.11" : "fg.subtle"}
              role={api()?.error() ? "alert" : undefined}
            >
              {api()?.error() ?? "Draft · not saved yet"}
            </Text>
            <Button
              size="sm"
              variant="solid"
              disabled={!api()?.canSave()}
              loading={api()?.saving()}
              onClick={() => void api()?.save()}
            >
              Create note
            </Button>
          </HStack>
          <DocumentEditor
            initialTitle=""
            initialHTML={BLANK_NOTE_HTML}
            onCreated={handleCreated}
            apiRef={setApi}
            showTopBar={false}
            showNewDocTitleField={false}
            preferH1TitleForNewDoc
            hideInlineError
            focusOnMount
            borderless
            minEditorHeight="50vh"
          />
        </Box>
      </Container>
    </Box>
  );
};

export default NewDocRoute;
