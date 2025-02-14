export interface Task {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  priority: "Low" | "Medium" | "High";
  type: "Todo" | "Recurring";  // Updated to just Todo and Recurring
  due_date: string;
  due_time: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  project_id?: string | null;
  recurring_days?: string[] | null;
  projects?: {
    name: string;
  } | null;
}