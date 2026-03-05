import { Meta, Title } from "@solidjs/meta";
import { Container } from "styled-system/jsx";
import { TaskListsWorkspace } from "~/components/tasks/TaskListsWorkspace";

const TasksPage = () => {
  return (
    <Container
      py="3"
      px="4"
      maxW="7xl"
      h="100dvh"
      minH="0"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <Title>Tasks • Visual Notes</Title>
      <Meta property="og:title" content="Tasks • Visual Notes" />
      <Meta
        name="description"
        content="Manage named task lists with hierarchy, status, and due dates."
      />
      <TaskListsWorkspace />
    </Container>
  );
};

export default TasksPage;
