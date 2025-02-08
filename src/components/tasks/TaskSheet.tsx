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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "",
    type: "",
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
        type: task.type,
        dueDate: task.due_date?.split('T')[0] || "",
        dueTime: task.due_time?.slice(0, 5) || "12:00",
        recurringDays: task.recurring_days || [],
      });
    } else {
      setFormData({
        name: "",
        description: "",
        priority: "",
        type: "",
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
      return;
    }

    try {
      // Get existing tasks to determine position based on priority
      const { data: existingTasks } = await supabase
        .from(projectId ? "project_tasks" : "tasks")
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
            .from(projectId ? "project_tasks" : "tasks")
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
        name: formData.name,
        description: formData.description,
        priority: formData.priority,
        type: formData.type,
        due_date: formData.type === "Todo" ? new Date(formData.dueDate).toISOString() : new Date().toISOString(),
        due_time: formData.type === "Todo" ? formData.dueTime + ":00" : "00:00:00",
        user_id: session.user.id,
        project_id: projectId || null,
        position: newPosition,
        completed: false
      };

      if (task) {
        await supabase
          .from(projectId ? "project_tasks" : "tasks")
          .update(taskData)
          .eq("id", task.id);
      } else {
        await supabase
          .from(projectId ? "project_tasks" : "tasks")
          .insert(taskData);
      }

      // Reset form
      setFormData({
        name: "",
        description: "",
        priority: "",
        type: "",
        dueDate: "",
        dueTime: "12:00",
        recurringDays: [],
      });

      // Close sheet and update without scrolling
      onOpenChange(false);
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error("Error managing task:", error);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    try {
      if (onTaskDelete) {
        await onTaskDelete(task.id);
      } else {
        const { error } = await supabase
          .from(projectId ? "project_tasks" : "tasks")
          .delete()
          .eq("id", task.id);

        if (error) throw error;

        onOpenChange(false);
        onTaskUpdate?.();
      }
    } catch (error) {
      console.error("Error deleting task:", error);
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
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <SheetHeader>
            <SheetTitle>{task ? "Edit Task" : "Create New Task"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Task name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Task description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todo">To Do</SelectItem>
                  {!projectId && <SelectItem value="Recurring">Recurring</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {!projectId && formData.type === "Recurring" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Recurring Days</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllDays}
                    className="h-8"
                  >
                    {formData.recurringDays.length === DAYS_OF_WEEK.length ? 'Deselect All' : 'Select All Days'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formData.recurringDays.includes(day.value)}
                        onCheckedChange={() => toggleRecurringDay(day.value)}
                      />
                      <Label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(formData.type === "Todo" || projectId) && (
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
            <div className="flex justify-between gap-2 pt-4">
              {task && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  Delete Task
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">{task ? "Save Changes" : "Create Task"}</Button>
              </div>
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