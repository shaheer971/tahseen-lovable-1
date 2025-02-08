import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FolderKanban, LogOut, LayoutDashboard, Calendar, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/dashboard/projects", icon: FolderKanban },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "Feedback", href: "/dashboard/feedback", icon: MessageSquare },
];

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to log out. Please try again.");
    }
  };

  return (
    <motion.div
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-16 flex-col transition-all duration-300 ease-in-out",
        isExpanded && "w-52"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      initial={{ x: -100 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <div className="flex h-full flex-col bg-white dark:bg-gray-900 shadow-lg">
        <div className="flex h-14 shrink-0 items-center gap-2 px-4 border-b border-gray-100 dark:border-gray-800">
          <motion.img
            src="/logo.png"
            alt="Logo"
            className="h-8 w-8"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          />
          <motion.span
            className={cn(
              "font-jakarta font-semibold text-lg text-gray-900 dark:text-white overflow-hidden transition-all duration-300",
              !isExpanded && "opacity-0 w-0",
              isExpanded && "opacity-100 w-auto"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: isExpanded ? 1 : 0 }}
          >
            Tahseen
          </motion.span>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ease-in-out",
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400"
                )}
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="mr-3"
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 flex-shrink-0 transition-colors duration-150",
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 group-hover:text-blue-600 dark:text-gray-400 dark:group-hover:text-blue-400"
                    )}
                  />
                </motion.div>
                <motion.span
                  className={cn(
                    "font-satoshi transition-all duration-300",
                    !isExpanded && "opacity-0 w-0",
                    isExpanded && "opacity-100 w-auto"
                  )}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isExpanded ? 1 : 0 }}
                >
                  {item.name}
                </motion.span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 dark:border-gray-800 p-2">
          <button
            onClick={handleLogout}
            className={cn(
              "group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150 ease-in-out"
            )}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="mr-3"
            >
              <LogOut className="h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-red-600 dark:text-gray-400 dark:group-hover:text-red-400" />
            </motion.div>
            <motion.span
              className={cn(
                "font-satoshi transition-all duration-300",
                !isExpanded && "opacity-0 w-0",
                isExpanded && "opacity-100 w-auto"
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: isExpanded ? 1 : 0 }}
            >
              Logout
            </motion.span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default Sidebar;
