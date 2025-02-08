export interface FeedbackProject {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  public_url: string;
  feedback: { count: number }[];
}
