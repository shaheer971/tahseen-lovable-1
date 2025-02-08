import { supabase } from '@/integrations/supabase/client';

export async function cleanupCompletedTodoTasks() {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .match({
      type: 'todo',
      completed: true
    });

  if (error) {
    console.error('Error cleaning up completed todo tasks:', error);
  }
}

export async function getRecurringTasksForToday() {
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('type', 'recurring')
    .contains('recurring_days', [dayOfWeek]);

  if (error) {
    console.error('Error fetching recurring tasks:', error);
    return [];
  }

  return data || [];
}
