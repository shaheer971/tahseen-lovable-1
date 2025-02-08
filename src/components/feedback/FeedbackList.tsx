
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageSquare, ThumbsUp, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CreateFeedbackDialog from "./CreateFeedbackDialog";
import { Badge } from "@/components/ui/badge";

interface FeedbackListProps {
  projectId: string;
}

const FeedbackList = ({ projectId }: FeedbackListProps) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ["project-feedback", projectId],
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

  const incrementViewCount = useMutation({
    mutationFn: async (feedbackId: string) => {
      const { error } = await supabase.rpc('increment_feedback_view_count', {
        feedback_id: feedbackId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-feedback", projectId] });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({
      feedbackId,
      hasVoted,
      voteId,
    }: {
      feedbackId: string;
      hasVoted: boolean;
      voteId?: string;
    }) => {
      if (hasVoted) {
        const { error } = await supabase
          .from("feedback_votes")
          .delete()
          .eq("id", voteId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("feedback_votes").insert([
          {
            feedback_id: feedbackId,
            user_id: session?.user.id,
          },
        ]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-feedback", projectId] });
    },
  });

  const handleVote = (
    feedbackId: string,
    votes: any[],
    currentUserId: string
  ) => {
    const userVote = votes.find((vote) => vote.user_id === currentUserId);
    voteMutation.mutate({
      feedbackId,
      hasVoted: !!userVote,
      voteId: userVote?.id,
    });
  };

  const handleView = (feedbackId: string) => {
    incrementViewCount.mutate(feedbackId);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Feedback List</h2>
        {session && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            Submit Feedback
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {feedback.map((item: any) => (
          <div
            key={item.id}
            className="bg-card border rounded-lg p-4 shadow-sm space-y-2"
            onClick={() => handleView(item.id)}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{item.title}</h3>
                  <Badge variant={item.status === 'new' ? 'default' : 'secondary'}>
                    {item.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center text-muted-foreground">
                  <Eye className="h-4 w-4 mr-1" />
                  <span>{item.view_count || 0}</span>
                </div>
                {session && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVote(item.id, item.feedback_votes, session.user.id);
                    }}
                  >
                    <ThumbsUp
                      className={`h-4 w-4 mr-2 ${
                        item.feedback_votes.some(
                          (vote: any) => vote.user_id === session.user.id
                        )
                          ? "fill-current"
                          : ""
                      }`}
                    />
                    {item.feedback_votes.length}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4 mr-1" />
              <span>
                {new Date(item.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      <CreateFeedbackDialog
        projectId={projectId}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default FeedbackList;
