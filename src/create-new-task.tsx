import {
  Action,
  ActionPanel,
  Form,
  Icon,
  Toast,
  showToast,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { ReactElement, useMemo, useState } from "react";
import {
  assertAppReady,
  createTask,
  listProjects,
  listTags,
  listTasks,
} from "./lib/sp-client";
import { getErrorMessage } from "./lib/sp-errors";
import { SpProject, SpTag, SpTask } from "./lib/sp-models";
import { SetupDetail } from "./lib/ui";

type TaskMode = "task" | "subtask";

interface FormValues {
  mode: TaskMode;
  title: string;
  notes?: string;
  projectId?: string;
  tagIds?: string[];
  dueDate?: Date;
  plannedAt?: Date;
  timeEstimateMinutes?: string;
  parentId?: string;
}

interface CreateTaskFormData {
  projects: SpProject[];
  tags: SpTag[];
  parentTasks: SpTask[];
}

const toDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseEstimateMinutes = (value?: string): number | undefined => {
  if (!value?.trim()) {
    return undefined;
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error("Time estimate must be a non-negative number of minutes");
  }
  return Math.round(numericValue * 60000);
};

const loadFormData = async (): Promise<CreateTaskFormData> => {
  await assertAppReady();
  const [projects, tags, tasks] = await Promise.all([
    listProjects(),
    listTags(),
    listTasks(),
  ]);
  return {
    projects,
    tags,
    parentTasks: tasks.filter((task) => !task.parentId && !task.isDone),
  };
};

export default function Command(): ReactElement {
  const [mode, setMode] = useState<TaskMode>("task");
  const { data, error, isLoading } = usePromise(loadFormData);

  const parentTaskOptions = useMemo(
    () =>
      (data?.parentTasks ?? []).map((task) => ({
        ...task,
        projectTitle: data?.projects.find(
          (project) => project.id === task.projectId,
        )?.title,
      })),
    [data?.parentTasks, data?.projects],
  );

  const handleSubmit = async (values: FormValues) => {
    try {
      const payload =
        values.mode === "subtask"
          ? {
              title: values.title,
              notes: values.notes,
              dueDay: values.dueDate ? toDateString(values.dueDate) : undefined,
              plannedAt: values.plannedAt
                ? values.plannedAt.getTime()
                : undefined,
              timeEstimate: parseEstimateMinutes(values.timeEstimateMinutes),
              parentId: values.parentId,
            }
          : {
              title: values.title,
              notes: values.notes,
              projectId: values.projectId || undefined,
              tagIds: values.tagIds ?? [],
              dueDay: values.dueDate ? toDateString(values.dueDate) : undefined,
              plannedAt: values.plannedAt
                ? values.plannedAt.getTime()
                : undefined,
              timeEstimate: parseEstimateMinutes(values.timeEstimateMinutes),
            };

      if (values.mode === "subtask" && !values.parentId) {
        throw new Error("Select a parent task for the subtask");
      }

      await createTask(payload);
      await showToast({
        style: Toast.Style.Success,
        title: values.mode === "subtask" ? "Subtask created" : "Task created",
      });
    } catch (submitError) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Could not create task",
        message: getErrorMessage(submitError),
      });
    }
  };

  if (error) {
    return <SetupDetail error={error} />;
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Create New Task"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={mode === "subtask" ? "Create Subtask" : "Create Task"}
            icon={Icon.Plus}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="mode"
        title="Creation Mode"
        value={mode}
        onChange={(value) => setMode(value as TaskMode)}
      >
        <Form.Dropdown.Item value="task" title="Top-level Task" />
        <Form.Dropdown.Item value="subtask" title="Subtask" />
      </Form.Dropdown>

      <Form.TextField
        id="title"
        title="Title"
        placeholder="Write a task title"
      />
      <Form.TextArea id="notes" title="Notes" placeholder="Optional notes" />

      {mode === "subtask" ? (
        <Form.Dropdown
          id="parentId"
          title="Parent Task"
          placeholder="Choose a top-level task"
          storeValue
          filtering
        >
          {parentTaskOptions.map((task) => (
            <Form.Dropdown.Item
              key={task.id}
              value={task.id}
              title={task.title}
              keywords={task.projectTitle ? [task.projectTitle] : undefined}
            />
          ))}
        </Form.Dropdown>
      ) : (
        <>
          <Form.Dropdown
            id="projectId"
            title="Project"
            placeholder="Optional project"
          >
            <Form.Dropdown.Item value="" title="Inbox / No Project" />
            {(data?.projects ?? []).map((project) => (
              <Form.Dropdown.Item
                key={project.id}
                value={project.id}
                title={project.title}
              />
            ))}
          </Form.Dropdown>

          <Form.TagPicker id="tagIds" title="Tags">
            {(data?.tags ?? []).map((tag) => (
              <Form.TagPicker.Item
                key={tag.id}
                value={tag.id}
                title={tag.title}
              />
            ))}
          </Form.TagPicker>
        </>
      )}

      <Form.DatePicker
        id="dueDate"
        title="Due Date"
        type={Form.DatePicker.Type.Date}
      />
      <Form.DatePicker
        id="plannedAt"
        title="Planned Time"
        type={Form.DatePicker.Type.DateTime}
      />
      <Form.TextField
        id="timeEstimateMinutes"
        title="Time Estimate (minutes)"
        placeholder="Optional estimate in minutes"
      />
    </Form>
  );
}
