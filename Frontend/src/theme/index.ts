import { createTheme, alpha } from '@mui/material/styles';

const baseTypography = {
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  h1: { fontWeight: 650 },
  h2: { fontWeight: 650 },
  h3: { fontWeight: 650 },
  h4: { fontWeight: 650 },
  h5: { fontWeight: 650 },
  h6: { fontWeight: 650 },
  subtitle1: { fontWeight: 600 },
  body1: { fontWeight: 500 },
  button: { fontWeight: 600, textTransform: 'none' as const },
};

const baseComponents = (mode: 'light' | 'dark') => ({
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        backgroundImage:
          mode === 'dark'
            ? 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.05), transparent 25%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.04), transparent 22%)'
            : 'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.06), transparent 25%), radial-gradient(circle at 80% 0%, rgba(0,0,0,0.04), transparent 22%)',
      },
      '#root': {
        minHeight: '100vh',
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        paddingInline: 16,
        paddingBlock: 10,
        boxShadow: 'none',
        transition: 'all 160ms ease',
        '&:hover': {
          boxShadow: mode === 'dark'
            ? '0 10px 30px rgba(0,0,0,0.25)'
            : '0 10px 30px rgba(0,0,0,0.12)',
        },
        '&:active': { transform: 'translateY(1px)' },
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow:
          mode === 'dark'
            ? '0 20px 60px rgba(0,0,0,0.35)'
            : '0 20px 60px rgba(15,23,42,0.12)',
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 18,
        border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        backgroundImage: 'none',
        borderRight: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        transition: 'all 140ms ease',
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 12,
      },
      input: {
        paddingBlock: 12,
        '&.MuiInputBase-inputSizeSmall': {
          paddingBlock: 8,
        },
      },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        borderRadius: 10,
        fontSize: 12,
      },
    },
  },
  MuiAvatar: {
    styleOverrides: {
      root: {
        fontSize: 14,
        fontWeight: 700,
      },
    },
  },
});

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#059669', // Vibrant Emerald Green
      light: '#34d399',
      dark: '#047857',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0ea5e9', // Sky Blue for vibrant accents
      light: '#38bdf8',
      dark: '#0284c7',
      contrastText: '#ffffff',
    },
    success: { main: '#10b981' },
    warning: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    info: { main: '#3b82f6' },
    background: {
      default: '#f8fafc', // Bright, clean Slate-50
      paper: '#ffffff',
    },
    divider: 'rgba(0,0,0,0.08)',
    text: {
      primary: '#0f172a', // Slate-900 for sharp contrast
      secondary: '#475569', // Slate-600
    },
  },
  typography: baseTypography,
  shape: {
    borderRadius: 14,
  },
  components: baseComponents('light'),
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#abd699', // Keep original Sage Green in dark mode as it pops well
      light: '#ccebc4',
      dark: '#8ba37e',
      contrastText: '#0f172a',
    },
    secondary: {
      main: '#c7ddcc',
      light: '#e8f5ea',
      dark: '#98ad9d',
      contrastText: '#0f172a',
    },
    success: { main: '#7bd99f' },
    warning: { main: '#f6c76f' },
    error: { main: '#BF0000' },
    info: { main: '#7ab7ff' },
    background: {
      default: '#0f172a', // Rich Slate / Gunmetal
      paper: '#1e293b', // Lighter Slate for cards
    },
    divider: 'rgba(255,255,255,0.1)',
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    },
    action: {
      hover: alpha('#ffffff', 0.05),
      selected: alpha('#ffffff', 0.1),
      focus: alpha('#ffffff', 0.1),
      disabled: alpha('#ffffff', 0.3),
      disabledBackground: alpha('#ffffff', 0.1),
    },
  },
  typography: baseTypography,
  shape: {
    borderRadius: 14,
  },
  components: {
    ...baseComponents('dark'),
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          transition: 'all 140ms ease',
          '&.Mui-selected': {
            backgroundColor: alpha('#abd699', 0.14),
            color: '#eef7eb',
            '&:hover': {
              backgroundColor: alpha('#abd699', 0.22),
            },
          },
        },
      },
    },
  },
});
