'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Home,
  Key,
  Settings,
  FileText,
  BarChart2,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
  type LucideIcon,
} from 'lucide-react';

interface NavItemProps {
  icon: LucideIcon;
  href: string;
  label: string;
  isActive?: boolean;
  isCollapsed?: boolean;
}

const NavItem = ({ icon: Icon, href, label, isActive, isCollapsed }: NavItemProps) => {
  const buttonContent = (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn('w-full justify-start', isCollapsed && 'justify-center px-2')}
      asChild
    >
      <Link href={href}>
        <Icon className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
        {!isCollapsed && <span className="text-sm">{label}</span>}
      </Link>
    </Button>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
};

// Helper function to safely get initial state from localStorage only on client
const getInitialCollapsedState = () => {
  if (typeof window === 'undefined') {
    return false; // Default for SSR
  }
  try {
    const savedState = localStorage.getItem('sidebarCollapsed');
    return savedState ? JSON.parse(savedState) : false;
  } catch (e) {
    console.error("Failed to parse sidebarCollapsed state from localStorage for initial state", e);
    return false; // Fallback on error
  }
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  // Initialize state directly using the helper function
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsedState());
  const [isMounted, setIsMounted] = useState(false); // For theme/icon hydration

  // Effect to set mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const toggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsedState));
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (response.ok) {
        toast({
          title: 'Logged Out',
          description: 'You have been successfully logged out.',
          variant: 'default',
        });
        router.replace('/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive',
      });
      console.error('Logout error:', error);
    }
  };

  const sidebarWidth = isCollapsed ? 'w-[60px]' : 'w-[250px]';
  const currentTheme = theme === 'system' ? 'light' : theme; // Assume light for system for icon logic

  return (
    <div
      className={cn(
        'relative flex h-full flex-col border-r bg-background transition-[width] duration-200 ease-in-out',
        sidebarWidth
      )}
    >
      {/* Collapse Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute z-10 w-8 h-8 rounded-full -right-4 top-2"
        onClick={toggleCollapse}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {/* Only render icon after mount to prevent hydration mismatch */}
        {isMounted && (isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />)}
      </Button>

      <div className="flex flex-col justify-between overflow-y-auto grow">
        {/* Top Section: Logo & Nav */}
        <div className="px-3 py-4">
          <div className={cn('mb-6 flex items-center px-2', isCollapsed ? 'justify-center' : 'justify-start')}>
            <h2 className="text-xl font-bold tracking-tight">
              {isCollapsed ? 'L' : 'Load Balancer'}
            </h2>
          </div>

          <nav className="flex flex-col space-y-1">
            <NavItem
              icon={Home}
              href="/dashboard"
              label="Dashboard"
              isActive={pathname === '/dashboard'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              icon={Users}
              href="/profiles"
              label="Profiles"
              isActive={pathname === '/profiles' || pathname.startsWith('/profiles/')}
              isCollapsed={isCollapsed}
            />
            <NavItem
              icon={Key}
              href="/keys"
              label="API Keys"
              isActive={pathname === '/keys' || pathname.startsWith('/keys/')}
              isCollapsed={isCollapsed}
            />
            <NavItem
              icon={FileText}
              href="/logs"
              label="Logs"
              isActive={pathname === '/logs'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              icon={BarChart2}
              href="/stats"
              label="Stats"
              isActive={pathname === '/stats'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              icon={Settings}
              href="/settings"
              label="Settings"
              isActive={pathname === '/settings'}
              isCollapsed={isCollapsed}
            />
          </nav>
        </div>

        {/* Bottom Section: Theme & Logout */}
        <div className="px-3 py-4">
          <Separator className="my-4" />
          <div className="flex flex-col space-y-1">
            <Button
              variant="ghost"
              className={cn('w-full justify-start', isCollapsed && 'justify-center px-2')}
              onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
            >
              {isMounted && currentTheme === 'dark' ? (
                <>
                  <Sun className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
                  {!isCollapsed && <span className="text-sm">Light Mode</span>}
                </>
              ) : (
                <>
                  <Moon className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
                  {!isCollapsed && <span className="text-sm">Dark Mode</span>}
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className={cn('w-full justify-start', isCollapsed && 'justify-center px-2')}
              onClick={handleLogout}
            >
              <LogOut className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
              {!isCollapsed && <span className="text-sm">Logout</span>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}