import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { Task } from "@/components/tasks/types";
import { ProjectTask } from "@/components/projects/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useState } from "react";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import TaskSheet from "@/components/tasks/TaskSheet";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface CalendarViewProps {
  viewType: "day" | "week" | "month";
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  tasks: Task[];
  projectTasks: ProjectTask[];
  onTaskComplete?: (taskId: string, isProjectTask: boolean, completed: boolean) => void;
  onCreateTask?: (date: Date) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "High":
      return "bg-red-100 text-red-800 border-red-200";
    case "Medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "Low":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getTaskTypeLabel = (task: Task | ProjectTask) => {
  if ('projects' in task && task.projects?.name) {
    return task.projects.name;
  }
  if (task.type === "Recurring") {
    return "Recurring";
  }
  return "To do";
};

const calculateDayProgress = (tasks: (Task | ProjectTask)[]) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.completed).length;
  return (completedTasks / totalTasks) * 100;
};

const TaskCard = ({ 
  task, 
  isProjectTask, 
  index, 
  droppableId,
  onTaskComplete,
  onTaskClick 
}: { 
  task: Task | ProjectTask;
  isProjectTask: boolean;
  index: number;
  droppableId: string;
  onTaskComplete?: (taskId: string, isProjectTask: boolean, completed: boolean) => void;
  onTaskClick?: (task: Task | ProjectTask) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const timeString = task.due_date ? format(new Date(task.due_date), "H:mm") : "";
  const hasSubtasks = 'subtasks' in task && task.subtasks && task.subtasks.length > 0;
  
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "p-2 rounded-md mb-1 cursor-pointer transition-all border",
            task.completed ? 'opacity-50' : '',
            'bg-accent/50 hover:bg-accent',
            snapshot.isDragging && 'shadow-lg'
          )}
        >
          <div className="flex flex-col gap-1">
            <div 
              className="flex items-center justify-between"
              onClick={() => onTaskClick?.(task)}
            >
              <span className="text-sm font-medium">{task.name}</span>
              {hasSubtasks && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {timeString && (
              <div className="text-xs text-muted-foreground">{timeString}</div>
            )}
            <div className="flex items-center justify-between mt-1">
              <Checkbox
                checked={task.completed}
                onCheckedChange={(checked) => {
                  onTaskComplete?.(task.id, isProjectTask, checked as boolean);
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4"
              />
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] px-1 py-0 h-4",
                  getPriorityColor(task.priority)
                )}
              >
                {getTaskTypeLabel(task)}
              </Badge>
            </div>
            
            {isExpanded && 'subtasks' in task && task.subtasks && (
              <div className="mt-2 pl-4 space-y-1 border-l-2 border-border">
                {task.subtasks.map((subtask: Task) => (
                  <div
                    key={subtask.id}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox
                        checked={subtask.completed}
                        onCheckedChange={(checked) => {
                          onTaskComplete?.(subtask.id, false, checked as boolean);
                        }}
                        className="h-3 w-3"
                      />
                      <span className={cn(
                        "text-xs",
                        subtask.completed && "line-through text-muted-foreground"
                      )}>
                        {subtask.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};

const CalendarView = ({
  viewType,
  currentDate,
  setCurrentDate,
  tasks,
  projectTasks,
  onTaskComplete,
  onCreateTask
}: CalendarViewProps) => {
  
  const [isDragging, setIsDragging] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | ProjectTask | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleTaskClick = (task: Task | ProjectTask) => {
    setSelectedTask(task);
    setIsTaskSheetOpen(true);
  };

  const calculatePosition = (tasks: (Task | ProjectTask)[], destinationIndex: number): number => {
    const POSITION_GAP = 1000; // Use a large gap to allow for future insertions

    if (tasks.length === 0) {
      return POSITION_GAP;
    }

    if (destinationIndex === 0) {
      const firstTaskPosition = tasks[0]?.position || POSITION_GAP;
      return Math.floor(firstTaskPosition / 2);
    }

    if (destinationIndex >= tasks.length) {
      const lastTaskPosition = tasks[tasks.length - 1]?.position || 0;
      return lastTaskPosition + POSITION_GAP;
    }

    const prevPosition = tasks[destinationIndex - 1]?.position || 0;
    const nextPosition = tasks[destinationIndex]?.position || prevPosition + (POSITION_GAP * 2);
    
    // Calculate the middle position, ensuring it's a whole number
    return Math.floor(prevPosition + ((nextPosition - prevPosition) / 2));
  };

  const updateTaskPosition = async (taskId: string, newPosition: number, newDate?: Date) => {
    try {
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!task) {
        toast({
          title: "Task not found",
          description: "The task may have been deleted",
          variant: "destructive",
        });
        queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
        return;
      }

      const updateData: any = { 
        position: Math.floor(newPosition) // Ensure position is an integer
      };
      
      if (newDate) {
        updateData.due_date = format(newDate, 'yyyy-MM-dd');
      }

      const { error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (updateError) throw updateError;

      queryClient.setQueryData(['calendar-tasks'], (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(t => 
          t.id === taskId 
            ? { ...t, position: Math.floor(newPosition), due_date: newDate?.toISOString() || t.due_date } 
            : t
        );
      });

    } catch (error: any) {
      console.error('Error updating task position:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update task position",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    }
  };

  const handleDragEnd = async (result: any) => {
    setIsDragging(false);
    
    if (!result.destination) return;

    const sourceDroppableId = result.source.droppableId;
    const destinationDroppableId = result.destination.droppableId;
    const destinationIndex = result.destination.index;
    
    const destinationDate = new Date(parseInt(destinationDroppableId));
    
    const dayTasks = [
      ...tasks.filter(task => isSameDay(new Date(task.due_date), destinationDate)),
      ...projectTasks.filter(task => isSameDay(new Date(task.due_date), destinationDate))
    ].sort((a, b) => a.position - b.position);

    const movedTask = [...tasks, ...projectTasks].find(task => 
      task.id === result.draggableId
    );

    if (!movedTask) {
      toast({
        title: "Error",
        description: "Task not found",
        variant: "destructive",
      });
      return;
    }

    const newPosition = calculatePosition(dayTasks, destinationIndex);

    queryClient.setQueryData(['calendar-tasks'], (oldData: Task[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.map(t => 
        t.id === movedTask.id 
          ? { ...t, position: newPosition, due_date: destinationDate.toISOString() } 
          : t
      );
    });

    await updateTaskPosition(movedTask.id, newPosition, destinationDate);
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <>
        <CreateTaskDialog 
          open={createTaskOpen} 
          onOpenChange={setCreateTaskOpen}
          defaultDate={selectedDate}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
          }}
        />
        <TaskSheet
          open={isTaskSheetOpen}
          onOpenChange={setIsTaskSheetOpen}
          task={selectedTask}
          onTaskUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
          }}
        />
        <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-1">
            {eachDayOfInterval({
              start: startOfWeek(currentDate),
              end: endOfWeek(currentDate)
            }).map(day => {
              const dayTasks = [
                ...tasks.filter(task => isSameDay(new Date(task.due_date), day)),
                ...projectTasks.filter(task => isSameDay(new Date(task.due_date), day))
              ].sort((a, b) => a.position - b.position);

              const droppableId = day.getTime().toString();
              const progress = calculateDayProgress(dayTasks);
              const isCurrentDay = isSameDay(day, currentDate);

              return (
                <div key={day.toISOString()} className="min-h-[600px] border-r last:border-r-0">
                  <div className="px-2 py-2 border-b">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "text-sm font-medium",
                          isCurrentDay && "text-blue-600"
                        )}>
                          {format(day, "EEEE")}
                        </div>
                        <div className={cn(
                          "text-sm font-semibold",
                          isCurrentDay && "text-blue-600"
                        )}>
                          {format(day, "d")}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onCreateTask?.(day)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  
                  <div className="h-[540px] overflow-hidden">
                    <ScrollArea className="h-full">
                      <Droppable droppableId={droppableId}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "px-2 pt-2 min-h-full",
                              snapshot.isDraggingOver && 'bg-accent/20'
                            )}
                          >
                            <div className="space-y-1">
                              {dayTasks.map((task, index) => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  isProjectTask={'projects' in task}
                                  index={index}
                                  droppableId={droppableId}
                                  onTaskComplete={onTaskComplete}
                                  onTaskClick={handleTaskClick}
                                />
                              ))}
                            </div>
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </ScrollArea>
                  </div>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-4">
          {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => (
            <div key={day} className="text-center font-medium">
              {day}
            </div>
          ))}
          {days.map(day => {
            const dayTasks = [
              ...tasks.filter(task => isSameDay(new Date(task.due_date), day)),
              ...projectTasks.filter(task => isSameDay(new Date(task.due_date), day))
            ];

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[120px] rounded border p-2 ${
                  !isSameMonth(day, currentDate) ? "bg-muted/50" : ""
                }`}
              >
                <div className="text-right text-sm mb-1">{format(day, "d")}</div>
                <ScrollArea className="h-[100px]">
                  <div className="space-y-1">
                    {dayTasks.map((task, index) => (
                      <div key={task.id} className="p-2 rounded-md bg-accent/50 border">
                        <span className="text-sm">{task.name}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayTasks = [
      ...tasks.filter(task => isSameDay(new Date(task.due_date), currentDate)),
      ...projectTasks.filter(task => isSameDay(new Date(task.due_date), currentDate))
    ];

    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={currentDate.getTime().toString()}>
          {(provided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-4 p-4"
            >
              <ScrollArea className="h-[600px]">
                <div className="space-y-1">
                  {dayTasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isProjectTask={'projects' in task}
                      index={index}
                      droppableId={currentDate.getTime().toString()}
                      onTaskComplete={onTaskComplete}
                      onTaskClick={handleTaskClick}
                    />
                  ))}
                </div>
              </ScrollArea>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg shadow p-4">
        {viewType === "day" && renderDayView()}
        {viewType === "week" && renderWeekView()}
        {viewType === "month" && renderMonthView()}
      </div>
    </div>
  );
};

export default CalendarView;
