import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { Task } from "../types";

interface WeekViewProps {
  date: Date;
  tasks: Task[];
}

const WeekView = ({ date, tasks }: WeekViewProps) => {
  const weekStart = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-7 gap-4 p-4">
      {days.map(day => {
        const dayTasks = tasks.filter(task => 
          isSameDay(new Date(task.due_date), day)
        );

        return (
          <div key={day.toISOString()} className="min-h-[120px]">
            <div className="mb-2 text-center">
              <div className="text-sm font-medium">
                {format(day, "EEE")}
              </div>
              <div className="text-2xl">{format(day, "d")}</div>
            </div>
            <div className="space-y-1">
              {dayTasks.map(task => (
                <div
                  key={task.id}
                  className="rounded bg-blue-100 p-2 text-sm"
                >
                  <div className="font-medium">{task.name}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WeekView;