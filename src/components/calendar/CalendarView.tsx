import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, isSameMonth, parse } from "date-fns";
import { Task } from "@/components/tasks/types";
import { ProjectTask } from "@/components/projects/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface CalendarViewProps {
  viewType: "day" | "week" | "month";
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  tasks: Task[];
  projectTasks: ProjectTask[];
  onTaskComplete: (taskId: string, isProjectTask: boolean, completed: boolean) => void;
}

const CalendarView = ({
  viewType,
  currentDate,
  setCurrentDate,
  tasks,
  projectTasks,
  onTaskComplete
}: CalendarViewProps) => {
  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    switch (viewType) {
      case "day":
        newDate.setDate(currentDate.getDate() - 1);
        break;
      case "week":
        newDate.setDate(currentDate.getDate() - 7);
        break;
      case "month":
        newDate.setMonth(currentDate.getMonth() - 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    switch (viewType) {
      case "day":
        newDate.setDate(currentDate.getDate() + 1);
        break;
      case "week":
        newDate.setDate(currentDate.getDate() + 7);
        break;
      case "month":
        newDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const TaskCard = ({ task, isProjectTask }: { task: Task | ProjectTask, isProjectTask: boolean }) => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div 
          className={`p-2 rounded-md mb-1 cursor-pointer transition-all ${
            task.completed ? 'opacity-50' : ''
          } ${
            task.priority === 'High' 
              ? 'bg-red-100 hover:bg-red-200' 
              : task.priority === 'Medium'
              ? 'bg-yellow-100 hover:bg-yellow-200'
              : 'bg-green-100 hover:bg-green-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">{task.name}</span>
            <Checkbox
              checked={task.completed}
              onCheckedChange={(checked) => 
                onTaskComplete(task.id, isProjectTask, checked as boolean)
              }
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{task.name}</h4>
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}
          <div className="flex gap-2">
            <Badge variant="outline">{task.priority}</Badge>
            <Badge variant="outline">{task.type}</Badge>
            {'projects' in task && task.projects?.name && (
              <Badge variant="outline">{task.projects.name}</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Due: {format(new Date(task.due_date), "PPp")}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );

  const renderDayView = () => {
    const dayTasks = [
      ...tasks.filter(task => isSameDay(new Date(task.due_date), currentDate)),
      ...projectTasks.filter(task => isSameDay(new Date(task.due_date), currentDate))
    ];

    return (
      <ScrollArea className="h-[600px]">
        <div className="space-y-4 p-4">
          {dayTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isProjectTask={'projects' in task}
            />
          ))}
        </div>
      </ScrollArea>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map(day => {
          const dayTasks = [
            ...tasks.filter(task => isSameDay(new Date(task.due_date), day)),
            ...projectTasks.filter(task => isSameDay(new Date(task.due_date), day))
          ];

          return (
            <div key={day.toISOString()} className="min-h-[120px]">
              <div className="text-center mb-2">
                <div className="font-medium">{format(day, "EEE")}</div>
                <div className="text-2xl">{format(day, "d")}</div>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-1 px-1">
                  {dayTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isProjectTask={'projects' in task}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-4">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
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
                    {dayTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isProjectTask={'projects' in task}
                      />
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold">
            {format(currentDate, "MMMM yyyy")}
          </span>
        </div>
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