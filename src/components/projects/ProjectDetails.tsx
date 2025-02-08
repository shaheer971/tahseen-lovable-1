import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Project } from "./types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ProjectListView from "./views/ProjectListView";
import ProjectBoardView from "./views/ProjectBoardView";
import ProjectCalendarView from "./views/ProjectCalendarView";
import { LayoutList, FolderKanban, Calendar, ArrowLeft, Plus } from "lucide-react";
import CreateProjectTaskDialog from "./CreateProjectTaskDialog";

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [view, setView] = useState<"list" | "board" | "calendar">("list");
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const navigate = useNavigate();

  const fetchProject = useCallback(async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      if (data) {
        const typedProject: Project = {
          ...data,
          status: data.status as "todo" | "in_progress" | "completed",
          description: data.description || null
        };
        setProject(typedProject);
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    }
  }, [projectId]);

  const subscribeToProject = useCallback(() => {
    if (!projectId) return () => {};

    const channel = supabase
      .channel("project-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          console.log("Real-time update:", payload);
          fetchProject();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchProject]);

  useEffect(() => {
    if (projectId) {
      fetchProject();
      subscribeToProject();
    }
  }, [projectId, fetchProject, subscribeToProject]);

  if (!project) return null;

  return (
    <div className="space-y-6 px-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/projects")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-1">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {view === "list" && (
              <Button onClick={() => setIsCreateTaskOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            )}
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
          </div>
        </div>
      </div>

      {/* <div className="w-full">
        <Progress value={project.progress} className="h-2" />
      </div> */}

      {view === "list" && <ProjectListView projectId={project.id} />}
      {view === "board" && <ProjectBoardView projectId={project.id} />}
      {view === "calendar" && <ProjectCalendarView projectId={project.id} />}

      <CreateProjectTaskDialog
        projectId={project.id}
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
      />
    </div>
  );
};

export default ProjectDetails;