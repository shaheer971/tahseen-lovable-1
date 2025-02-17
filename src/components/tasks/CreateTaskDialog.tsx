
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, PlusCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryClient } from "@tanstack/react-query";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date | null;
  onSuccess?: () => void;
}

interface Subtask {
  name: string;
  description?: string;
  priority: "Low" | "Medium" | "High";
}

const CreateTaskDialog = ({ open, onOpenChange, defaultDate, onSuccess }: CreateTaskDialogProps) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "Medium" as "Low" | "Medium" | "High",
    type: "",
    dueDate: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
    dueTime: "12:00",
  });
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState({
    name: "",
    description: "",
    priority: "Medium" as "Low" | "Medium" | "High"
  });

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.name.trim()) return;

    setSubtasks([...subtasks, { ...newSubtask }]);
    setNewSubtask({
      name: "",
      description: "",
      priority: "Medium"
    });
  };

  const removeSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create tasks",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name || !formData.priority || !formData.type || !formData.dueDate || !formData.dueTime) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create main task
      const { data: mainTask, error: mainTaskError } = await supabase
        .from("tasks")
        .insert({
          name: formData.name,
          description: formData.description,
          priority: formData.priority,
          type: formData.type as "Todo" | "Recurring",
          due_date: formData.dueDate,
          due_time: formData.dueTime,
          completed: false,
          user_id: session.user.id,
          recurring_days: formData.type === "Recurring" ? ["0", "1", "2", "3", "4", "5", "6"] : null,
          is_subtask: false,
        })
        .select()
        .single();

      if (mainTaskError) throw mainTaskError;

      // Create subtasks if any
      if (subtasks.length > 0 && mainTask) {
        const subtaskInserts = subtasks.map((subtask, index) => ({
          name: subtask.name,
          description: subtask.description,
          priority: subtask.priority,
          type: "Todo",
          due_date: formData.dueDate,
          due_time: formData.dueTime,
          completed: false,
          user_id: session.user.id,
          position: index,
          is_subtask: true,
          parent_task_id: mainTask.id,
        }));

        const { error: subtasksError } = await supabase
          .from("tasks")
          .insert(subtaskInserts);

        if (subtasksError) throw subtasksError;
      }

      toast({
        title: "Success",
        description: "Task created successfully",
      });

      setFormData({
        name: "",
        description: "",
        priority: "Medium",
        type: "",
        dueDate: defaultDate ? format(defaultDate, "yyyy-MM-dd") : "",
        dueTime: "12:00",
      });
      setSubtasks([]);

      if (onSuccess) {
        onSuccess();
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="w-[400px] p-0">
        <ScrollArea className="h-screen">
          <div className="p-6">
            <SheetHeader className="mb-6">
              <SheetTitle>Create New Task</SheetTitle>
              <SheetDescription>
                Add a new task to your calendar
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Main task fields */}
              <div className="space-y-2">
                <Label>Task Name</Label>
                <Input
                  placeholder="Enter task name"
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
                  placeholder="Enter task description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
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
                  onValueChange={(value) =>
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

              {/* Subtasks Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Subtasks</Label>
                </div>
                
                <div className="space-y-4">
                  {subtasks.map((subtask, index) => (
                    <div key={index} className="flex flex-col gap-2 p-3 border rounded-lg bg-accent/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium">{subtask.name}</div>
                          {subtask.description && (
                            <div className="text-sm text-muted-foreground">{subtask.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{subtask.priority}</span>
                          <Button 
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSubtask(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="space-y-3 p-3 border rounded-lg">
                    <div className="space-y-2">
                      <Input
                        value={newSubtask.name}
                        onChange={(e) => setNewSubtask({ ...newSubtask, name: e.target.value })}
                        placeholder="Subtask name"
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
                    <Button 
                      type="button" 
                      onClick={handleAddSubtask}
                      className="w-full"
                    >
                      Add Subtask
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Task</Button>
              </div>
            </form>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default CreateTaskDialog;
