import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/components/tasks/types";
import { ProjectTask } from "@/components/projects/types";
import CalendarView from "@/components/calendar/CalendarView";
import { toast } from "sonner";
import { format } from "date-fns";

type ViewType = "day" | "week" | "month";

const Calendar = () => {
  const [viewType, setViewType] = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch regular tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['calendar-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true });

      if (error) throw error;

      return data.map(task => ({
        ...task,
        priority: task.priority as "Low" | "Medium" | "High",
        type: task.type as "Todo" | "Project" | "Recurring"
      })) as Task[];
    }
  });

  // Fetch project tasks
  const { data: projectTasks = [] } = useQuery({
    queryKey: ['calendar-project-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*, projects(name)")
        .order("due_date", { ascending: true });

      if (error) throw error;

      return data.map(task => ({
        ...task,
        priority: task.priority as "Low" | "Medium" | "High",
        type: task.type as "Todo" | "Project" | "Recurring",
        status: task.status as "todo" | "in-progress" | "done"
      })) as ProjectTask[];
    }
  });

  const handleTaskComplete = async (taskId: string, isProjectTask: boolean, completed: boolean) => {
    try {
      const table = isProjectTask ? "project_tasks" : "tasks";
      const { error } = await supabase
        .from(table)
        .update({ completed })
        .eq("id", taskId);

      if (error) throw error;

      toast.success(`Task ${completed ? "completed" : "uncompleted"} successfully`);
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task status");
    }
  };

  return (
    <div className="p- mt-0 ml-0">
      <div className="space-y-">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Calendar</h1>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setDate(currentDate.getDate() - 7);
                  setCurrentDate(newDate);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center">
                {format(currentDate, "MMMM d")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newDate = new Date(currentDate);
                  newDate.setDate(currentDate.getDate() + 7);
                  setCurrentDate(newDate);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="border rounded-lg p-1 flex gap-1">
            <Button
              variant={viewType === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewType("day")}
            >
              Day
            </Button>
            <Button
              variant={viewType === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewType("week")}
            >
              Week
            </Button>
            <Button
              variant={viewType === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewType("month")}
            >
              Month
            </Button>
          </div>
        </div>
        <CalendarView
          viewType={viewType}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          tasks={tasks}
          projectTasks={projectTasks}
          onTaskComplete={handleTaskComplete}
        />
      </div>
    </div>
  );
};

export default Calendar;