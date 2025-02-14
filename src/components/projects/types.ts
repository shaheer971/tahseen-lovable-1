
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  status: 'todo' | 'in_progress' | 'completed';
  progress: number;
  team_size: number;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  description: string | null;
  priority: "Low" | "Medium" | "High";
  type: "Todo" | "Recurring" | "Project";
  status: "todo" | "in-progress" | "done";
  due_date: string;
  due_time: string;
  position: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}
