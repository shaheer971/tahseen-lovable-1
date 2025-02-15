
import TaskList from "@/components/tasks/TaskList";
import TodayTasks from "@/components/tasks/TodayTasks";

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="w-full bg-card border rounded-lg shadow-sm p-4 md:p-6 col-span-2">
          <div className="h-[calc(100vh-280px)] md:h-[calc(9/15*100vw)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <TaskList />
          </div>
        </div>
        <div className="w-full">
          <TodayTasks />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
