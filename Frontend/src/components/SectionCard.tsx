import { Paper, type PaperProps } from '@mui/material';

interface SectionCardProps extends PaperProps {
  children: React.ReactNode;
}

export default function SectionCard({ children, sx, ...props }: SectionCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        border: '2px solid',
        borderColor: 'divider',
        borderRadius: 2,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Paper>
  );
}
