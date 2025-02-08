import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, GripVertical, Eye, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import CreateFeedbackProjectDialog from "./CreateFeedbackProjectDialog";
import EditFeedbackProjectDialog from "./EditFeedbackProjectDialog";
import { FeedbackProject } from "./types";

const FeedbackProjectList = () => {
  const [projects, setProjects] = useState<FeedbackProject[]>([]);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<FeedbackProject | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: feedbackProjects = [], isLoading } = useQuery({
    queryKey: ['feedback-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_projects")
        .select(`
          *,
          feedback (count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleDelete = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from("feedback_projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Feedback project deleted successfully",
      });
      setDeleteProjectId(null);
    } catch (error) {
      console.error("Error deleting feedback project:", error);
      toast({
        title: "Error",
        description: "Failed to delete feedback project",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Feedback Projects</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Feedback Project
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Feedback Count</TableHead>
              <TableHead>Public URL</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbackProjects.map((project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={() => navigate(`/dashboard/feedback/${project.id}`)}
              >
                <TableCell className="font-medium">{project.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  {project.description}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={project.status === "active" ? "default" : "secondary"}
                  >
                    {project.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(project.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>{project.feedback[0].count}</TableCell>
                <TableCell>
                  {project.is_public ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Copy public URL to clipboard
                        navigator.clipboard.writeText(
                          `${window.location.origin}/feedback/${project.public_url}`
                        );
                        toast({
                          title: "Success",
                          description: "Public URL copied to clipboard",
                        });
                      }}
                    >
                      Copy URL
                    </Button>
                  ) : (
                    "Private"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditProject(project)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteProjectId(project.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateFeedbackProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <EditFeedbackProjectDialog
        project={editProject}
        open={!!editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
      />

      <AlertDialog
        open={!!deleteProjectId}
        onOpenChange={() => setDeleteProjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              feedback project and all its associated feedback.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProjectId && handleDelete(deleteProjectId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FeedbackProjectList;
