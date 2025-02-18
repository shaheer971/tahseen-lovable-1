
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
import { PlusCircle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [subtaskName, setSubtaskName] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(true);

  const { data: subtasks = [], isLoading: isLoadingSubtasks } = useQuery({
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
    enabled: !!task?.id
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
    if (!session?.user?.id) return;

    try {
      const taskData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        priority: formData.priority as "Low" | "Medium" | "High",
        type: formData.type,
        due_date: formData.dueDate,
        due_time: formData.dueTime + ":00",
        recurring_days: formData.type === "Recurring" ? formData.recurringDays : [],
        user_id: session.user.id,
        project_id: projectId || null,
        is_subtask: false,
        parent_task_id: null
      };

      if (task) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", task.id);

        if (error) throw error;
        toast({ title: "Task updated successfully" });
      } else {
        const { error } = await supabase
          .from("tasks")
          .insert([taskData]);

        if (error) throw error;
        toast({ title: "Task created successfully" });
      }

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      onOpenChange(false);
      if (onTaskUpdate) onTaskUpdate();
      if (onClose) onClose();
    } catch (error: any) {
      console.error("Error managing task:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !task?.id || !subtaskName.trim()) return;

    try {
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("position")
        .eq("parent_task_id", task.id)
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = tasksData && tasksData[0] ? tasksData[0].position + 1000 : 0;

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          name: subtaskName.trim(),
          user_id: session.user.id,
          parent_task_id: task.id,
          is_subtask: true,
          priority: formData.priority || "Medium",
          type: "Todo",
          due_date: formData.dueDate,
          due_time: formData.dueTime + ":00",
          position: nextPosition,
          completed: false,
        })
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['subtasks', task.id] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      setSubtaskName("");
      setShowSubtaskInput(false);
      toast({ title: "Subtask created successfully" });
    } catch (error: any) {
      console.error("Error creating subtask:", error);
      toast({
        title: "Error",
        description: error.message,
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
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast({
        title: completed ? "Subtask completed" : "Subtask uncompleted"
      });
    } catch (error: any) {
      console.error("Error updating subtask:", error);
      toast({
        title: "Error",
        description: error.message,
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
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast({ title: "Subtask deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting subtask:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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

              {task && !task.is_subtask && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <Label>Subtasks</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSubtaskInput(!showSubtaskInput)}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Subtask
                    </Button>
                  </div>

                  {showSubtaskInput && (
                    <form onSubmit={handleCreateSubtask} className="flex items-center gap-2">
                      <Input
                        value={subtaskName}
                        onChange={(e) => setSubtaskName(e.target.value)}
                        placeholder="Enter subtask name"
                        className="flex-1"
                      />
                      <Button type="submit" size="sm">
                        Add
                      </Button>
                    </form>
                  )}

                  <Collapsible open={showSubtasks} onOpenChange={setShowSubtasks}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                      {showSubtasks ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {subtasks.length} Subtasks
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <ScrollArea className="h-[200px] pr-4">
                        <div className="space-y-2">
                          {subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent"
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <Checkbox
                                  checked={subtask.completed}
                                  onCheckedChange={(checked) =>
                                    handleToggleSubtask(subtask.id, checked as boolean)
                                  }
                                />
                                <span className={cn(
                                  "text-sm",
                                  subtask.completed && "line-through text-muted-foreground"
                                )}>
                                  {subtask.name}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSubtask(subtask.id)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
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
              This action cannot be undone. This will permanently delete the task
              {!task?.is_subtask ? " and all its subtasks" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => task?.id && onTaskDelete?.(task.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TaskSheet;
