
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "@/components/tasks/types";
import { ProjectTask } from "@/components/projects/types";
import CalendarView from "@/components/calendar/CalendarView";
import { toast } from "sonner";
import { format } from "date-fns";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";

type ViewType = "day" | "week" | "month";

const Calendar = () => {
  const [viewType, setViewType] = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  // Fetch regular tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['calendar-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("position", { ascending: true });

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
        .order("position", { ascending: true });

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

      // Optimistically update the local cache
      if (isProjectTask) {
        queryClient.setQueryData(['calendar-project-tasks'], (oldData: ProjectTask[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map(task => 
            task.id === taskId ? { ...task, completed } : task
          );
        });
      } else {
        queryClient.setQueryData(['calendar-tasks'], (oldData: Task[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map(task => 
            task.id === taskId ? { ...task, completed } : task
          );
        });
      }

      toast.success(`Task ${completed ? "completed" : "uncompleted"} successfully`);
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task status");
      // Invalidate queries to refresh data from server
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-project-tasks'] });
    }
  };

  const handleCreateTask = (date: Date) => {
    setSelectedDate(date);
    setCreateTaskOpen(true);
  };

  const handleTaskCreated = () => {
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
  };

  return (
    <div className="p-4 mt-0 ml-0">
      <div className="space-y-4">
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
          onCreateTask={handleCreateTask}
        />
        <CreateTaskDialog
          open={createTaskOpen}
          onOpenChange={setCreateTaskOpen}
          defaultDate={selectedDate}
          onSuccess={handleTaskCreated}
        />
      </div>
    </div>
  );
};

export default Calendar;
