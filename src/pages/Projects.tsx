
import { Routes, Route } from "react-router-dom";
import ProjectList from "@/components/projects/ProjectList";
import ProjectDetails from "@/components/projects/ProjectDetails";

const Projects = () => {
  return (
    <div className="h-full">
      <div className="flex-1">
        <Routes>
          <Route index element={<ProjectList />} />
          <Route path=":projectId/*" element={<ProjectDetails />} />
        </Routes>
      </div>
    </div>
  );
};

export default Projects;
