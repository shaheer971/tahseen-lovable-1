import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { Task } from "../types";

interface MonthViewProps {
  date: Date;
  tasks: Task[];
}

const MonthView = ({ date, tasks }: MonthViewProps) => {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="grid grid-cols-7 gap-4 p-4">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
        <div key={day} className="text-center font-medium">
          {day}
        </div>
      ))}
      {days.map(day => {
        const dayTasks = tasks.filter(task =>
          isSameDay(new Date(task.due_date), day)
        );

        return (
          <div
            key={day.toISOString()}
            className={`min-h-[120px] rounded border p-2 ${
              !isSameMonth(day, date) ? "bg-gray-50" : ""
            }`}
          >
            <div className="text-right text-sm">{format(day, "d")}</div>
            <div className="mt-1 space-y-1">
              {dayTasks.map(task => (
                <div
                  key={task.id}
                  className="rounded bg-blue-100 p-1 text-xs"
                >
                  {task.name}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MonthView;