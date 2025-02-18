import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
const Landing = () => {
  const {
    session
  } = useAuth();
  const {
    theme,
    setTheme
  } = useTheme();
  return <div className="min-h-screen flex flex-col dark:bg-background">
      <header className="border-b dark:border-border">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-primary">TaskMaster</h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {session ? <Button asChild>
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button> : <Button asChild>
                <Link to="/auth">Sign In</Link>
              </Button>}
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="font-bold dark:text-white text-3xl">
            Manage Your Tasks with Efficiency
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            TaskMaster helps you organize your work, collaborate with your team,
            and get more done.
          </p>
          {!session && <div className="space-x-4">
              <Button asChild size="lg">
                <Link to="/auth">Get Started</Link>
              </Button>
            </div>}
        </div>
      </main>
    </div>;
};
export default Landing;