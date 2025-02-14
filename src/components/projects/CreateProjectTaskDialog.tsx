import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

const taskSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High"]),
  due_date: z.string(),
  due_time: z.string(),
});

interface CreateProjectTaskDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStatus?: "todo" | "in-progress" | "done";
  defaultValues?: {
    status?: "todo" | "in-progress" | "done";
  };
}

type FormData = {
  name: string;
  description: string;
  priority: "Low" | "Medium" | "High";
  due_date: string;
  due_time: string;
};

const CreateProjectTaskDialog = ({
  projectId,
  open,
  onOpenChange,
  initialStatus = "todo",
  defaultValues
}: CreateProjectTaskDialogProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    priority: "Medium",
    due_date: new Date().toISOString().split('T')[0],
    due_time: "12:00"
  });
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from("project_tasks")
        .insert({
          ...formData,
          project_id: projectId,
          user_id: session?.user.id,
          status: initialStatus,
          type: "Todo",
          position: 0
        });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      onOpenChange(false);
      
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New Task</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label>Name</label>
            <Input 
              name="name" 
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required 
            />
          </div>
          <div className="space-y-2">
            <label>Description</label>
            <Textarea 
              name="description" 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label>Priority</label>
            <Select 
              name="priority" 
              value={formData.priority}
              onValueChange={(value: "Low" | "Medium" | "High") => setFormData({ ...formData, priority: value })}
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
            <label>Due Date</label>
            <Input 
              type="date" 
              name="due_date" 
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              required 
            />
          </div>
          <div className="space-y-2">
            <label>Due Time</label>
            <Input 
              type="time" 
              name="due_time" 
              value={formData.due_time}
              onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
              required 
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Task</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default CreateProjectTaskDialog;
