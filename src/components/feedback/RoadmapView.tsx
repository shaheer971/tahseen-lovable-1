import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statusColumns = [
  { id: "backlog", label: "Backlog" },
  { id: "in-progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const RoadmapView = () => {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["roadmap-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roadmap_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statusColumns.map((column) => (
        <Card key={column.id}>
          <CardHeader>
            <CardTitle>{column.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items
                .filter((item) => item.status === column.id)
                .map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border bg-card text-card-foreground"
                  >
                    <h3 className="font-medium mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default RoadmapView;