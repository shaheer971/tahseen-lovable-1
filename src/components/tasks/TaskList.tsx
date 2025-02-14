import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Task } from "./types";
import TaskSheet from "./TaskSheet";
import { format, parse } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LayoutList, FolderKanban, Plus, Tag, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cleanupCompletedTodoTasks, getRecurringTasksForToday, cleanupOldRecurringCompletions, createCompletedRecurringTaskInstance } from "@/utils/taskCleanup";

const getPriorityBadgeVariant = (priority: "Low" | "Medium" | "High"): "outline" | "default" | "destructive" | "secondary" => {
  switch (priority) {
    case "High":
      return "destructive";
    case "Medium":
      return "secondary";
    case "Low":
      return "outline";
    default:
      return "outline";
  }
};

const TaskList = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [view, setView] = useState<"all" | "projects">("all");
  const [todoCollapsed, setTodoCollapsed] = useState(false);
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const cleanupTimer = setTimeout(() => {
      cleanupCompletedTodoTasks();
      cleanupOldRecurringCompletions();
      setInterval(() => {
        cleanupCompletedTodoTasks();
        cleanupOldRecurringCompletions();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    return () => {
      clearTimeout(cleanupTimer);
    };
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      let query = supabase
        .from("tasks")
        .select(`
          *,
          projects (
            name
          )
        `);

      if (view === "projects") {
        query = query
          .not("project_id", "is", null)
          .eq("completed", false);
      } else {
        const { data: allTasks, error: tasksError } = await query;
        if (tasksError) throw tasksError;

        const todoTasks = (allTasks || []).filter(task => task.type === "Todo");
        const today = new Date();
        const dayOfWeek = today.getDay().toString();
        const recurringTasks = (allTasks || [])
          .filter(task => 
            task.type === "Recurring" && 
            task.recurring_days?.includes(dayOfWeek)
          );

        const tasksWithProjects = [...todoTasks, ...recurringTasks].map((task) => ({
          ...task,
          type: task.type
        })) as Task[];

        const sortedTasks = sortTasks(tasksWithProjects);
        
        setTasks(sortedTasks);
        return;
      }

      const { data: projectTasks, error: projectError } = await query;
      if (projectError) throw projectError;

      const groupedTasks = (projectTasks || []).reduce((acc, task) => {
        const projectId = task.project_id || 'no_project';
        if (!acc[projectId]) {
          acc[projectId] = [];
        }
        acc[projectId].push(task);
        return acc;
      }, {} as Record<string, Task[]>);

      Object.keys(groupedTasks).forEach(projectId => {
        groupedTasks[projectId].sort((a, b) => {
          const priorityOrder = { High: 0, Medium: 1, Low: 2 };
          return (priorityOrder[a.priority as keyof typeof priorityOrder] || 3) - 
                 (priorityOrder[b.priority as keyof typeof priorityOrder] || 3);
        });
      });

      const sortedProjectTasks = Object.values(groupedTasks).flat();
      setTasks(sortedProjectTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
    }
  }, [toast, view]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        fetchTasks();
      }
    }, 60000);

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

      if (task.type === "Recurring") {
        if (completed) {
          await createCompletedRecurringTaskInstance(taskId, task.user_id);
        } else {
          const today = new Date().toISOString().split('T')[0];
          await supabase
            .from('recurring_task_completions')
            .delete()
            .match({
              task_id: taskId,
              completed_date: today
            });
        }
      } else {
        const { error } = await supabase
          .from("tasks")
          .update({ completed })
          .eq("id", taskId);

        if (error) throw error;
      }

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

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsSheetOpen(true);
  };

  const sortTasks = (tasks: Task[]) => {
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return (priorityOrder[a.priority as keyof typeof priorityOrder] || 3) - 
             (priorityOrder[b.priority as keyof typeof priorityOrder] || 3);
    });
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
              <div className="space-y-6">
                {sortTasks(tasks.filter(task => !task.completed)).map((task) => (
                  <div key={task.id} className="group">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center space-x-4">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked) =>
                            handleToggleComplete(task.id, checked as boolean)
                          }
                        />
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{task.name}</span>
                            {task.type === 'Todo' && (
                              <>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(task.due_date), "MMM d")}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {format(parse(task.due_time, 'HH:mm:ss', new Date()), 'h a')}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={task.type === 'Recurring' ? 'secondary' : 'outline'}>
                              {task.type}
                            </Badge>
                            <Badge variant={getPriorityBadgeVariant(task.priority)}>
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={() => {
                          setSelectedTask(task);
                          setIsSheetOpen(true);
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                    <Separator />
                  </div>
                ))}
              </div>
            )}
          </div>

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
              <div className="space-y-6">
                {sortTasks(tasks.filter(task => task.completed)).map((task) => (
                  <div key={task.id} className="group">
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center space-x-4">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked) =>
                            handleToggleComplete(task.id, checked as boolean)
                          }
                        />
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{task.name}</span>
                            {task.type === 'Todo' && (
                              <>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(task.due_date), "MMM d")}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {format(parse(task.due_time, 'HH:mm:ss', new Date()), 'h a')}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={task.type === 'Recurring' ? 'secondary' : 'outline'}>
                              {task.type}
                            </Badge>
                            <Badge variant={getPriorityBadgeVariant(task.priority)}>
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={() => {
                          setSelectedTask(task);
                          setIsSheetOpen(true);
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                    <Separator />
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
