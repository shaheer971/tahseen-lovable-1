
import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "./types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import CreateTaskDialog from "./CreateTaskDialog";
import TaskSheet from "./TaskSheet";

const TodayTasks = () => {
  const { session } = useAuth();
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();
  const today = new Date();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['today-tasks', format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .eq('user_id', session.user.id)
        .eq('due_date', format(today, 'yyyy-MM-dd'))
        .order('position');

      if (error) throw error;

      return data.map(task => ({
        ...task,
        priority: task.priority as "Low" | "Medium" | "High",
        type: task.type as "Todo" | "Recurring" | "Project"
      })) as Task[];
    },
    enabled: !!session?.user?.id
  });

  const calculateProgress = () => {
    if (!tasks.length) return 0;
    const completedTasks = tasks.filter(task => task.completed).length;
    return (completedTasks / tasks.length) * 100;
  };

  const handleTaskComplete = async (taskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed })
        .eq('id', taskId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
      toast({
        title: "Success",
        description: `Task ${completed ? "completed" : "uncompleted"}`,
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const handleCreateTask = () => {
    setCreateTaskOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  return (
    <div className="bg-card rounded-lg border shadow p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="space-y-1">
            <h2 className="font-semibold">{format(today, 'EEEE')}</h2>
            <div className="text-2xl font-bold">{format(today, 'd')}</div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-6 w-6"
            onClick={handleCreateTask}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <Progress value={calculateProgress()} className="h-1.5" />

        {isLoading ? (
          <div className="h-[540px] flex items-center justify-center">
            Loading tasks...
          </div>
        ) : (
          <div className="h-[540px] overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-1">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className={cn(
                      "p-2 rounded-md mb-1 cursor-pointer transition-all border",
                      "bg-accent/50 hover:bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={(checked) => {
                          handleTaskComplete(task.id, checked as boolean);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                      <div className="flex-1">
                        <div className={cn(
                          "text-sm font-medium",
                          task.completed && "line-through text-muted-foreground"
                        )}>
                          {task.name}
                        </div>
                        {task.due_time && (
                          <div className="text-xs text-muted-foreground">
                            {task.due_time}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        defaultDate={today}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
        }}
      />

      {selectedTask && (
        <TaskSheet
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          task={selectedTask}
          onTaskUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
          }}
        />
      )}
    </div>
  );
};

export default TodayTasks;
