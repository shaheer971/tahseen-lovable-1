import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";
import { MoreHorizontal, Tag, LayoutList, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import { ProjectTask } from "@/components/projects/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CalendarView from "./calendar/CalendarView";
import CreateProjectTaskFromDashboard from "./CreateProjectTaskFromDashboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

const ProjectTaskList = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { session } = useAuth();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*, projects(name)")
        .order("completed", { ascending: true })
        .order("priority", { ascending: false })
        .order("position");

      if (error) throw error;

      const typedData = (data || []).map(item => ({
        ...item,
        priority: item.priority as "Low" | "Medium" | "High",
        type: item.type as "Todo" | "Project" | "Recurring",
        status: item.status as "todo" | "in-progress" | "done"
      }));

      return typedData;
    }
  });

  const updateTaskCompletion = async (taskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from("project_tasks")
        .update({ completed })
        .eq("id", taskId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });

      toast({
        title: completed ? "Task completed" : "Task uncompleted",
        description: completed
          ? "The task has been marked as complete"
          : "The task has been marked as incomplete",
      });
    } catch (error) {
      console.error("Error updating task completion:", error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    if (!result.destination) return;

    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      position: index,
    }));

    // Optimistically update the UI
    queryClient.setQueryData(['project-tasks'], updatedItems);

    try {
      for (const item of updatedItems) {
        const { error } = await supabase
          .from("project_tasks")
          .update({ position: item.position })
          .eq("id", item.id);
        
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error updating task positions:", error);
      toast({
        title: "Error",
        description: "Failed to update task positions",
        variant: "destructive",
      });
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    }
  };

  const updateTask = async (task: ProjectTask) => {
    try {
      const { error } = await supabase
        .from("project_tasks")
        .update({
          name: task.name,
          description: task.description,
          priority: task.priority,
          type: task.type,
          due_date: task.due_date,
          due_time: task.due_time,
          status: task.status,
        })
        .eq("id", task.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });

      toast({
        title: "Success",
        description: "Task updated successfully",
      });
      
      setEditingTask(null);
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const getTaskStatusCounts = () => {
    const upcoming = tasks.filter(t => !t.completed).length;
    const overdue = tasks.filter(t => !t.completed && new Date(t.due_date) < new Date()).length;
    const completed = tasks.filter(t => t.completed).length;
    return { upcoming, overdue, completed };
  };

  const { upcoming, overdue, completed } = getTaskStatusCounts();

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Project Tasks</h2>
          <p className="text-sm text-gray-500">Tasks from all projects</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white rounded-lg p-1">
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
            >
              <LayoutList className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("calendar")}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Task
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Badge variant="secondary" className="gap-2">
          {upcoming} Upcoming
        </Badge>
        <Badge variant="secondary" className="gap-2">
          {overdue} Overdue
        </Badge>
        <Badge variant="secondary" className="gap-2">
          {completed} Completed
        </Badge>
      </div>

      {view === "list" ? (
        <DragDropContext
          onDragEnd={handleDragEnd}
          onDragStart={() => setIsDragging(true)}
        >
          <Droppable droppableId="tasks">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <Draggable
                      key={task.id}
                      draggableId={task.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-start gap-4">
                            <Checkbox
                              checked={task.completed}
                              onCheckedChange={(checked) =>
                                updateTaskCompletion(task.id, checked as boolean)
                              }
                            />
                            <div className="flex-1">
                              <h3 className="font-medium">{task.name}</h3>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <time>
                                    {format(new Date(task.due_date), "dd MMM yyyy")}
                                  </time>
                                  -
                                  <time>
                                    {format(
                                      new Date(`2000-01-01T${task.due_time}`),
                                      "hh:mma"
                                    )}
                                  </time>
                                </div>
                                {task.projects?.name && (
                                  <div className="flex items-center gap-1">
                                    <Tag className="h-3 w-3" />
                                    <span>{task.projects.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setEditingTask(task)}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Task</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <div className="grid gap-2">
                                    <label>Name</label>
                                    <Input
                                      value={editingTask?.name}
                                      onChange={(e) =>
                                        setEditingTask(prev => prev ? {
                                          ...prev,
                                          name: e.target.value
                                        } : null)
                                      }
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <label>Description</label>
                                    <Textarea
                                      value={editingTask?.description || ""}
                                      onChange={(e) =>
                                        setEditingTask(prev => prev ? {
                                          ...prev,
                                          description: e.target.value
                                        } : null)
                                      }
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <label>Priority</label>
                                    <Select
                                      value={editingTask?.priority}
                                      onValueChange={(value) =>
                                        setEditingTask(prev => prev ? {
                                          ...prev,
                                          priority: value as "Low" | "Medium" | "High"
                                        } : null)
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
                                  <div className="grid gap-2">
                                    <label>Due Date</label>
                                    <Input
                                      type="date"
                                      value={editingTask?.due_date.split('T')[0]}
                                      onChange={(e) =>
                                        setEditingTask(prev => prev ? {
                                          ...prev,
                                          due_date: e.target.value
                                        } : null)
                                      }
                                    />
                                  </div>
                                  <div className="grid gap-2">
                                    <label>Due Time</label>
                                    <Input
                                      type="time"
                                      value={editingTask?.due_time}
                                      onChange={(e) =>
                                        setEditingTask(prev => prev ? {
                                          ...prev,
                                          due_time: e.target.value
                                        } : null)
                                      }
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => setEditingTask(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => editingTask && updateTask(editingTask)}
                                    >
                                      Save Changes
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <CalendarView tasks={tasks} />
      )}

      <CreateProjectTaskFromDashboard
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default ProjectTaskList;
