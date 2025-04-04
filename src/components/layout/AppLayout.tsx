"use client";

import { ReactNode, useState } from "react";
import { Grid, GridItem } from "@chakra-ui/react";
import Sidebar from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState("250px");

  // Callback function to be called from Sidebar when it's collapsed/expanded
  const handleSidebarResize = (width: string) => {
    setSidebarWidth(width);
  };

  return (
    <Grid
      templateColumns={`${sidebarWidth} 1fr`}
      h="100vh"
      transition="grid-template-columns 0.2s ease"
    >
      <GridItem>
        <Sidebar onResize={handleSidebarResize} />
      </GridItem>
      <GridItem p={6} overflowY="auto">
        {children}
      </GridItem>
    </Grid>
  );
}
