import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Icon,
  List,
  Toast,
  showToast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import {
  archiveTask,
  assertAppReady,
  deleteTask,
  getStatus,
  listProjects,
  listTags,
  listTasks,
  startTask,
  stopCurrentTask,
  updateTask,
} from "../lib/sp-client";
import { getErrorMessage } from "../lib/sp-errors";
import { SpProject, SpTag, SpTask } from "../lib/sp-models";
import { SetupEmptyView } from "../lib/ui";
import { getTaskAccessories, getTaskIcon } from "./task-utils";
import { ReactElement, useMemo, useState } from "react";

interface TaskListViewProps {
  title: string;
  projectId?: string;
  tagId?: string;
}

interface TaskListData {
  tasks: SpTask[];
  currentTaskId: string | null;
  projects: SpProject[];
  tags: SpTag[];
}

const loadTaskData = async (filters: {
  projectId?: string;
  tagId?: string;
  includeDone: boolean;
}): Promise<TaskListData> => {
  await assertAppReady();
  const [tasks, status, projects, tags] = await Promise.all([
    listTasks({
      projectId: filters.projectId,
      tagId: filters.tagId,
      includeDone: filters.includeDone,
    }),
    getStatus(),
    listProjects(),
    listTags(),
  ]);

  return {
    tasks,
    currentTaskId: status.currentTaskId,
    projects,
    tags,
  };
};

export function TaskListView(props: TaskListViewProps): ReactElement {
  const [includeDone, setIncludeDone] = useState(false);
  const { data, error, isLoading, revalidate } = usePromise(loadTaskData, [
    { projectId: props.projectId, tagId: props.tagId, includeDone },
  ]);

  const projectById = useMemo(
    () =>
      new Map((data?.projects ?? []).map((project) => [project.id, project])),
    [data?.projects],
  );
  const tagById = useMemo(
    () => new Map((data?.tags ?? []).map((tag) => [tag.id, tag])),
    [data?.tags],
  );

  const runMutation = async (action: () => Promise<unknown>, title: string) => {
    try {
      await action();
      await showToast({ style: Toast.Style.Success, title });
      await revalidate();
    } catch (mutationError) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Action failed",
        message: getErrorMessage(mutationError),
      });
      await revalidate();
    }
  };

  const handleDelete = async (task: SpTask) => {
    const confirmed = await confirmAlert({
      title: `Delete "${task.title}"?`,
      message: "This permanently deletes the task in Super Productivity.",
      primaryAction: {
        title: "Delete Task",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) {
      return;
    }

    await runMutation(() => deleteTask(task.id), "Task deleted");
  };

  return (
    <List
      isLoading={isLoading}
      navigationTitle={props.title}
      searchBarPlaceholder="Filter tasks by title"
      isShowingDetail={false}
    >
      {error ? (
        <SetupEmptyView error={error} />
      ) : (
        (data?.tasks ?? []).map((task) => (
          <List.Item
            key={task.id}
            icon={getTaskIcon(task, data?.currentTaskId ?? null)}
            title={task.title}
            subtitle={
              task.notes ? task.notes.replace(/\s+/g, " ").trim() : undefined
            }
            accessories={getTaskAccessories(
              task,
              data?.currentTaskId ?? null,
              projectById,
              tagById,
            )}
            actions={
              <ActionPanel>
                {task.id === data?.currentTaskId ? (
                  <Action
                    title="Stop Current Task"
                    icon={{ source: Icon.Stop, tintColor: Color.Red }}
                    onAction={() =>
                      runMutation(
                        () => stopCurrentTask(),
                        "Current task stopped",
                      )
                    }
                  />
                ) : (
                  <Action
                    title="Start Task"
                    icon={{ source: Icon.Play, tintColor: Color.Green }}
                    onAction={() =>
                      runMutation(() => startTask(task.id), "Task started")
                    }
                  />
                )}
                <Action
                  title={task.isDone ? "Mark as Active" : "Mark as Completed"}
                  icon={task.isDone ? Icon.Circle : Icon.CheckCircle}
                  onAction={() =>
                    runMutation(
                      () =>
                        updateTask(task.id, {
                          isDone: !task.isDone,
                        }),
                      task.isDone
                        ? "Task marked active"
                        : "Task marked completed",
                    )
                  }
                />
                <Action
                  title="Archive Task"
                  icon={Icon.Archive}
                  onAction={() =>
                    runMutation(() => archiveTask(task.id), "Task archived")
                  }
                />
                <Action
                  title={
                    includeDone
                      ? "Hide Completed Tasks"
                      : "Show Completed Tasks"
                  }
                  icon={includeDone ? Icon.EyeDisabled : Icon.Eye}
                  onAction={() => setIncludeDone((current) => !current)}
                />
                <Action
                  title="Refresh"
                  icon={Icon.ArrowClockwise}
                  onAction={revalidate}
                />
                <Action
                  title="Delete Task"
                  icon={{ source: Icon.Trash, tintColor: Color.Red }}
                  style={Action.Style.Destructive}
                  onAction={() => handleDelete(task)}
                />
              </ActionPanel>
            }
          />
        ))
      )}
      {!error && !isLoading && (data?.tasks?.length ?? 0) === 0 ? (
        <List.EmptyView
          icon={Icon.List}
          title="No Tasks Found"
          description={
            includeDone
              ? "No tasks matched this view."
              : "No active tasks matched this view."
          }
        />
      ) : null}
    </List>
  );
}
