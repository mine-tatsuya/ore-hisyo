import { AppLayout } from "@/components/layout/AppLayout";
import { TasksClient } from "./TasksClient";

export default function TasksPage() {
  return (
    <AppLayout>
      <TasksClient />
    </AppLayout>
  );
}
