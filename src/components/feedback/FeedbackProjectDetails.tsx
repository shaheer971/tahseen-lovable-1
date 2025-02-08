
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutList, FolderKanban, Calendar, ArrowLeft, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import FeedbackList from "./FeedbackList";
import FeedbackBoardView from "./FeedbackBoardView";
import FeedbackCalendarView from "./FeedbackCalendarView";

const FeedbackProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [view, setView] = useState<"list" | "board" | "calendar">("list");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: project, isLoading } = useQuery({
    queryKey: ['feedback-project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("feedback_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("Project not found");
      }
      return data;
    },
  });

  const handleDelete = async () => {
    if (!projectId) return;

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
      navigate("/dashboard/feedback");
    } catch (error) {
      console.error("Error deleting feedback project:", error);
      toast({
        title: "Error",
        description: "Failed to delete feedback project",
        variant: "destructive",
      });
    }
  };

  if (!projectId) {
    return <div>Project ID is required</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-2xl font-bold mb-4">Project not found</h2>
        <Button onClick={() => navigate("/dashboard/feedback")}>
          Return to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/feedback")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{project.title}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white rounded-lg border p-1">
              <Button
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
              >
                <LayoutList className="h-4 w-4 mr-2" />
                List
              </Button>
              <Button
                variant={view === "board" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("board")}
              >
                <FolderKanban className="h-4 w-4 mr-2" />
                Board
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
              variant="destructive"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {view === "list" && <FeedbackList projectId={projectId} />}
      {view === "board" && <FeedbackBoardView projectId={projectId} />}
      {view === "calendar" && <FeedbackCalendarView projectId={projectId} />}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              feedback project and all associated feedback items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FeedbackProjectDetails;
