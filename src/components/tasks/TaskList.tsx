import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Task } from "./types";
import TaskSheet from "./TaskSheet";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LayoutList, FolderKanban, Plus, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { cleanupCompletedTodoTasks, getRecurringTasksForToday } from "@/utils/taskCleanup";

const TaskList = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [view, setView] = useState<"all" | "projects">("all");
  const [todoCollapsed, setTodoCollapsed] = useState(false);
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Schedule cleanup at midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const cleanupTimer = setTimeout(() => {
      cleanupCompletedTodoTasks();
      // Set up daily interval after first run
      setInterval(cleanupCompletedTodoTasks, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    return () => {
      clearTimeout(cleanupTimer);
    };
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      // Fetch regular tasks
      const { data: todoTasks, error: todoError } = await supabase
        .from("tasks")
        .select(`
          *,
          projects (
            name
          )
        `)
        .eq("type", "todo");

      if (todoError) throw todoError;

      // Fetch recurring tasks for today
      const recurringTasks = await getRecurringTasksForToday();

      // Combine and sort tasks
      const tasksWithProjects = [...(todoTasks || []), ...recurringTasks].map((task) => ({
        ...task,
        type: task.type === "todo" ? "Todo" : task.type === "recurring" ? "Recurring" : "Project",
      })) as Task[];

      const sortedTasks = tasksWithProjects.sort((a, b) => {
        if (a.completed === b.completed) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return a.completed ? 1 : -1;
      });
      
      setTasks(sortedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    // Fetch tasks when date changes
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        fetchTasks();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [fetchTasks]);

  const subscribeToTasks = useCallback(() => {
    const channel = supabase
      .channel("tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchTasks]);

  useEffect(() => {
    subscribeToTasks();
  }, [subscribeToTasks]);

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const { error } = await supabase
        .from("tasks")
        .update({ completed })
        .eq("id", taskId);

      if (error) throw error;

      // Optimistically update UI
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId ? { ...t, completed } : t
        )
      );
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case "High":
        return "border-red-500";
      case "Medium":
        return "border-yellow-500";
      case "Low":
        return "border-green-500";
      default:
        return "border-gray-200";
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none p-1 space-y-1">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">{view === "all" ? "All Tasks" : "Project Tasks"}</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <Button
                variant={view === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("all")}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "projects" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("projects")}
              >
                <FolderKanban className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTask(null);
                setIsSheetOpen(true);
              }}
              className="w-10 h-10 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-4">
          {/* To Do Section */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full flex justify-between items-center p-2 hover:bg-accent/50"
              onClick={() => setTodoCollapsed(!todoCollapsed)}
            >
              <div className="flex items-center gap-2">
                {todoCollapsed ? <ChevronRight className="h-2 w-2" /> : <ChevronDown className="h-4 w-4" />}
                <span className="font-semibold">To Do</span>
                <Badge variant="secondary" className="ml-2">
                  {tasks.filter(task => !task.completed).length}
                </Badge>
              </div>
            </Button>
            
            {!todoCollapsed && (
              <div className="space-y-2">
                {tasks
                  .filter(task => !task.completed)
                  .map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-4 p-4 bg-card hover:bg-accent/50 rounded-lg border-2 transition-colors cursor-pointer ${getPriorityBorder(task.priority)}`}
                      onClick={() => {
                        setSelectedTask(task);
                        setIsSheetOpen(true);
                      }}
                    >
                      <Checkbox 
                        checked={task.completed}
                        onCheckedChange={(checked) => {
                          handleToggleComplete(task.id, checked as boolean);
                          event?.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{task.name}</span>
                            {task.projects?.name && (
                              <Badge variant="outline" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {task.projects.name}
                              </Badge>
                            )}
                          </div>
                          <Badge variant={task.type === 'Recurring' ? 'secondary' : 'outline'}>
                            {task.type === 'Recurring' ? 'Recurring' : 'To Do'}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Due: {format(new Date(task.due_date), "MMM d, yyyy")}</span>
                          <span>{format(new Date(`2000-01-01T${task.due_time}`), "h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Done Section */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full flex justify-between items-center p-2 hover:bg-accent/50"
              onClick={() => setDoneCollapsed(!doneCollapsed)}
            >
              <div className="flex items-center gap-2">
                {doneCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="font-semibold">Done</span>
                <Badge variant="secondary" className="ml-2">
                  {tasks.filter(task => task.completed).length}
                </Badge>
              </div>
            </Button>
            
            {!doneCollapsed && (
              <div className="space-y-2">
                {tasks
                  .filter(task => task.completed)
                  .map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-4 p-4 bg-card hover:bg-accent/50 rounded-lg border-2 transition-colors cursor-pointer ${getPriorityBorder(task.priority)} opacity-50`}
                      onClick={() => {
                        setSelectedTask(task);
                        setIsSheetOpen(true);
                      }}
                    >
                      <Checkbox 
                        checked={task.completed}
                        onCheckedChange={(checked) => {
                          handleToggleComplete(task.id, checked as boolean);
                          event?.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <span className="font-medium">{task.name}</span>
                            {task.projects?.name && (
                              <Badge variant="outline" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {task.projects.name}
                              </Badge>
                            )}
                          </div>
                          <Badge variant={task.type === 'Recurring' ? 'secondary' : 'outline'}>
                            {task.type === 'Recurring' ? 'Recurring' : 'To Do'}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Due: {format(new Date(task.due_date), "MMM d, yyyy")}</span>
                          <span>{format(new Date(`2000-01-01T${task.due_time}`), "h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        task={selectedTask}
        onTaskUpdate={fetchTasks}
        onTaskDelete={fetchTasks}
      />
    </div>
  );
};

export default TaskList;