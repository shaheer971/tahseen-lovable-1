import { format, isSameDay, parse } from "date-fns";
import { Task } from "../types";

interface DayViewProps {
  date: Date;
  tasks: Task[];
}

const DayView = ({ date, tasks }: DayViewProps) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayTasks = tasks.filter(task => isSameDay(new Date(task.due_date), date));

  return (
    <div className="min-h-[600px] p-4">
      <div className="grid grid-cols-[100px_1fr] gap-4">
        {hours.map(hour => {
          const timeStr = `${hour.toString().padStart(2, "0")}:00`;
          const hourTasks = dayTasks.filter(
            task => format(parse(task.due_time, "HH:mm:ss", new Date()), "HH:00") === timeStr
          );

          return (
            <div key={hour} className="relative min-h-[60px]">
              <div className="text-sm text-gray-500">{timeStr}</div>
              <div className="absolute left-[100px] min-w-[200px]">
                {hourTasks.map(task => (
                  <div
                    key={task.id}
                    className="mb-1 rounded bg-blue-100 p-2 text-sm"
                  >
                    <div className="font-medium">{task.name}</div>
                    <div className="text-xs text-gray-500">
                      {format(parse(task.due_time, "HH:mm:ss", new Date()), "HH:mm")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DayView;