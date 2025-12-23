import { Box, ButtonBase, Tooltip, useTheme, IconButton } from '@mui/material';
import { useThemeMode } from '../contexts/ThemeContext';

type ThemeToggleProps = {
  compact?: boolean;
};

export default function ThemeToggle({ compact }: ThemeToggleProps) {
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();
  const isDark = mode === 'dark';

  if (compact) {
    return (
      <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
        <IconButton
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={isDark}
          size="small"
          sx={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: '#fff',
            transition: 'transform 180ms ease, opacity 180ms ease',
            '&:hover': {
              transform: 'scale(1.06)',
              opacity: 0.9,
              backgroundColor: 'rgba(255,255,255,0.14)',
            },
            '&:active': {
              transform: 'scale(0.98)',
            },
          }}
        >
          <Box component="span" role="img" aria-hidden>
            {isDark ? '🌙' : '☀️'}
          </Box>
        </IconButton>
      </Tooltip>
    );
  }

  const trackBg = '#4a4f58';
  const thumbColor = isDark ? '#f5f7fa' : '#ffffff';
  const iconActive = '#ffffff';
  const iconInactive = 'rgba(255,255,255,0.6)';

  const dims = { w: 92, h: 44, pad: 6, thumb: 32, thumbX: 44, fontSize: 18 };

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <ButtonBase
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={isDark}
        sx={{
          position: 'relative',
          width: dims.w,
          height: dims.h,
          borderRadius: 999,
          backgroundColor: trackBg,
          padding: `${dims.pad}px 10px`,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 10px 24px rgba(0,0,0,0.35)'
              : '0 10px 24px rgba(15,23,42,0.14)',
          transition: 'transform 200ms ease-in-out, opacity 200ms ease-in-out, background-color 200ms ease-in-out',
          '&:hover': {
            transform: 'scale(1.02)',
            opacity: 0.95,
          },
          '&:active': {
            transform: 'scale(0.99)',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: dims.pad,
            left: dims.pad,
            width: dims.thumb,
            height: dims.thumb,
            borderRadius: '50%',
            backgroundColor: thumbColor,
            transform: isDark ? `translateX(${dims.thumbX}px)` : 'translateX(0px)',
            transition: 'transform 200ms ease-in-out, background-color 200ms ease-in-out',
            boxShadow:
              theme.palette.mode === 'dark'
                ? '0 8px 18px rgba(0,0,0,0.35)'
                : '0 8px 18px rgba(15,23,42,0.16)',
          }}
        />
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 1,
            fontSize: dims.fontSize,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            userSelect: 'none',
            color: iconInactive,
            px: 0.5,
          }}
        >
          <Box sx={{ color: isDark ? iconInactive : iconActive, transition: 'color 160ms ease' }}>☀️</Box>
          <Box sx={{ color: isDark ? iconActive : iconInactive, transition: 'color 160ms ease' }}>🌙</Box>
        </Box>
      </ButtonBase>
    </Tooltip>
  );
}
