import { supabase } from '@/integrations/supabase/client';

// Create a completed recurring task instance for today
export async function createCompletedRecurringTaskInstance(taskId: string, userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Check if we already have a completion record for today
    const { data: existing } = await supabase
      .from('recurring_task_completions')
      .select('*')
      .eq('task_id', taskId)
      .eq('completed_date', today)
      .single();

    if (!existing) {
      // Create new completion record
      const { error } = await supabase
        .from('recurring_task_completions')
        .insert([{
          task_id: taskId,
          user_id: userId,
          completed_date: today
        }]);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error recording recurring task completion:', error);
  }
}

// Check if a recurring task is completed for today
export async function isRecurringTaskCompletedToday(taskId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('recurring_task_completions')
    .select('*')
    .eq('task_id', taskId)
    .eq('completed_date', today)
    .single();

  return !!data;
}

export async function cleanupCompletedTodoTasks() {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .match({
      type: 'Todo',
      completed: true
    });

  if (error) {
    console.error('Error cleaning up completed todo tasks:', error);
  }
}

// Clean up old recurring task completions (keep last 30 days)
export async function cleanupOldRecurringCompletions() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { error } = await supabase
    .from('recurring_task_completions')
    .delete()
    .lt('completed_date', thirtyDaysAgo.toISOString().split('T')[0]);

  if (error) {
    console.error('Error cleaning up old recurring task completions:', error);
  }
}

export async function getRecurringTasksForToday() {
  const today = new Date();
  const dayOfWeek = today.getDay().toString();
  const todayStr = today.toISOString().split('T')[0];

  // Get all recurring tasks for today
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('type', 'Recurring')
    .contains('recurring_days', [dayOfWeek]);

  if (error) {
    console.error('Error fetching recurring tasks:', error);
    return [];
  }

  if (!tasks) return [];

  // Get completions for today
  const { data: completions } = await supabase
    .from('recurring_task_completions')
    .select('task_id')
    .eq('completed_date', todayStr);

  const completedTaskIds = new Set((completions || []).map(c => c.task_id));

  // Mark tasks as completed if they have a completion record for today
  return tasks.map(task => ({
    ...task,
    completed: completedTaskIds.has(task.id)
  }));
}
