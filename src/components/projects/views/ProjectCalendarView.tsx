import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectTask } from "../types";
import TaskSheet from "@/components/tasks/TaskSheet";

type CalendarViewType = "day" | "week" | "month";

interface ProjectCalendarViewProps {
  projectId: string;
}

const ProjectCalendarView = ({ projectId }: ProjectCalendarViewProps) => {
  const [viewType, setViewType] = useState<CalendarViewType>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("due_date");

      if (error) throw error;
      
      return data.map(task => ({
        ...task,
        priority: task.priority as "Low" | "Medium" | "High",
        type: task.type as "Todo" | "Project" | "Recurring",
        status: task.status as "todo" | "in-progress" | "done"
      }));
    }
  });

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

  const handleTaskClick = (task: ProjectTask) => {
    setSelectedTask(task);
    setIsSheetOpen(true);
  };

  const renderDayView = () => {
    const dayTasks = tasks.filter(task => 
      isSameDay(new Date(task.due_date), currentDate)
    );

    return (
      <div className="space-y-4">
        {dayTasks.map(task => (
          <div key={task.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-medium">{task.name}</h3>
            <div className="text-sm text-gray-500 mt-1">
              {format(new Date(task.due_date), "h:mm a")}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map(day => {
          const dayTasks = tasks.filter(task => 
            isSameDay(new Date(task.due_date), day)
          );

          return (
            <div key={day.toISOString()} className="min-h-[120px]">
              <div className="text-center mb-2">
                <div className="font-medium">{format(day, "EEE")}</div>
                <div className="text-2xl">{format(day, "d")}</div>
              </div>
              <div className="space-y-1">
                {dayTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-primary/10 p-2 rounded text-sm text-foreground"
                  >
                    {task.name}
                  </div>
                ))}
              </div>
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
      <div className="grid grid-cols-7 gap-4">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-center font-medium">
            {day}
          </div>
        ))}
        {days.map(day => {
          const dayTasks = tasks.filter(task => 
            isSameDay(new Date(task.due_date), day)
          );

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[120px] rounded border p-2 ${
                !isSameMonth(day, currentDate) ? "bg-muted" : "bg-card"
              }`}
            >
              <div className="text-right text-sm text-muted-foreground">{format(day, "d")}</div>
              <div className="mt-1 space-y-1">
                {dayTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-primary/10 p-1 rounded text-xs text-foreground hover:bg-primary/20 cursor-pointer"
                    onClick={() => handleTaskClick(task)}
                  >
                    {task.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
          <span className="text-lg font-semibold text-foreground">
            {format(currentDate, "MMMM yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewType === "day" ? "default" : "outline"}
            onClick={() => setViewType("day")}
          >
            Day
          </Button>
          <Button
            variant={viewType === "week" ? "default" : "outline"}
            onClick={() => setViewType("week")}
          >
            Week
          </Button>
          <Button
            variant={viewType === "month" ? "default" : "outline"}
            onClick={() => setViewType("month")}
          >
            Month
          </Button>
        </div>
      </div>
      {viewType === "day" && renderDayView()}
      {viewType === "week" && (
        <div className="bg-background rounded-lg border">
          {renderWeekView()}
        </div>
      )}
      {viewType === "month" && (
        <div className="bg-background rounded-lg border">
          {renderMonthView()}
        </div>
      )}
      <TaskSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        task={selectedTask}
        projectId={projectId}
        onClose={() => {
          setSelectedTask(null);
          queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
        }}
      />
    </div>
  );
};

export default ProjectCalendarView;