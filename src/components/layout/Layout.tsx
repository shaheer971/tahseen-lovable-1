
import { Outlet } from "react-router-dom";
import Topbar from "./Topbar";
import MobileNav from "./MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";

const Layout = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar />
      <main className="flex-1 overflow-auto mt-14 mb-[60px] md:mb-0">
        <div className="container mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
      {isMobile && <MobileNav />}
    </div>
  );
};

export default Layout;
