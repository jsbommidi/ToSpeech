import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Typography,
    Box,
    Link,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    useTheme,
    alpha
} from '@mui/material';

interface MarkdownRendererProps {
    children: string;
    components?: Record<string, React.ComponentType<any>>;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ children, components: customComponents }) => {
    const theme = useTheme();

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                ...customComponents,
                p: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <Typography variant="body1" sx={{ lineHeight: 1.6, mb: 1.5 }} {...rest} />;
                },
                h1: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <Typography variant="h4" sx={{ fontWeight: 600, mt: 3, mb: 2 }} {...rest} />;
                },
                h2: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <Typography variant="h5" sx={{ fontWeight: 600, mt: 2.5, mb: 1.5 }} {...rest} />;
                },
                h3: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <Typography variant="h6" sx={{ fontWeight: 600, mt: 2, mb: 1 }} {...rest} />;
                },
                h4: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1.5, mb: 1 }} {...rest} />;
                },
                h5: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1.5, mb: 1 }} {...rest} />;
                },
                h6: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1.5, mb: 1 }} {...rest} />;
                },
                li: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return (
                        <Box component="li" sx={{ mb: 0.5, typography: 'body1', lineHeight: 1.6 }}>
                            <Typography component="span" variant="body1">
                                {rest.children}
                            </Typography>
                        </Box>
                    );
                },
                ul: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <Box component="ul" sx={{ pl: 3, mb: 1.5, mt: 0 }} {...rest} />;
                },
                ol: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <Box component="ol" sx={{ pl: 3, mb: 1.5, mt: 0 }} {...rest} />;
                },
                a: (props) => {
                    const { node, ref, href, ...rest } = props as any;
                    return <Link href={href} target="_blank" rel="noopener noreferrer" color="primary" {...rest} />;
                },
                blockquote: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return (
                        <Box
                            sx={{
                                borderLeft: `4px solid ${theme.palette.primary.main}`,
                                pl: 2,
                                py: 0.5,
                                my: 2,
                                bgcolor: alpha(theme.palette.primary.main, 0.05),
                                borderRadius: 1
                            }}
                            {...rest}
                        />
                    );
                },
                code: (props: any) => {
                    const { node, ref, inline, className, children, ...rest } = props;
                    return !inline ? (
                        <Box
                            component="pre"
                            sx={{
                                bgcolor: theme.palette.mode === 'dark' ? alpha('#000', 0.5) : '#f5f5f5',
                                p: 2,
                                borderRadius: 2,
                                overflowX: 'auto',
                                my: 2,
                                '& code': {
                                    backgroundColor: 'transparent',
                                    p: 0,
                                    borderRadius: 0,
                                    color: 'inherit',
                                    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                                }
                            }}
                        >
                            <code className={className} {...rest}>
                                {children}
                            </code>
                        </Box>
                    ) : (
                        <Box
                            component="code"
                            sx={{
                                bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.light, 0.15) : alpha(theme.palette.primary.main, 0.1),
                                color: theme.palette.text.primary,
                                px: 0.6,
                                py: 0.2,
                                borderRadius: 1,
                                fontSize: '0.9em',
                                fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                                fontWeight: 500
                            }}
                            className={className}
                            {...rest}
                        >
                            {children}
                        </Box>
                    );
                },
                table: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return (
                        <TableContainer component={Paper} variant="outlined" sx={{ my: 2 }}>
                            <Table size="small" {...rest}>
                                {rest.children}
                            </Table>
                        </TableContainer>
                    );
                },
                thead: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <TableHead sx={{ bgcolor: theme.palette.action.hover }} {...rest} />;
                },
                tbody: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <TableBody {...rest} />;
                },
                tr: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <TableRow {...rest} />;
                },
                th: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return (
                        <TableCell align="left" sx={{ fontWeight: 600 }} {...rest}>
                            {rest.children}
                        </TableCell>
                    );
                },
                td: (props) => {
                    const { node, ref, ...rest } = props as any;
                    return <TableCell align="left" {...rest} />;
                },
            }}
        >
            {children}
        </ReactMarkdown>
    );
};

export default MarkdownRenderer;
