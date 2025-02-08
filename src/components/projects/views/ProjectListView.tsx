import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectTask } from "@/components/projects/types";
import TaskSheet from "@/components/tasks/TaskSheet";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ProjectListViewProps {
  projectId: string;
}

const ProjectListView = ({ projectId }: ProjectListViewProps) => {
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [todoCollapsed, setTodoCollapsed] = useState(false);
  const [doneCollapsed, setDoneCollapsed] = useState(true);
  const queryClient = useQueryClient();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "border-red-500 text-red-500";
      case "Medium":
        return "border-yellow-500 text-yellow-500";
      case "Low":
        return "border-green-500 text-green-500";
      default:
        return "";
    }
  };

  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("completed", { ascending: true })
        .order("priority", { ascending: false })  // High to Low
        .order("position");  // Then by position within priority groups

      if (error) throw error;

      const typedData: ProjectTask[] = (data || []).map(task => ({
        ...task,
        priority: task.priority as "Low" | "Medium" | "High",
        type: task.type as "Todo" | "Project" | "Recurring",
        status: task.status as "todo" | "in-progress" | "done"
      }));

      // Group tasks by priority and assign positions
      const priorityGroups = {
        High: typedData.filter(t => t.priority === "High" && !t.completed),
        Medium: typedData.filter(t => t.priority === "Medium" && !t.completed),
        Low: typedData.filter(t => t.priority === "Low" && !t.completed)
      };

      let currentPosition = 0;
      const orderedTasks = [
        ...priorityGroups.High,
        ...priorityGroups.Medium,
        ...priorityGroups.Low,
        ...typedData.filter(t => t.completed)
      ].map(task => ({
        ...task,
        position: currentPosition++
      }));

      return orderedTasks;
    },
    refetchOnWindowFocus: false
  });

  const todoTasks = tasks.filter(task => !task.completed)
    .sort((a, b) => {
      const priorityOrder = { High: 3, Medium: 2, Low: 1 };
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      return priorityDiff !== 0 ? priorityDiff : a.position - b.position;
    });

  const doneTasks = tasks.filter(task => task.completed)
    .sort((a, b) => a.position - b.position);

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      await supabase
        .from("project_tasks")
        .update({ completed })
        .eq("id", taskId);

      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    } catch (error) {
      console.error("Error updating task completion:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("project_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      setIsSheetOpen(false);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    const droppableId = result.source.droppableId;
    
    const tasksToReorder = droppableId === 'todo-tasks' ? todoTasks : doneTasks;
    const items = Array.from(tasksToReorder);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destinationIndex, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({
      ...item,
      position: index,
    }));

    // Optimistically update the UI
    queryClient.setQueryData(['project-tasks', projectId], (oldData: ProjectTask[]) => {
      if (!oldData) return oldData;
      const newData = [...oldData];
      
      updatedItems.forEach((item, index) => {
        const dataIndex = newData.findIndex(t => t.id === item.id);
        if (dataIndex !== -1) {
          newData[dataIndex] = { ...newData[dataIndex], position: index };
        }
      });
      
      return newData;
    });

    try {
      for (const item of updatedItems) {
        await supabase
          .from("project_tasks")
          .update({ position: item.position })
          .eq("id", item.id);
      }
    } catch (error) {
      console.error("Error updating task positions:", error);
      queryClient.invalidateQueries({ 
        queryKey: ['project-tasks', projectId]
      });
    }
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={onDragEnd}>
        {/* To Do Section */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full flex justify-between items-center p-2 hover:bg-accent/50"
            onClick={() => setTodoCollapsed(!todoCollapsed)}
          >
            <div className="flex items-center gap-2">
              {todoCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="font-semibold">To Do</span>
              <Badge variant="secondary" className="ml-2">
                {todoTasks.length}
              </Badge>
            </div>
          </Button>

          {!todoCollapsed && (
            <Droppable droppableId="todo-tasks">
              {(provided) => (
                <div 
                  className="rounded-md border"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todoTasks.map((task, index) => (
                        <Draggable 
                          key={task.id} 
                          draggableId={task.id} 
                          index={index}
                        >
                          {(provided) => (
                            <TableRow
                              ref={provided.innerRef}
                              className="cursor-pointer"
                              onClick={() => {
                                setSelectedTask(task);
                                setIsSheetOpen(true);
                              }}
                            >
                              <TableCell 
                                className="w-12 cursor-grab"
                                {...provided.dragHandleProps}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </TableCell>
                              <TableCell 
                                onClick={(e) => e.stopPropagation()}
                                className="w-12"
                              >
                                <Checkbox 
                                  className="rounded-sm"
                                  checked={task.completed}
                                  onCheckedChange={(checked) => {
                                    handleToggleComplete(task.id, checked as boolean);
                                  }}
                                />
                              </TableCell>
                              <TableCell 
                                {...provided.draggableProps}
                                className="font-medium"
                              >
                                {task.name}
                              </TableCell>
                              <TableCell 
                                {...provided.draggableProps}
                                className="text-muted-foreground"
                              >
                                {task.description}
                              </TableCell>
                              <TableCell {...provided.draggableProps}>
                                {format(new Date(task.due_date), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell {...provided.draggableProps}>
                                {format(new Date(`2000-01-01T${task.due_time}`), "h:mm a")}
                              </TableCell>
                              <TableCell {...provided.draggableProps}>
                                <Badge 
                                  variant="outline"
                                  className={getPriorityColor(task.priority)}
                                >
                                  {task.priority}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Droppable>
          )}
        </div>

        {/* Done Section */}
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full flex justify-between items-center p-2 hover:bg-accent/50"
            onClick={() => setDoneCollapsed(!doneCollapsed)}
          >
            <div className="flex items-center gap-2">
              {doneCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="font-semibold">Done</span>
              <Badge variant="secondary" className="ml-2">
                {doneTasks.length}
              </Badge>
            </div>
          </Button>

          {!doneCollapsed && (
            <Droppable droppableId="done-tasks">
              {(provided) => (
                <div 
                  className="rounded-md border"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doneTasks.map((task, index) => (
                        <Draggable 
                          key={task.id} 
                          draggableId={task.id} 
                          index={index}
                        >
                          {(provided) => (
                            <TableRow
                              ref={provided.innerRef}
                              className="cursor-pointer opacity-50"
                              onClick={() => {
                                setSelectedTask(task);
                                setIsSheetOpen(true);
                              }}
                            >
                              <TableCell 
                                className="w-12 cursor-grab"
                                {...provided.dragHandleProps}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </TableCell>
                              <TableCell 
                                onClick={(e) => e.stopPropagation()}
                                className="w-12"
                              >
                                <Checkbox 
                                  className="rounded-sm"
                                  checked={task.completed}
                                  onCheckedChange={(checked) => {
                                    handleToggleComplete(task.id, checked as boolean);
                                  }}
                                />
                              </TableCell>
                              <TableCell 
                                {...provided.draggableProps}
                                className="font-medium"
                              >
                                {task.name}
                              </TableCell>
                              <TableCell 
                                {...provided.draggableProps}
                                className="text-muted-foreground"
                              >
                                {task.description}
                              </TableCell>
                              <TableCell {...provided.draggableProps}>
                                {format(new Date(task.due_date), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell {...provided.draggableProps}>
                                {format(new Date(`2000-01-01T${task.due_time}`), "h:mm a")}
                              </TableCell>
                              <TableCell {...provided.draggableProps}>
                                <Badge 
                                  variant="outline"
                                  className={getPriorityColor(task.priority)}
                                >
                                  {task.priority}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Droppable>
          )}
        </div>
      </DragDropContext>

      <TaskSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        task={selectedTask}
        onTaskUpdate={() => queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] })}
        onTaskDelete={handleDeleteTask}
        projectId={projectId}
      />
    </div>
  );
};

export default ProjectListView;