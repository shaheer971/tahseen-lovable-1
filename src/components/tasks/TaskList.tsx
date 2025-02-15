import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import CreateTaskDialog from "./CreateTaskDialog";
import TaskSheet from "./TaskSheet";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const TaskList = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, []);

  const validatePriority = (priority: string): "Low" | "Medium" | "High" => {
    const validPriorities = ["Low", "Medium", "High"];
    const normalizedPriority = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
    return validPriorities.includes(normalizedPriority) 
      ? normalizedPriority as "Low" | "Medium" | "High"
      : "Medium";
  };

  const validateType = (type: string): "Todo" | "Recurring" | "Project" => {
    const validTypes = ["Todo", "Recurring", "Project"];
    const normalizedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    return validTypes.includes(normalizedType)
      ? normalizedType as "Todo" | "Recurring" | "Project"
      : "Todo";
  };

  const fetchTasks = async () => {
    try {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
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

      if (error) throw error;

      const tasksWithSubtasks = await Promise.all(
        data.map(async (task) => {
          const { data: subtasks } = await supabase
            .from("tasks")
            .select("*")
            .eq("parent_task_id", task.id)
            .eq("is_subtask", true)
            .order("position");

          const processedTask: Task = {
            ...task,
            priority: validatePriority(task.priority),
            type: validateType(task.type),
            completed: task.completed || false,
            recurring_days: task.recurring_days || [],
            description: task.description || "",
            project_id: task.project_id || null,
            projects: task.projects || null,
            is_subtask: task.is_subtask || false,
            subtasks: (subtasks || []).map(st => ({
              ...st,
              priority: validatePriority(st.priority),
              type: validateType(st.type),
              completed: st.completed || false,
              recurring_days: st.recurring_days || [],
              is_subtask: true,
            })) as Task[]
          };

          return processedTask;
        })
      );

      setTasks(tasksWithSubtasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      await supabase
        .from("tasks")
        .update({ completed })
        .eq("id", taskId);

      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, completed } : task
        )
      );

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error) {
      console.error("Error updating task completion:", error);
      toast({
        title: "Error",
        description: "Failed to update task completion",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsSheetOpen(false);
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "border-red-500 text-red-500";
      case "Medium":
        return "border-yellow-500 text-yellow-500";
      case "Low":
        return "border-green-500 text-green-500";
      default:
        return "";
    }
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    const reorderedTasks = Array.from(tasks);
    const [movedTask] = reorderedTasks.splice(sourceIndex, 1);
    reorderedTasks.splice(destinationIndex, 0, movedTask);

    setTasks(reorderedTasks);

    try {
      const updates = reorderedTasks.map((task, index) =>
        supabase
          .from("tasks")
          .update({ position: index })
          .eq("id", task.id)
      );

      await Promise.all(updates);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error) {
      console.error("Error updating task positions:", error);
      toast({
        title: "Error",
        description: "Failed to update task positions",
        variant: "destructive",
      });
      fetchTasks();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Tasks</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="tasks">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              <ScrollArea className="h-[calc(100vh-350px)]">
                {tasks.map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={cn(
                          "bg-card border rounded-lg shadow-sm p-4 hover:bg-accent/50 cursor-grab transition-colors",
                          task.completed && "opacity-50"
                        )}
                        onClick={() => {
                          setSelectedTask(task);
                          setIsSheetOpen(true);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold">{task.name}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground">
                                {task.description}
                              </p>
                            )}
                            {task.project_id && task.projects?.name && (
                              <Badge variant="secondary">{task.projects.name}</Badge>
                            )}
                          </div>
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={(checked) => {
                              handleToggleComplete(task.id, checked as boolean);
                            }}
                          />
                        </div>
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="mt-4 pl-4 space-y-2 border-l">
                            {task.subtasks.map((subtask) => (
                              <div
                                key={subtask.id}
                                className="flex items-center justify-between"
                              >
                                <span className={cn(
                                  "text-sm",
                                  subtask.completed && "line-through text-muted-foreground"
                                )}>
                                  {subtask.name}
                                </span>
                                <Checkbox
                                  checked={subtask.completed}
                                  onCheckedChange={(checked) => {
                                    handleToggleComplete(subtask.id, checked as boolean);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div>
                              Due Date: {format(new Date(task.due_date), "MMM d, yyyy")}
                            </div>
                            <div>
                              Time: {format(new Date(`2000-01-01T${task.due_time}`), "h:mm a")}
                            </div>
                          </div>
                          <Badge variant="outline" className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ScrollArea>
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <CreateTaskDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
      <TaskSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        task={selectedTask}
        onTaskUpdate={fetchTasks}
        onTaskDelete={handleDeleteTask}
      />
    </div>
  );
};

export default TaskList;
