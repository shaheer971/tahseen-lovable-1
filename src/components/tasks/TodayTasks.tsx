
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
import { Plus, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import CreateTaskDialog from "./CreateTaskDialog";
import TaskSheet from "./TaskSheet";
import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";

const priorityColors = {
  Low: "text-green-600",
  Medium: "text-yellow-600",
  High: "text-purple-600"
};

const TodayTasks = () => {
  const { session } = useAuth();
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const today = new Date();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['today-tasks', format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          subtasks:tasks!tasks_parent_task_id_fkey(*)
        `)
        .eq('user_id', session.user.id)
        .eq('due_date', format(today, 'yyyy-MM-dd'))
        .is('is_subtask', false)
        .order('position');

      if (error) throw error;

      return data.map(task => ({
        ...task,
        priority: task.priority as "Low" | "Medium" | "High",
        type: task.type as "Todo" | "Recurring" | "Project",
        subtasks: task.subtasks || []
      })) as Task[];
    },
    enabled: !!session?.user?.id
  });

  const calculateProgress = () => {
    if (!tasks.length) return 0;
    const allTasks = tasks.flatMap(task => [task, ...task.subtasks || []]);
    const completedTasks = allTasks.filter(task => task.completed).length;
    return (completedTasks / allTasks.length) * 100;
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

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
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
    if (!result.destination || !tasks || !session?.user?.id) return;

    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update positions in the UI immediately
    queryClient.setQueryData(['today-tasks', format(today, 'yyyy-MM-dd')], items);

    try {
      for (const [index, task] of items.entries()) {
        const { error } = await supabase
          .from('tasks')
          .update({ position: index })
          .eq('id', task.id)
          .eq('user_id', session.user.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating task positions:', error);
      toast({
        title: "Error",
        description: "Failed to update task order",
        variant: "destructive",
      });
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
            onClick={() => setCreateTaskOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <Progress value={calculateProgress()} className="h-1.5" />
          <div className="text-sm text-muted-foreground text-right">
            {Math.round(calculateProgress())}% completed
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
                            <div>
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "p-3 rounded-md cursor-pointer transition-all border",
                                  "bg-background hover:bg-accent/50"
                                )}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      checked={task.completed}
                                      onCheckedChange={(checked) => {
                                        handleTaskComplete(task.id, checked as boolean);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1"
                                    />
                                    <div className="flex-1" onClick={() => setSelectedTask(task)}>
                                      <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            {task.subtasks?.length > 0 && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 p-0"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleTaskExpansion(task.id);
                                                }}
                                              >
                                                {expandedTasks.includes(task.id) ? (
                                                  <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                  <ChevronRight className="h-4 w-4" />
                                                )}
                                              </Button>
                                            )}
                                            <span className={cn(
                                              "font-medium",
                                              task.completed && "line-through text-muted-foreground"
                                            )}>
                                              {task.name}
                                            </span>
                                          </div>
                                          {task.description && (
                                            <p className="text-sm text-muted-foreground">
                                              {task.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className={cn(
                                            "font-medium",
                                            priorityColors[task.priority]
                                          )}>
                                            {task.priority}
                                          </span>
                                          {task.due_time && (
                                            <span className="text-muted-foreground">
                                              {formatTaskTime(task.due_time)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Subtasks */}
                              {expandedTasks.includes(task.id) && task.subtasks?.length > 0 && (
                                <div className="ml-6 mt-1 space-y-1">
                                  {task.subtasks.map((subtask) => (
                                    <div
                                      key={subtask.id}
                                      className={cn(
                                        "p-2 rounded-md cursor-pointer transition-all border",
                                        "bg-background/50 hover:bg-accent/50"
                                      )}
                                      onClick={() => setSelectedTask(subtask)}
                                    >
                                      <div className="flex items-start gap-2">
                                        <Checkbox
                                          checked={subtask.completed}
                                          onCheckedChange={(checked) => {
                                            handleTaskComplete(subtask.id, checked as boolean);
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-1"
                                        />
                                        <div className="flex-1">
                                          <div className="flex items-start justify-between">
                                            <span className={cn(
                                              "font-medium",
                                              subtask.completed && "line-through text-muted-foreground"
                                            )}>
                                              {subtask.name}
                                            </span>
                                            <div className="flex items-center gap-2 text-sm">
                                              <span className={cn(
                                                "font-medium",
                                                priorityColors[subtask.priority]
                                              )}>
                                                {subtask.priority}
                                              </span>
                                            </div>
                                          </div>
                                          {subtask.description && (
                                            <p className="text-sm text-muted-foreground">
                                              {subtask.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
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
