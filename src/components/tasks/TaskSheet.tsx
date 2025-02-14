import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Task } from "./types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

const DAYS_OF_WEEK = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

interface TaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onTaskUpdate?: () => void;
  onTaskDelete?: (taskId: string) => Promise<void>;
  projectId?: string;
}

const TaskSheet = ({ open, onOpenChange, task, onTaskUpdate, onTaskDelete, projectId }: TaskSheetProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "",
    type: "Todo" as "Todo" | "Recurring",
    dueDate: "",
    dueTime: "12:00",
    recurringDays: [] as string[],
  });

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description || "",
        priority: task.priority,
        type: task.type || "Todo",
        dueDate: task.due_date?.split('T')[0] || "",
        dueTime: task.due_time?.slice(0, 5) || "12:00",
        recurringDays: task.recurring_days || [],
      });
    } else {
      setFormData({
        name: "",
        description: "",
        priority: "",
        type: "Todo",
        dueDate: "",
        dueTime: "12:00",
        recurringDays: [],
      });
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create tasks",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get existing tasks to determine position
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("position, priority")
        .eq(projectId ? "project_id" : "user_id", projectId || session.user.id)
        .eq("completed", false)
        .order("priority", { ascending: false })
        .order("position");

      // Calculate position based on priority
      const priorityOrder = { High: 3, Medium: 2, Low: 1 };
      const newTaskPriority = priorityOrder[formData.priority as keyof typeof priorityOrder] || 0;
      
      let newPosition = 0;
      if (existingTasks && existingTasks.length > 0) {
        const lastSameOrHigherPriorityTask = existingTasks.find(t => 
          (priorityOrder[t.priority as keyof typeof priorityOrder] || 0) <= newTaskPriority
        );

        if (lastSameOrHigherPriorityTask) {
          newPosition = lastSameOrHigherPriorityTask.position + 1;
          
          // Update positions of tasks after the new position
          const { error: updateError } = await supabase
            .from("tasks")
            .update({ position: newPosition })
            .gte("position", newPosition)
            .eq(projectId ? "project_id" : "user_id", projectId || session.user.id)
            .eq("completed", false);
            
          if (updateError) throw updateError;
        } else {
          newPosition = existingTasks.length;
        }
      }

      const taskData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        priority: formData.priority,
        type: formData.type,
        due_date: formData.type === "Todo" ? formData.dueDate : new Date().toISOString().split('T')[0],
        due_time: formData.type === "Todo" ? formData.dueTime + ":00" : formData.dueTime + ":00",
        recurring_days: formData.type === "Recurring" ? formData.recurringDays : [],
        user_id: session.user.id,
        project_id: projectId || null,
        position: newPosition,
        completed: false
      };

      if (task) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", task.id);

        if (error) throw error;

        toast({
          title: "Task Updated",
          description: "Task has been updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("tasks")
          .insert([taskData]);

        if (error) throw error;

        toast({
          title: "Task Created",
          description: "Task has been created successfully",
        });
      }

      // Reset form
      setFormData({
        name: "",
        description: "",
        priority: "",
        type: "Todo",
        dueDate: "",
        dueTime: "12:00",
        recurringDays: [],
      });

      onOpenChange(false);
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error: any) {
      console.error("Error managing task:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to manage task",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!task?.id) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id);

      if (error) throw error;

      toast({
        title: "Task Deleted",
        description: "Task has been deleted successfully",
      });

      onOpenChange(false);
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const toggleRecurringDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter(d => d !== day)
        : [...prev.recurringDays, day]
    }));
  };

  const handleSelectAllDays = () => {
    if (formData.recurringDays.length === DAYS_OF_WEEK.length) {
      setFormData(prev => ({ ...prev, recurringDays: [] }));
    } else {
      setFormData(prev => ({ ...prev, recurringDays: DAYS_OF_WEEK.map(day => day.value) }));
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{task ? "Edit Task" : "Create Task"}</SheetTitle>
            <SheetDescription>
              {task ? "Edit your task details below" : "Add a new task to your list"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Task Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter task name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter task description"
                />
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: "High" | "Medium" | "Low") =>
                    setFormData({ ...formData, priority: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Task Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "Todo" | "Recurring") =>
                    setFormData({ ...formData, type: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select task type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todo">To Do</SelectItem>
                    <SelectItem value="Recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === "Todo" && (
                <>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, dueDate: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Due Time</Label>
                    <Input
                      type="time"
                      value={formData.dueTime}
                      onChange={(e) =>
                        setFormData({ ...formData, dueTime: e.target.value })
                      }
                      required
                    />
                  </div>
                </>
              )}

              {formData.type === "Recurring" && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Recurring Days</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <div
                          key={day.value}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`day-${day.value}`}
                            checked={formData.recurringDays.includes(day.value)}
                            onCheckedChange={(checked) => {
                              setFormData({
                                ...formData,
                                recurringDays: checked
                                  ? [...formData.recurringDays, day.value]
                                  : formData.recurringDays.filter(
                                      (d) => d !== day.value
                                    ),
                              });
                            }}
                          />
                          <label
                            htmlFor={`day-${day.value}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={formData.dueTime}
                      onChange={(e) =>
                        setFormData({ ...formData, dueTime: e.target.value })
                      }
                      required
                    />
                  </div>
                </>
              )}

              <div className="pt-4 space-x-2 flex justify-end">
                <Button type="submit">
                  {task ? "Update Task" : "Create Task"}
                </Button>
              </div>

              {task && (
                <div className="pt-2">
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full"
                  >
                    Delete Task
                  </Button>
                </div>
              )}
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TaskSheet;