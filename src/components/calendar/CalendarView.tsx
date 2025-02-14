import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, isSameMonth, parse } from "date-fns";
import { Task } from "@/components/tasks/types";
import { ProjectTask } from "@/components/projects/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useState } from "react";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface CalendarViewProps {
  viewType: "day" | "week" | "month";
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  tasks: Task[];
  projectTasks: ProjectTask[];
  onTaskComplete?: (taskId: string, isProjectTask: boolean, completed: boolean) => void;
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

const TaskCard = ({ task, isProjectTask, index, droppableId }: { 
  task: Task | ProjectTask, 
  isProjectTask: boolean, 
  index: number,
  droppableId: string 
}) => {
  const timeString = task.due_date ? format(new Date(task.due_date), "H:mm") : "";
  
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
            <span className="text-sm font-medium">{task.name}</span>
            {timeString && (
              <div className="text-xs text-muted-foreground">{timeString}</div>
            )}
            <div className="flex items-center justify-between mt-1">
              <Checkbox
                checked={task.completed}
                onCheckedChange={(checked) => 
                  onTaskComplete(task.id, isProjectTask, checked as boolean)
                }
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
  onTaskComplete
}: CalendarViewProps) => {
  
  const [isDragging, setIsDragging] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const updateTaskOrder = async (taskId: string, newPosition: number, newDate?: Date) => {
    try {
      console.log('Updating task position:', { taskId, newPosition, newDate });
      const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!task) {
        throw new Error('Task not found');
      }

      const updateData: any = { position: newPosition };
      if (newDate) {
        updateData.due_date = format(newDate, 'yyyy-MM-dd');
        updateData.due_time = format(new Date(task.due_time), 'HH:mm');
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      console.log('Task position updated successfully');
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error: any) {
      console.error('Error updating task position:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update task position",
        variant: "destructive",
      });
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = async (result: any) => {
    setIsDragging(false);
    
    if (!result.destination) return;

    const sourceDroppableId = result.source.droppableId;
    const destinationDroppableId = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    // Get source and destination dates from droppableIds
    const sourceDate = new Date(parseInt(sourceDroppableId));
    const destinationDate = new Date(parseInt(destinationDroppableId));
    
    // Get all tasks for the destination day
    const destinationDayTasks = [
      ...tasks.filter(task => isSameDay(new Date(task.due_date), destinationDate)),
      ...projectTasks.filter(task => isSameDay(new Date(task.due_date), destinationDate))
    ].sort((a, b) => (a.position || 0) - (b.position || 0));

    // Calculate new order
    let newOrder: number;
    if (destinationIndex === 0) {
      newOrder = destinationDayTasks.length > 0 ? (destinationDayTasks[0].position || 0) - 1 : 0;
    } else if (destinationIndex === destinationDayTasks.length) {
      newOrder = destinationDayTasks.length > 0 ? (destinationDayTasks[destinationDayTasks.length - 1].position || 0) + 1 : 0;
    } else {
      const prevTask = destinationDayTasks[destinationIndex - 1];
      const nextTask = destinationDayTasks[destinationIndex];
      newOrder = ((prevTask.position || 0) + (nextTask.position || 0)) / 2;
    }

    // Update the task's order and date if necessary
    const taskToMove = [...tasks, ...projectTasks].find(task => 
      isSameDay(new Date(task.due_date), sourceDate) && 
      task.position === sourceIndex
    );

    if (taskToMove) {
      await updateTaskOrder(
        taskToMove.id, 
        newOrder,
        sourceDroppableId !== destinationDroppableId ? destinationDate : undefined
      );
    }
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
        />
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dayTasks = [
                ...tasks.filter(task => isSameDay(new Date(task.due_date), day)),
                ...projectTasks.filter(task => isSameDay(new Date(task.due_date), day))
              ].sort((a, b) => (a.position || 0) - (b.position || 0));
              
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
                        onClick={() => {
                          setSelectedDate(day);
                          setCreateTaskOpen(true);
                        }}
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
      <div className="flex items-center justify-between">
        {/* <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePrevious()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleNext()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold">
            {format(currentDate, "MMMM yyyy")}
          </span>
        </div> */}
      </div>
      <div className="bg-card rounded-lg shadow p-4">
        {viewType === "day" && renderDayView()}
        {viewType === "week" && renderWeekView()}
        {viewType === "month" && renderMonthView()}
      </div>
    </div>
  );
};

export default CalendarView;
