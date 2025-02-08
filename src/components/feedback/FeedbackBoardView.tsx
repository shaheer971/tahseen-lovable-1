
import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Plus, ThumbsUp, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CreateFeedbackDialog from "./CreateFeedbackDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface FeedbackBoardViewProps {
  projectId: string;
}

const FeedbackBoardView = ({ projectId }: FeedbackBoardViewProps) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"new" | "in-progress" | "completed">("new");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ['project-feedback', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select(`
          *,
          feedback_votes (
            id,
            user_id
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const feedbackId = result.draggableId;
    const newStatus = destination.droppableId;

    try {
      const { error } = await supabase
        .from("feedback")
        .update({ status: newStatus })
        .eq("id", feedbackId);

      if (error) throw error;

      // Invalidate the query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['project-feedback', projectId] });
      
      toast({
        title: "Status updated",
        description: "Feedback status has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating feedback:", error);
      toast({
        title: "Error",
        description: "Failed to update feedback status",
        variant: "destructive",
      });
    }
  };

  const handleAddFeedback = (status: "new" | "in-progress" | "completed") => {
    setSelectedStatus(status);
    setCreateDialogOpen(true);
  };

  const columns = [
    { id: "new", name: "New" },
    { id: "in-progress", name: "In Progress" },
    { id: "completed", name: "Completed" },
  ] as const;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((column) => (
          <div key={column.id} className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">{column.name}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddFeedback(column.id)}
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
                  className="space-y-2 min-h-[200px]"
                >
                  {feedback
                    .filter((item) => item.status === column.id)
                    .map((item, index) => (
                      <Draggable
                        key={item.id}
                        draggableId={item.id}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="bg-white p-4 rounded-lg shadow border"
                          >
                            <h4 className="font-medium">{item.title}</h4>
                            {item.description && (
                              <p className="text-sm text-gray-600 mt-1">
                                {item.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary">
                                {item.type || 'Feedback'}
                              </Badge>
                              <div className="flex items-center text-muted-foreground">
                                <ThumbsUp className="h-4 w-4 mr-1" />
                                <span>{item.feedback_votes?.length || 0}</span>
                              </div>
                              <div className="flex items-center text-muted-foreground">
                                <Eye className="h-4 w-4 mr-1" />
                                <span>{item.view_count || 0}</span>
                              </div>
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
      <CreateFeedbackDialog
        projectId={projectId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        initialStatus={selectedStatus}
      />
    </DragDropContext>
  );
};

export default FeedbackBoardView;
