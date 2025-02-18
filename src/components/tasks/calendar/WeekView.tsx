
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { Task } from "../types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface WeekViewProps {
  date: Date;
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskComplete?: (taskId: string, completed: boolean) => void;
}

const WeekView = ({ date, tasks, onTaskClick, onTaskComplete }: WeekViewProps) => {
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const weekStart = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const toggleTaskExpanded = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  return (
    <div className="grid grid-cols-7 gap-4 p-4">
      {days.map(day => {
        const dayTasks = tasks.filter(task => 
          isSameDay(new Date(task.due_date), day) && !task.is_subtask
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
                <div key={task.id} className="space-y-1">
                  <div
                    className={cn(
                      "rounded bg-accent/50 p-2 text-sm hover:bg-accent cursor-pointer",
                      task.completed && "opacity-60"
                    )}
                    onClick={() => onTaskClick?.(task)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={(checked) => {
                            onTaskComplete?.(task.id, checked as boolean);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className={cn(
                          "truncate",
                          task.completed && "line-through text-muted-foreground"
                        )}>
                          {task.name}
                        </span>
                      </div>
                      {task.subtasks && task.subtasks.length > 0 && (
                        <button
                          onClick={(e) => toggleTaskExpanded(task.id, e)}
                          className="p-1 hover:bg-accent rounded"
                        >
                          {expandedTasks.includes(task.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedTasks.includes(task.id) && task.subtasks && task.subtasks.length > 0 && (
                    <div className="ml-4 space-y-1">
                      {task.subtasks.map(subtask => (
                        <div
                          key={subtask.id}
                          className={cn(
                            "rounded bg-background p-2 text-sm border hover:bg-accent/50 cursor-pointer",
                            subtask.completed && "opacity-60"
                          )}
                          onClick={() => onTaskClick?.(subtask)}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={subtask.completed}
                              onCheckedChange={(checked) => {
                                onTaskComplete?.(subtask.id, checked as boolean);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className={cn(
                              "truncate",
                              subtask.completed && "line-through text-muted-foreground"
                            )}>
                              {subtask.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
