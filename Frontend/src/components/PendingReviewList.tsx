import React from 'react';
import {
    List, ListItem, ListItemText, ListItemSecondaryAction,
    IconButton, Typography, Paper, Chip
} from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

interface PendingItem {
    id: number;
    type: 'entity' | 'fact';
    content: string; // Name for entity, FactText for fact
    subtext?: string; // Type for entity, Date/Source for fact
}

interface PendingReviewListProps {
    items: PendingItem[];
    onVerify: (id: number, type: 'entity' | 'fact') => void;
    onReject: (id: number, type: 'entity' | 'fact') => void;
}

const PendingReviewList: React.FC<PendingReviewListProps> = ({ items, onVerify, onReject }) => {
    const theme = useTheme();
    
    if (items.length === 0) {
        return null;
    }

    return (
        <Paper 
            elevation={1} 
            sx={{ 
                p: 2, 
                mb: 2, 
                border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                backgroundColor: alpha(theme.palette.warning.main, 0.08),
            }}
        >
            <Typography 
                variant="subtitle2" 
                gutterBottom 
                sx={{ 
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                }}
            >
                ⚠️ Review Pending Items ({items.length})
            </Typography>
            <List dense disablePadding>
                {items.map((item) => (
                    <ListItem 
                        key={`${item.type}-${item.id}`}
                        sx={{
                            py: 1,
                        }}
                    >
                        <Chip
                            label={item.type === 'entity' ? 'Entity' : 'Fact'}
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ 
                                mr: 1, 
                                height: 20, 
                                fontSize: '0.7rem',
                                fontWeight: 600,
                            }}
                        />
                        <ListItemText
                            primary={item.content}
                            secondary={item.subtext}
                            primaryTypographyProps={{ 
                                variant: 'body2',
                                color: theme.palette.text.primary,
                            }}
                            secondaryTypographyProps={{
                                color: theme.palette.text.secondary,
                            }}
                        />
                        <ListItemSecondaryAction>
                            <IconButton edge="end" size="small" onClick={() => onVerify(item.id, item.type)} color="success">
                                <CheckCircle fontSize="small" />
                            </IconButton>
                            <IconButton edge="end" size="small" onClick={() => onReject(item.id, item.type)} color="error">
                                <Cancel fontSize="small" />
                            </IconButton>
                        </ListItemSecondaryAction>
                    </ListItem>
                ))}
            </List>
        </Paper>
    );
};

export default PendingReviewList;
