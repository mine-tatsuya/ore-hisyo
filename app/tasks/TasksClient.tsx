"use client";

import { useRouter } from "next/navigation";
import { TaskList } from "@/components/tasks/TaskList";

export function TasksClient() {
  const router = useRouter();

  const handleReschedule = () => {
    router.push("/schedule?mode=reschedule");
  };

  return <TaskList onReschedule={handleReschedule} />;
}
