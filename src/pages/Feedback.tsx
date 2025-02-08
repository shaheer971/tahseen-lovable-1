
import { Routes, Route } from "react-router-dom";
import FeedbackProjectList from "@/components/feedback/FeedbackProjectList";
import FeedbackProjectDetails from "@/components/feedback/FeedbackProjectDetails";

const Feedback = () => {
  return (
    <div className="h-full">
      <div className="flex-1">
        <Routes>
          <Route index element={<FeedbackProjectList />} />
          <Route path=":projectId/*" element={<FeedbackProjectDetails />} />
        </Routes>
      </div>
    </div>
  );
};

export default Feedback;
