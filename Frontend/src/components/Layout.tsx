import React from 'react';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
            <Sidebar />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    px: { xs: 2, md: 4 },
                    py: { xs: 3, md: 4 },
                    width: '100%',
                    maxWidth: 1440,
                    margin: '0 auto',
                    overflowX: 'hidden',
                    pt: { xs: 8, md: 3 }, // Add padding top on mobile for the menu button
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
