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
import { PlusCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  onClose?: () => void;
}

const TaskSheet = ({ open, onOpenChange, task, onTaskUpdate, onTaskDelete, projectId, onClose }: TaskSheetProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "",
    type: "Todo" as "Todo" | "Recurring" | "Project",
    dueDate: "",
    dueTime: "12:00",
    recurringDays: [] as string[],
  });
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [newSubtask, setNewSubtask] = useState({
    name: "",
    description: "",
    priority: "Medium" as "Low" | "Medium" | "High"
  });
  const [showSubtasks, setShowSubtasks] = useState(true);

  const { data: subtasks = [] } = useQuery({
    queryKey: ['subtasks', task?.id],
    queryFn: async () => {
      if (!task?.id) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_task_id', task.id)
        .eq('is_subtask', true)
        .order('position');

      if (error) throw error;

      return data as Task[];
    },
    enabled: !!task?.id && !task?.is_subtask
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
        description: "You must be logged in to update tasks",
        variant: "destructive",
      });
      return;
    }

    try {
      if (task) {
        const { error } = await supabase
          .from("tasks")
          .update({
            name: formData.name.trim(),
            description: formData.description?.trim() || null,
            priority: formData.priority as "Low" | "Medium" | "High",
            type: formData.type,
            due_date: formData.dueDate,
            due_time: formData.dueTime + ":00",
            recurring_days: formData.type === "Recurring" ? formData.recurringDays : [],
          })
          .eq("id", task.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Task updated successfully",
        });
      }

      onOpenChange(false);
      if (onTaskUpdate) {
        onTaskUpdate();
      }
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
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
        title: "Success",
        description: "Task deleted successfully",
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

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !task?.id || !newSubtask.name.trim()) return;

    try {
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("position")
        .eq("parent_task_id", task.id)
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = tasksData && tasksData[0] ? tasksData[0].position + 1 : 0;

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          name: newSubtask.name.trim(),
          description: newSubtask.description,
          priority: newSubtask.priority,
          type: "Todo",
          due_date: formData.dueDate,
          due_time: formData.dueTime + ":00",
          user_id: session.user.id,
          parent_task_id: task.id,
          is_subtask: true,
          position: nextPosition,
          completed: false,
        })
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['subtasks', task.id] });
      setNewSubtask({
        name: "",
        description: "",
        priority: "Medium"
      });
      setShowSubtaskInput(false);
      toast({
        title: "Success",
        description: "Subtask created successfully",
      });
    } catch (error: any) {
      console.error("Error creating subtask:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create subtask",
        variant: "destructive",
      });
    }
  };

  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ completed })
        .eq('id', subtaskId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['subtasks', task?.id] });
      toast({
        title: "Success",
        description: `Subtask ${completed ? "completed" : "uncompleted"}`,
      });
    } catch (error: any) {
      console.error("Error updating subtask:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update subtask",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', subtaskId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['subtasks', task?.id] });
      toast({
        title: "Success",
        description: "Subtask deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting subtask:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete subtask",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[400px] p-0">
          <ScrollArea className="h-screen">
            <div className="p-6">
              <SheetHeader className="mb-6">
                <SheetTitle>{task ? "Edit Task" : "Create Task"}</SheetTitle>
                <SheetDescription>
                  {task ? "Edit your task details below" : "Add a new task to your list"}
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
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
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: "Low" | "Medium" | "High") =>
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
                      onValueChange={(value: "Todo" | "Recurring") =>
                        setFormData({ ...formData, type: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todo">Todo</SelectItem>
                        <SelectItem value="Recurring">Recurring</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                  </div>

                  {formData.type === "Recurring" && (
                    <div className="space-y-2">
                      <Label>Recurring Days</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Checkbox
                              id={`day-${index}`}
                              checked={formData.recurringDays.includes(index.toString())}
                              onCheckedChange={(checked) => {
                                const days = checked
                                  ? [...formData.recurringDays, index.toString()]
                                  : formData.recurringDays.filter(d => d !== index.toString());
                                setFormData({ ...formData, recurringDays: days });
                              }}
                            />
                            <label
                              htmlFor={`day-${index}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {day}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {task && !task.is_subtask && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Subtasks</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSubtaskInput(!showSubtaskInput)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Subtask
                      </Button>
                    </div>

                    {showSubtaskInput && (
                      <form onSubmit={handleCreateSubtask} className="space-y-4 p-4 border rounded-lg">
                        <div className="space-y-2">
                          <Input
                            value={newSubtask.name}
                            onChange={(e) => setNewSubtask({ ...newSubtask, name: e.target.value })}
                            placeholder="Subtask name"
                            required
                          />
                          <Textarea
                            value={newSubtask.description}
                            onChange={(e) => setNewSubtask({ ...newSubtask, description: e.target.value })}
                            placeholder="Subtask description (optional)"
                            className="min-h-[60px]"
                          />
                          <Select
                            value={newSubtask.priority}
                            onValueChange={(value: "Low" | "Medium" | "High") =>
                              setNewSubtask({ ...newSubtask, priority: value })
                            }
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
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowSubtaskInput(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">
                            Add Subtask
                          </Button>
                        </div>
                      </form>
                    )}

                    <Collapsible
                      open={showSubtasks}
                      onOpenChange={setShowSubtasks}
                      className="space-y-2"
                    >
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-2 text-muted-foreground w-full justify-start"
                        >
                          {showSubtasks ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {subtasks.length} Subtasks
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2">
                        {subtasks.map((subtask) => (
                          <div
                            key={subtask.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-accent/50"
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={subtask.completed}
                                onCheckedChange={(checked) =>
                                  handleToggleSubtask(subtask.id, checked as boolean)
                                }
                              />
                              <span className={cn(
                                subtask.completed && "line-through text-muted-foreground"
                              )}>
                                {subtask.name}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSubtask(subtask.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
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
              </form>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task
              {!task?.is_subtask && " and all its subtasks"}.
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
