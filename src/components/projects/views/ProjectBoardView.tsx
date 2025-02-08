import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProjectTask } from "../types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import CreateProjectTaskDialog from "../CreateProjectTaskDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ProjectBoardViewProps {
  projectId: string;
}

const ProjectBoardView = ({ projectId }: ProjectBoardViewProps) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"todo" | "in-progress" | "done">("todo");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("position");

      if (error) throw error;
      
      return data.map(task => ({
        ...task,
        priority: task.priority as "Low" | "Medium" | "High",
        type: task.type as "Todo" | "Project" | "Recurring",
        status: task.status as "todo" | "in-progress" | "done"
      }));
    }
  });

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const taskId = result.draggableId;
    const newStatus = destination.droppableId as "todo" | "in-progress" | "done";

    // Optimistically update the UI
    queryClient.setQueryData(['project-tasks', projectId], (oldData: ProjectTask[]) => {
      const updatedTasks = [...oldData];
      const [removed] = updatedTasks.splice(source.index, 1);
      removed.status = newStatus;
      updatedTasks.splice(destination.index, 0, removed);
      return updatedTasks;
    });

    try {
      const { error } = await supabase
        .from("project_tasks")
        .update({ 
          status: newStatus,
          position: destination.index 
        })
        .eq("id", taskId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
      // Revert optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    }
  };

  const handleAddTask = (status: "todo" | "in-progress" | "done") => {
    setSelectedStatus(status);
    setCreateDialogOpen(true);
  };

  const columns = [
    { id: "todo", name: "To Do" },
    { id: "in-progress", name: "In Progress" },
    { id: "done", name: "Done" },
  ] as const;

  return (
    <div className="board-view h-full p-4 space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((column) => (
            <div key={column.id} className="bg-card rounded-lg p-4 space-y-4 border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{column.name}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddTask(column.id)}
                  className="h-8 px-2"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Droppable droppableId={column.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {tasks
                      .filter((task) => task.status === column.id)
                      .map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-white p-4 rounded-lg shadow border"
                            >
                              <h4 className="font-medium">{task.name}</h4>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary">
                                  {task.priority}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {format(new Date(task.due_date), "MMM dd")}
                                </span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
      <CreateProjectTaskDialog
        projectId={projectId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialStatus={selectedStatus}
      />
    </div>
  );
};

export default ProjectBoardView;
