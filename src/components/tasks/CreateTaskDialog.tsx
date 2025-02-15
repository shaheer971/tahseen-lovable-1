
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
}

const CreateTaskDialog = ({ open, onOpenChange, defaultDate, onSuccess }: CreateTaskDialogProps) => {
  const { toast } = useToast();
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
  const [newSubtask, setNewSubtask] = useState("");

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;

    setSubtasks([...subtasks, { name: newSubtask.trim() }]);
    setNewSubtask("");
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
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("position")
        .eq("user_id", session.user.id)
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = tasksData && tasksData[0] ? tasksData[0].position + 1 : 0;

      // Create main task
      const { data: mainTask, error: mainTaskError } = await supabase
        .from("tasks")
        .insert({
          name: formData.name,
          description: formData.description || "",
          priority: formData.priority,
          type: formData.type as "Todo" | "Recurring",
          due_date: formData.dueDate,
          due_time: formData.dueTime,
          completed: false,
          position: nextPosition,
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
          user_id: session.user.id,
          priority: formData.priority,
          type: "Todo",
          due_date: formData.dueDate,
          due_time: formData.dueTime,
          completed: false,
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

      queryClient.invalidateQueries({ queryKey: ['tasks'] });

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
      <SheetContent 
        side="right" 
        className="w-[400px] p-0"
      >
        <ScrollArea className="h-screen">
          <div className="p-6">
            <SheetHeader className="mb-6">
              <SheetTitle>Create New Task</SheetTitle>
              <SheetDescription>
                Add a new task to your calendar
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                
                <div className="space-y-2">
                  {subtasks.map((subtask, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm flex-1">{subtask.name}</span>
                      <Button 
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubtask(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  
                  <form onSubmit={handleAddSubtask} className="flex gap-2">
                    <Input
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="New subtask name"
                      className="flex-1"
                    />
                    <Button type="submit" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </form>
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
