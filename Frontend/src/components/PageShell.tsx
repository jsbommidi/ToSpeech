import { Container, type ContainerProps } from '@mui/material';

interface PageShellProps extends ContainerProps {
  children: React.ReactNode;
}

export default function PageShell({ children, maxWidth = 'xl', sx, ...props }: PageShellProps) {
  return (
    <Container maxWidth={maxWidth} sx={{ py: 4, ...sx }} {...props}>
      {children}
    </Container>
  );
}
