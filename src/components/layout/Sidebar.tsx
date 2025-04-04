'use client';

import { usePathname, useRouter } from 'next/navigation'; // Import useRouter
import Link from 'next/link';
import { 
  Box, 
  VStack, 
  Heading, 
  Text, 
  Flex, 
  Icon, 
  useColorModeValue,
  Button,
  Divider,
  Tooltip,
  IconButton,
  useToast // Import useToast
} from '@chakra-ui/react';
import { 
  FiHome, 
  FiKey, 
  FiSettings, 
  FiFileText, 
  FiBarChart2, 
  FiCode,
  FiMoon,
  FiSun,
  FiChevronLeft,
  FiChevronRight,
  FiLogOut // Import FiLogOut
} from 'react-icons/fi';
import { useContext, useState, useEffect } from 'react'; // Add useEffect
import { ThemeContext } from '@/contexts/ThemeContext';

interface NavItemProps {
  icon: any;
  href: string;
  children: React.ReactNode;
  isActive?: boolean;
  isCollapsed?: boolean;
}

interface SidebarProps {
  onResize?: (width: string) => void;
}

const NavItem = ({ icon, href, children, isActive, isCollapsed }: NavItemProps) => {
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const activeColor = useColorModeValue('blue.600', 'blue.200');

  return (
    <Link href={href} passHref style={{ textDecoration: 'none', width: '100%' }}>
      <Tooltip label={isCollapsed ? children : ''} placement="right" isDisabled={!isCollapsed}>
        <Flex
          align="center"
          p="3"
          mx={isCollapsed ? "0" : "2"}
          justifyContent={isCollapsed ? "center" : "flex-start"}
          borderRadius="md"
          role="group"
          cursor="pointer"
          bg={isActive ? activeBg : 'transparent'}
          color={isActive ? activeColor : undefined}
          _hover={{
            bg: isActive ? activeBg : hoverBg,
          }}
        >
          <Icon
            mr={isCollapsed ? "0" : "3"}
            fontSize={isCollapsed ? "20" : "16"}
            as={icon}
          />
          {!isCollapsed && (
            <Text fontSize="sm" fontWeight={isActive ? "bold" : "medium"}>
              {children}
            </Text>
          )}
        </Flex>
      </Tooltip>
    </Link>
  );
};

export default function Sidebar({ onResize }: SidebarProps) {
  const pathname = usePathname();
  // Removed duplicate pathname declaration
  const router = useRouter(); // Add router
  const toast = useToast(); // Add toast
  const { colorMode, toggleColorMode } = useContext(ThemeContext);
  // Initialize state from localStorage or default to false
  // Initialize consistently on server and client initial render
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Remove isClient state - no longer needed with this pattern
  // const [isClient, setIsClient] = useState(false);
  
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Effect to update sidebar width on initial load based on persisted state
  useEffect(() => {
    if (onResize) {
      onResize(isCollapsed ? "60px" : "250px");
    }
    // We only want this effect to run based on the initial state, not on every toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures it runs only once on mount

  // After mount, read localStorage and update state if needed
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    const initialValue = savedState ? JSON.parse(savedState) : false;
    if (initialValue !== isCollapsed) { // Only update if different from initial
       setIsCollapsed(initialValue);
       // Also update layout if needed based on loaded state
       if (onResize) {
         onResize(initialValue ? "60px" : "250px");
       }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once after mount

  const toggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (onResize) {
      onResize(newCollapsedState ? "60px" : "250px");
    }
    // Save the new state to localStorage
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
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        // Use replace to prevent going back to the logged-in state
        router.replace('/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      console.error('Logout error:', error);
    }
  };

  return (
    <Box
      h="100%"
      w={isCollapsed ? "60px" : "250px"} // Use state directly now
      bg={bg}
      borderRight="1px"
      borderColor={borderColor}
      py={4}
      transition="width 0.2s ease"
      position="relative"
    >
      {/* Render button unconditionally */}
      <IconButton
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} // Use state directly
        icon={isCollapsed ? <FiChevronRight /> : <FiChevronLeft />} // Use state directly
        size="sm"
        variant="ghost"
        position="absolute"
        right="-12px"
        top="10px"
        borderRadius="50%"
        bg={bg}
        borderWidth="1px"
        borderColor={borderColor}
        zIndex="1"
        onClick={toggleCollapse}
      />

      <Flex direction="column" h="full" justify="space-between">
        <Box>
          <Flex px={4} mb={6} align="center" justify={isCollapsed ? "center" : "flex-start"}>
            {!isCollapsed ? (
              <Heading size="md" fontWeight="bold">Load Balancer</Heading>
            ) : (
              <Heading size="md" fontWeight="bold">G</Heading>
            )}
          </Flex>

          <VStack align="stretch" spacing={1}>
            <NavItem 
              icon={FiHome} 
              href="/dashboard" 
              isActive={pathname === '/dashboard'}
              isCollapsed={isCollapsed}
            >
              Dashboard
            </NavItem>
            
            <NavItem 
              icon={FiKey} 
              href="/keys" 
              isActive={pathname === '/keys'}
              isCollapsed={isCollapsed}
            >
              API Keys
            </NavItem>
            
            <NavItem 
              icon={FiFileText} 
              href="/logs" 
              isActive={pathname === '/logs'}
              isCollapsed={isCollapsed}
            >
              Logs
            </NavItem>
            
            <NavItem 
              icon={FiBarChart2} 
              href="/stats" 
              isActive={pathname === '/stats'}
              isCollapsed={isCollapsed}
            >
              Statistics
            </NavItem>
            

            <NavItem 
              icon={FiSettings} 
              href="/settings" 
              isActive={pathname === '/settings'}
              isCollapsed={isCollapsed}
            >
              Settings
            </NavItem>
          </VStack>
        </Box>

        {/* Group bottom controls in a VStack for consistent spacing */}
        <VStack spacing={2} align="stretch" px={4} mb={4}>
          <Divider />
          {/* Theme Toggle Button */}
          <Tooltip label={isCollapsed ? (colorMode === 'light' ? "Dark Mode" : "Light Mode") : ""} placement="right" isDisabled={!isCollapsed}>
            <Button
              leftIcon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
              onClick={toggleColorMode}
              variant="ghost"
              size="sm"
              width="full"
              justifyContent={isCollapsed ? "center" : "flex-start"}
            >
              {!isCollapsed && (colorMode === 'light' ? 'Dark Mode' : 'Light Mode')}
            </Button>
          </Tooltip>

          {/* Logout Button */}
          <Tooltip label={isCollapsed ? "Logout" : ""} placement="right" isDisabled={!isCollapsed}>
            <Button
              leftIcon={<FiLogOut />}
              onClick={handleLogout}
              variant="ghost"
              colorScheme="red" // Use red color for logout
              size="sm"
              width="full"
              justifyContent={isCollapsed ? "center" : "flex-start"}
            >
              {!isCollapsed && 'Logout'}
            </Button>
          </Tooltip>
        </VStack>
      </Flex>
    </Box>
  );
}