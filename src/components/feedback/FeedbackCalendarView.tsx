
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type CalendarViewType = "day" | "week" | "month";

interface FeedbackCalendarViewProps {
  projectId: string;
}

const FeedbackCalendarView = ({ projectId }: FeedbackCalendarViewProps) => {
  const [viewType, setViewType] = useState<CalendarViewType>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ['project-feedback', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");

      if (error) throw error;
      return data;
    },
  });

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    switch (viewType) {
      case "day":
        newDate.setDate(currentDate.getDate() - 1);
        break;
      case "week":
        newDate.setDate(currentDate.getDate() - 7);
        break;
      case "month":
        newDate.setMonth(currentDate.getMonth() - 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    switch (viewType) {
      case "day":
        newDate.setDate(currentDate.getDate() + 1);
        break;
      case "week":
        newDate.setDate(currentDate.getDate() + 7);
        break;
      case "month":
        newDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
    setCurrentDate(newDate);
  };

  const renderDayView = () => {
    const dayFeedback = feedback.filter(item => 
      isSameDay(new Date(item.created_at), currentDate)
    );

    return (
      <div className="space-y-4">
        {dayFeedback.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-medium">{item.title}</h3>
            <div className="text-sm text-gray-500 mt-1">
              {format(new Date(item.created_at), "h:mm a")}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="grid grid-cols-7 gap-4">
        {days.map(day => {
          const dayFeedback = feedback.filter(item => 
            isSameDay(new Date(item.created_at), day)
          );

          return (
            <div key={day.toISOString()} className="min-h-[120px]">
              <div className="text-center mb-2">
                <div className="font-medium">{format(day, "EEE")}</div>
                <div className="text-2xl">{format(day, "d")}</div>
              </div>
              <div className="space-y-1">
                {dayFeedback.map(item => (
                  <div
                    key={item.id}
                    className="bg-blue-100 p-2 rounded text-sm"
                  >
                    {item.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="grid grid-cols-7 gap-4">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-center font-medium">
            {day}
          </div>
        ))}
        {days.map(day => {
          const dayFeedback = feedback.filter(item => 
            isSameDay(new Date(item.created_at), day)
          );

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[120px] rounded border p-2 ${
                !isSameMonth(day, currentDate) ? "bg-gray-50" : ""
              }`}
            >
              <div className="text-right text-sm">{format(day, "d")}</div>
              <div className="mt-1 space-y-1">
                {dayFeedback.map(item => (
                  <div
                    key={item.id}
                    className="bg-blue-100 p-1 rounded text-xs"
                  >
                    {item.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold">
            {format(currentDate, "MMMM yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewType === "day" ? "default" : "outline"}
            onClick={() => setViewType("day")}
          >
            Day
          </Button>
          <Button
            variant={viewType === "week" ? "default" : "outline"}
            onClick={() => setViewType("week")}
          >
            Week
          </Button>
          <Button
            variant={viewType === "month" ? "default" : "outline"}
            onClick={() => setViewType("month")}
          >
            Month
          </Button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        {viewType === "day" && renderDayView()}
        {viewType === "week" && renderWeekView()}
        {viewType === "month" && renderMonthView()}
      </div>
    </div>
  );
};

export default FeedbackCalendarView;
