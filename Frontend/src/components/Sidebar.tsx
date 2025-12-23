import { useState } from 'react';
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    Typography,
    useTheme,
    useMediaQuery,
    Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    Mic,
    Menu as MenuIcon,
    ChevronLeft,
    Settings as SettingsIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;
const collapsedDrawerWidth = 65;

export default function Sidebar() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [open, setOpen] = useState(!isMobile);
    const location = useLocation();
    const { user } = useAuth();

    const handleDrawerToggle = () => {
        setOpen(!open);
    };

    const menuItems = [
        { text: 'Generate', icon: <Mic />, path: '/' },
        { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ];

    const drawerContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box
                sx={{
                    px: 2,
                    pt: 2,
                    pb: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: open ? 'flex-start' : 'center',
                    minHeight: 'auto', // Allow it to shrink
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    gap: 0.5,
                }}
            >
                {open && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            <Box
                                sx={{
                                    width: 28, // Smaller logo
                                    height: 28,
                                    flexShrink: 0,
                                    borderRadius: 1,
                                    background: theme.palette.primary.main,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Mic sx={{ color: 'primary.contrastText', fontSize: 16 }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle2" // Smaller text
                                    sx={{
                                        fontWeight: 700,
                                        letterSpacing: '-0.01em',
                                        lineHeight: 1.2
                                    }}
                                >
                                    ToSpeech
                                </Typography>
                                {user?.email && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            display: 'block',
                                            fontSize: '0.7rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            lineHeight: 1.1
                                        }}
                                        title={user.email}
                                    >
                                        {user.email}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                        {!isMobile && (
                            <IconButton onClick={handleDrawerToggle} size="small" sx={{ color: 'text.secondary', p: 0.5 }}>
                                <ChevronLeft fontSize="small" />
                            </IconButton>
                        )}
                    </Box>
                )}
                {!open && (
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 1,
                            background: theme.palette.primary.main,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            mb: 1
                        }}
                        onClick={handleDrawerToggle}
                    >
                        <Mic sx={{ color: 'primary.contrastText', fontSize: 18 }} />
                    </Box>
                )}
            </Box>

            <List sx={{ flexGrow: 1, px: 1, py: 1.5, gap: 0.5, display: 'flex', flexDirection: 'column' }}>
                {menuItems.map((item) => {
                    const active = location.pathname === item.path;
                    return (
                        <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                            <Tooltip title={!open ? item.text : ''} placement="right">
                                <ListItemButton
                                    component={Link}
                                    to={item.path}
                                    selected={active}
                                    sx={{
                                        minHeight: 40, // Compact height
                                        justifyContent: open ? 'flex-start' : 'center',
                                        px: open ? 1.5 : 1,
                                        py: 0.5,
                                        borderRadius: 1.5,
                                        backgroundColor: active ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                                        color: active ? theme.palette.text.primary : 'text.primary',
                                        '&:hover': {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.12),
                                            color: active ? theme.palette.text.primary : 'text.primary',
                                        },
                                        gap: open ? 1.5 : 0,
                                    }}
                                >
                                    <ListItemIcon
                                        sx={{
                                            minWidth: 0,
                                            mr: open ? 0 : 0,
                                            justifyContent: 'center',
                                            color: active ? theme.palette.primary.dark : 'text.secondary',
                                            transition: 'color 120ms ease',
                                        }}
                                    >
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        sx={{
                                            opacity: open ? 1 : 0,
                                            transition: 'opacity 140ms ease',
                                            m: 0,
                                            '& .MuiListItemText-primary': { fontWeight: active ? 600 : 500, fontSize: '0.9rem' },
                                        }}
                                    />
                                    {open && active && (
                                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main' }} />
                                    )}
                                </ListItemButton>
                            </Tooltip>
                        </ListItem>
                    );
                })}
            </List>

            <Box sx={{ px: 1, py: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: open ? 'space-between' : 'center', alignItems: 'center' }}>
                        {/* Compact Footer */}
                        <ThemeToggle compact={!open} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );

    return (
        <Box component="nav" sx={{
            width: { md: open ? drawerWidth : collapsedDrawerWidth }, flexShrink: { md: 0 }, transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
            }),
        }}>
            {/* Mobile Drawer */}
            <Drawer
                variant="temporary"
                open={open && isMobile}
                onClose={handleDrawerToggle}
                ModalProps={{
                    keepMounted: true, // Better open performance on mobile.
                }}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                }}
            >
                {drawerContent}
            </Drawer>

            {/* Desktop Drawer */}
            <Drawer
                variant="permanent"
                sx={{
                    display: { xs: 'none', md: 'block' },
                    '& .MuiDrawer-paper': {
                        boxSizing: 'border-box',
                        width: open ? drawerWidth : collapsedDrawerWidth,
                        transition: theme.transitions.create('width', {
                            easing: theme.transitions.easing.sharp,
                            duration: theme.transitions.duration.enteringScreen,
                        }),
                        overflowX: 'hidden',
                        borderRight: `1px solid ${theme.palette.divider}`,
                    },
                }}
                open={open}
            >
                {drawerContent}
            </Drawer>
            {/* Mobile Toggle Button (when drawer is closed) */}
            {isMobile && !open && (
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={handleDrawerToggle}
                    sx={{ position: 'fixed', top: 16, left: 16, zIndex: 1100, bgcolor: 'background.paper', boxShadow: 1 }}
                >
                    <MenuIcon />
                </IconButton>
            )}
        </Box>
    );
}
