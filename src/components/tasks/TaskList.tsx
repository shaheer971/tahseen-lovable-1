
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Task } from "./types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CreateTaskDialog from "./CreateTaskDialog";
import TaskSheet from "./TaskSheet";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TaskListItemProps {
  task: Task;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  isSubtask?: boolean;
}

const TaskListItem = ({ task, onToggleComplete, onEditTask, onDeleteTask, isSubtask = false }: TaskListItemProps) => {
  const [showSubtasks, setShowSubtasks] = useState(true);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  return (
    <div className={cn("space-y-2", isSubtask && "ml-6")}>
      <div className="flex items-center gap-2 group">
        <Checkbox
          checked={task.completed}
          onCheckedChange={(checked) => onToggleComplete(task.id, checked as boolean)}
        />
        <div className="flex-1 flex items-center gap-2">
          {hasSubtasks && (
            <button
              onClick={() => setShowSubtasks(!showSubtasks)}
              className="h-4 w-4 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {showSubtasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
          <span className={cn(
            "flex-1",
            task.completed && "line-through text-muted-foreground"
          )}>{task.name}</span>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEditTask(task)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteTask(task.id)}
          >
            Delete
          </Button>
        </div>
      </div>

      {hasSubtasks && (
        <Collapsible open={showSubtasks} onOpenChange={setShowSubtasks}>
          <CollapsibleContent className="space-y-2">
            {task.subtasks?.map((subtask) => (
              <TaskListItem
                key={subtask.id}
                task={subtask}
                onToggleComplete={onToggleComplete}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                isSubtask={true}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

const TaskList = () => {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [session]);

  const fetchTasks = async () => {
    try {
      if (!session?.user?.id) return;

      const { data: mainTasks, error: mainTasksError } = await supabase
        .from("tasks")
        .select(`
          *,
          projects (
            name
          )
        `)
        .eq("user_id", session.user.id)
        .eq("is_subtask", false)
        .order("completed", { ascending: true })
        .order("priority", { ascending: false })
        .order("position");

      if (mainTasksError) throw mainTasksError;

      // Fetch subtasks for each main task and ensure proper typing
      const tasksWithSubtasks = await Promise.all(
        (mainTasks || []).map(async (task) => {
          const { data: subtasks, error: subtasksError } = await supabase
            .from("tasks")
            .select("*")
            .eq("parent_task_id", task.id)
            .eq("is_subtask", true)
            .order("position");

          if (subtasksError) throw subtasksError;

          // Ensure proper typing for the main task and its subtasks
          const typedTask: Task = {
            ...task,
            priority: task.priority as "Low" | "Medium" | "High",
            type: task.type as "Todo" | "Recurring" | "Project",
            subtasks: (subtasks || []).map(subtask => ({
              ...subtask,
              priority: subtask.priority as "Low" | "Medium" | "High",
              type: subtask.type as "Todo" | "Recurring" | "Project"
            }))
          };

          return typedTask;
        })
      );

      setTasks(tasksWithSubtasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ completed })
        .eq("id", taskId);

      if (error) throw error;

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? { ...task, completed } : task
        )
      );
    } catch (error) {
      console.error("Error toggling task completion:", error);
      toast({
        title: "Error",
        description: "Failed to toggle task completion",
        variant: "destructive",
      });
    }
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          Add Task
        </Button>
      </div>

      {loading ? (
        <div>Loading tasks...</div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTaskDialog
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSuccess={fetchTasks}
        />
      )}

      {selectedTask && (
        <TaskSheet
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          task={selectedTask}
          onTaskUpdate={fetchTasks}
          onTaskDelete={handleDeleteTask}
        />
      )}
    </div>
  );
};

export default TaskList;
