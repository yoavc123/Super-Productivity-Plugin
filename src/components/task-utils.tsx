import { Color, Icon, List } from "@raycast/api";
import { SpProject, SpTag, SpTask } from "../lib/sp-models";

const formatMinutes = (timeEstimate: number): string | null => {
  if (!timeEstimate) {
    return null;
  }
  const minutes = Math.round(timeEstimate / 60000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

export const getTaskAccessories = (
  task: SpTask,
  currentTaskId: string | null,
  projectById: Map<string, SpProject>,
  tagById: Map<string, SpTag>,
): List.Item.Accessory[] => {
  const accessories: List.Item.Accessory[] = [];

  if (task.id === currentTaskId) {
    accessories.push({
      icon: { source: Icon.Play, tintColor: Color.Green },
      tooltip: "Current task",
    });
  }

  if (task.parentId) {
    accessories.push({ icon: Icon.ArrowRight, tooltip: "Subtask" });
  }

  if (task.projectId && projectById.has(task.projectId)) {
    accessories.push({
      text: projectById.get(task.projectId)?.title ?? task.projectId,
      tooltip: "Project",
    });
  }

  if (task.tagIds.length) {
    const tagNames = task.tagIds
      .map((id) => tagById.get(id)?.title ?? id)
      .slice(0, 2);
    accessories.push({ text: tagNames.join(", "), tooltip: "Tags" });
  }

  if (task.dueDay) {
    accessories.push({ date: new Date(task.dueDay), tooltip: "Due date" });
  }

  const estimate = formatMinutes(task.timeEstimate);
  if (estimate) {
    accessories.push({ text: estimate, tooltip: "Estimate" });
  }

  return accessories;
};

export const getTaskIcon = (task: SpTask, currentTaskId: string | null) => {
  if (task.id === currentTaskId) {
    return { source: Icon.PlayFilled, tintColor: Color.Green };
  }
  if (task.isDone) {
    return { source: Icon.CheckCircle, tintColor: Color.Green };
  }
  if (task.parentId) {
    return { source: Icon.Dot, tintColor: Color.SecondaryText };
  }
  return Icon.Circle;
};
