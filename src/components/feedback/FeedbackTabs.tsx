
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FeedbackList from "./FeedbackList";
import RoadmapView from "./RoadmapView";
import { useParams } from "react-router-dom";

const FeedbackTabs = () => {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return <div>Project ID is required</div>;
  }

  return (
    <Tabs defaultValue="list" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="list">Feedback List</TabsTrigger>
        <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
      </TabsList>
      <TabsContent value="list">
        <FeedbackList projectId={projectId} />
      </TabsContent>
      <TabsContent value="roadmap">
        <RoadmapView />
      </TabsContent>
    </Tabs>
  );
};

export default FeedbackTabs;
