
import TodayTasks from "@/components/tasks/TodayTasks";

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="w-full">
          <TodayTasks />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
