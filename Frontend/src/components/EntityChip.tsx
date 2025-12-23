import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { Person, Business, Description, HelpOutline, Lightbulb } from '@mui/icons-material';

interface EntityChipProps {
    id: number;
    label: string;
    type: string; // person, project, concept, document, etc.
    status?: 'verified' | 'pending' | 'rejected' | 'locked';
    onClick?: () => void;
}

const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
        case 'person': return <Person />;
        case 'project': return <Business />;
        case 'document': return <Description />;
        case 'concept': return <Lightbulb />;
        default: return <HelpOutline />;
    }
};

const getColor = (status?: string) => {
    switch (status) {
        case 'verified': return 'primary';
        case 'locked': return 'success';
        case 'pending': return 'warning';
        case 'rejected': return 'error';
        default: return 'default';
    }
};

const EntityChip: React.FC<EntityChipProps> = ({ id, label, type, status, onClick }) => {
    return (
        <Tooltip title={`${type}: ${label} (${status || 'unknown'})`}>
            <Chip
                data-entity-id={id}
                icon={getIcon(type)}
                label={label}
                size="small"
                color={getColor(status) as any}
                variant={status === 'pending' ? 'outlined' : 'filled'}
                onClick={onClick}
                sx={{ margin: '0 2px', cursor: 'pointer' }}
            />
        </Tooltip>
    );
};

export default EntityChip;
