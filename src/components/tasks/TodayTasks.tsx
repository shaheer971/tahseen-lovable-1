
import { useState } from "react";
import { format, isSameDay, parse } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "./types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import CreateTaskDialog from "./CreateTaskDialog";
import TaskSheet from "./TaskSheet";
import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";

const priorityColors = {
  Low: "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-purple-100 text-purple-800"
};

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

  const getBadgeLevel = () => {
    const progress = calculateProgress();
    if (progress === 0) return { label: "Getting Started", variant: "secondary" as const };
    if (progress < 25) return { label: "Beginner", variant: "default" as const };
    if (progress < 50) return { label: "Rising Star", variant: "outline" as const };
    if (progress < 75) return { label: "Achiever", variant: "destructive" as const };
    if (progress < 100) return { label: "Expert", variant: "secondary" as const };
    return { label: "Master", variant: "default" as const };
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

  const formatTaskTime = (time: string) => {
    try {
      const parsed = parse(time, 'HH:mm:ss', new Date());
      return format(parsed, 'h:mm a');
    } catch {
      return time;
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !tasks) return;

    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update positions in the UI immediately
    queryClient.setQueryData(['today-tasks', format(today, 'yyyy-MM-dd')], items);

    // Update positions in the database
    try {
      const updates = items.map((task, index) => ({
        id: task.id,
        position: index,
      }));

      const { error } = await supabase
        .from('tasks')
        .upsert(updates);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating task positions:', error);
      toast({
        title: "Error",
        description: "Failed to update task order",
        variant: "destructive",
      });
      // Revert the optimistic update
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] });
    }
  };

  return (
    <div className="bg-card rounded-lg border shadow p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold">{format(today, 'd')}</div>
            <div className="font-semibold text-muted-foreground">{format(today, 'EEEE')}</div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={handleCreateTask}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <Progress value={calculateProgress()} className="h-1.5" />
          <div className="flex justify-end">
            <Badge variant={getBadgeLevel().variant}>
              {getBadgeLevel().label}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="h-[540px] flex items-center justify-center">
            Loading tasks...
          </div>
        ) : (
          <div className="h-[540px] overflow-hidden">
            <ScrollArea className="h-full">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="today-tasks">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2 p-1"
                    >
                      {tasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
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
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "text-sm font-medium",
                                      task.completed && "line-through text-muted-foreground"
                                    )}>
                                      {task.name}
                                    </span>
                                    <Badge 
                                      variant="outline"
                                      className={cn(
                                        "text-xs",
                                        priorityColors[task.priority]
                                      )}
                                    >
                                      {task.priority}
                                    </Badge>
                                  </div>
                                  {task.due_time && (
                                    <div className="text-xs text-muted-foreground">
                                      {formatTaskTime(task.due_time)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
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
