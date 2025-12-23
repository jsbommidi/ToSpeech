import { useState, useEffect } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Stack,
    FormControl,
    FormLabel,
    Select,
    MenuItem,
    Grid,
    TextField,
    Button,
    Alert,
    Snackbar,
    CircularProgress,
    Switch,
    InputAdornment,
    IconButton,
    LinearProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    Tooltip,
    alpha,
    useTheme
} from '@mui/material';
import {
    Storage,
    Settings as SettingsIcon,
    Key,
    GraphicEq,
    Save,
    RestartAlt,
    Logout,
    CloudDownload,
    Delete as DeleteIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { useSettings } from '../contexts/SettingsContext';
import { settingsAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
    const { settings, updateSettings, resetSettings, clearLocalState, loading } = useSettings();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const theme = useTheme();
    const [message, setMessage] = useState('');
    const [errorObj, setErrorObj] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadStatusText, setDownloadStatusText] = useState('');

    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    useEffect(() => {
        fetchModels();
    }, []);

    const fetchModels = async () => {
        setIsLoadingModels(true);
        try {
            const res = await settingsAPI.getAvailableModels();
            setAvailableModels(res.data.models);
        } catch (e) {
            console.error("Failed to fetch models", e);
        } finally {
            setIsLoadingModels(false);
        }
    };

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedModels(new Set(availableModels));
        } else {
            setSelectedModels(new Set());
        }
    };

    const handleSelectOne = (model: string) => {
        const newSelected = new Set(selectedModels);
        if (newSelected.has(model)) {
            newSelected.delete(model);
        } else {
            newSelected.add(model);
        }
        setSelectedModels(newSelected);
    };

    const handleDeleteModels = async () => {
        if (selectedModels.size === 0) return;

        if (!window.confirm(`Are you sure you want to delete ${selectedModels.size} model(s)? This cannot be undone.`)) {
            return;
        }

        try {
            const modelsToDelete = Array.from(selectedModels);
            // Delete sequentially to avoid race conditions or overwhelming server
            for (const model of modelsToDelete) {
                await settingsAPI.deleteModel(model);
            }

            setMessage(`Successfully deleted ${selectedModels.size} model(s)`);
            setSelectedModels(new Set());
            fetchModels(); // Refresh list
        } catch (e: any) {
            setErrorObj(e.message || 'Failed to delete some models');
            fetchModels(); // Refresh list anyway
        }
    };

    const handleDownloadModel = async () => {
        if (!downloadUrl) return;

        let repoId = downloadUrl;
        if (repoId.includes("huggingface.co/")) {
            repoId = repoId.split("huggingface.co/")[1].replace(/\/$/, "");
        }

        setIsDownloading(true);
        setDownloadProgress(0);
        setDownloadStatusText('Initializing...');

        try {
            await settingsAPI.downloadModel(downloadUrl, settings.hf_token);
            setMessage('Download started! Please wait...');

            // Start polling
            const interval = setInterval(async () => {
                try {
                    const res = await settingsAPI.getDownloadStatus(repoId);
                    const { status, progress, filename, detail } = res.data;

                    if (status === 'downloading' || status === 'starting') {
                        setDownloadProgress(progress);
                        setDownloadStatusText(`${filename || 'Downloading...'} (${Math.round(progress)}%)`);
                    } else if (status === 'completed') {
                        clearInterval(interval);
                        setIsDownloading(false);
                        setDownloadProgress(100);
                        setDownloadStatusText('Download complete!');
                        setMessage('Model downloaded successfully!');

                        setDownloadUrl('');
                        fetchModels(); // Refresh models list after successful download
                    } else if (status === 'error' || status === 'not_found' && progress === 0) { // 'not_found' might happen if we poll too fast before it starts, but usually it should be found.
                        // If 'not_found' keeps happening, maybe we should stop? For now treat not_found as pending provided we just started.
                        if (status === 'error') {
                            clearInterval(interval);
                            setIsDownloading(false);
                            setErrorObj('Download failed: ' + (detail || 'Unknown error'));
                        }
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 1000);

        } catch (e: any) {
            setIsDownloading(false);
            setErrorObj(e.message || 'Failed to start download');
        }
    };

    const handleLogout = () => {
        logout();
        clearLocalState();
        navigate('/login');
    };

    const handleReset = async () => {
        try {
            await resetSettings();
            setMessage('Settings reset to defaults');
        } catch (e: any) {
            setErrorObj(e.message || 'Failed to reset settings');
        }
    };

    const handleSave = async (key: string, value: any) => {
        try {
            await updateSettings({ [key]: value });
        } catch (e: any) {
            setErrorObj(e.message || 'Failed to save settings');
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
            <Stack spacing={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h5" fontWeight="800" letterSpacing="-0.02em" sx={{ mb: 0.5 }}>
                            Settings
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Manage your workspace preferences
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <Button
                            startIcon={<RestartAlt />}
                            color="inherit"
                            onClick={handleReset}
                            size="small"
                        >
                            Reset
                        </Button>
                        <Button
                            startIcon={<Logout />}
                            color="error"
                            onClick={handleLogout}
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: 'error.main', color: 'error.main', '&:hover': { bgcolor: 'error.lighter', borderColor: 'error.dark' } }}
                        >
                            Logout
                        </Button>
                    </Stack>
                </Box>

                <Grid container spacing={2}>
                    {/* Audio Configuration Card */}
                    <Grid item xs={12} md={8}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 3,
                                height: '100%',
                                border: 'none',
                                background: 'transparent'
                            }}
                        >
                            <Stack spacing={3}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <GraphicEq color="primary" fontSize="small" />
                                    <Typography variant="subtitle1" fontWeight="700">Audio Configuration</Typography>
                                </Box>

                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6} lg={4}>
                                        <FormControl fullWidth size="small">
                                            <FormLabel sx={{ mb: 0.5, fontSize: '0.85rem' }}>Sample Rate</FormLabel>
                                            <Select
                                                value={settings.sample_rate || 44100}
                                                onChange={(e) => handleSave('sample_rate', Number(e.target.value))}
                                                sx={{ borderRadius: 1.5 }}
                                            >
                                                <MenuItem value={44100}>44.1 kHz</MenuItem>
                                                <MenuItem value={48000}>48 kHz</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={6} lg={4}>
                                        <FormControl fullWidth size="small">
                                            <FormLabel sx={{ mb: 0.5, fontSize: '0.85rem' }}>Quality</FormLabel>
                                            <Select
                                                value={settings.quality || 'high'}
                                                onChange={(e) => handleSave('quality', e.target.value)}
                                                sx={{ borderRadius: 1.5 }}
                                            >
                                                <MenuItem value="low">Low (64kbps)</MenuItem>
                                                <MenuItem value="standard">Standard (128kbps)</MenuItem>
                                                <MenuItem value="high">High (256kbps)</MenuItem>
                                                <MenuItem value="ultra">Ultra (320kbps)</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} sm={6} lg={4}>
                                        <FormControl fullWidth size="small">
                                            <FormLabel sx={{ mb: 0.5, fontSize: '0.85rem' }}>Format</FormLabel>
                                            <Select
                                                value={settings.format || 'lossless'}
                                                onChange={(e) => handleSave('format', e.target.value)}
                                                sx={{ borderRadius: 1.5 }}
                                            >
                                                <MenuItem value="lossy">Lossy (MP3)</MenuItem>
                                                <MenuItem value="lossless">Lossless (FLAC)</MenuItem>
                                                <MenuItem value="uncompressed">WAV</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </Stack>
                        </Paper>
                    </Grid>

                    {/* System Settings */}
                    <Grid item xs={12} md={4}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 3,
                                height: '100%',
                                border: 'none',
                                background: 'transparent',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <Stack spacing={3}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Storage color="primary" fontSize="small" />
                                    <Typography variant="subtitle1" fontWeight="700">System</Typography>
                                </Box>

                                <Stack spacing={2}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        p: 1.5,
                                        borderRadius: 2,
                                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                        border: '1px solid',
                                        borderColor: 'divider'
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Save fontSize="small" sx={{ color: 'text.secondary' }} />
                                            <Box>
                                                <Typography variant="body2" fontWeight="600">Auto-save</Typography>
                                                <Typography variant="caption" color="text.secondary">Save generations</Typography>
                                            </Box>
                                        </Box>
                                        <Switch
                                            size="small"
                                            checked={settings.auto_save ?? true}
                                            onChange={(e) => handleSave('auto_save', e.target.checked)}
                                        />
                                    </Box>
                                </Stack>
                            </Stack>
                        </Paper>
                    </Grid>

                    {/* Model Settings Grid */}
                    <Grid item xs={12}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 3,
                                border: 'none',
                                background: 'transparent'
                            }}
                        >
                            <Stack spacing={3}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SettingsIcon color="primary" fontSize="small" />
                                    <Typography variant="subtitle1" fontWeight="700">Model Settings</Typography>
                                </Box>

                                <FormControl fullWidth size="small">
                                    <FormLabel sx={{ mb: 0.5, fontSize: '0.85rem' }}>Download New Model</FormLabel>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            value={downloadUrl}
                                            onChange={(e) => setDownloadUrl(e.target.value)}
                                            placeholder="https://huggingface.co/..."
                                            size="small"
                                            fullWidth
                                            helperText="Enter full Hugging Face Model URL to download"
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <CloudDownload fontSize="small" sx={{ opacity: 0.7 }} />
                                                    </InputAdornment>
                                                ),
                                                sx: { borderRadius: 1.5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }
                                            }}
                                        />
                                        <Button
                                            variant="contained"
                                            onClick={handleDownloadModel}
                                            disabled={!downloadUrl || isDownloading}
                                            sx={{
                                                borderRadius: 1.5,
                                                borderTopLeftRadius: 0,
                                                borderBottomLeftRadius: 0,
                                                minWidth: '100px',
                                                height: '40px' // Match TextField height approx
                                            }}
                                        >
                                            {isDownloading ? <CircularProgress size={20} color="inherit" /> : 'Download'}
                                        </Button>
                                    </Box>

                                    {isDownloading && (
                                        <Box sx={{ mt: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    {downloadStatusText}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {Math.round(downloadProgress)}%
                                                </Typography>
                                            </Box>
                                            <LinearProgress variant="determinate" value={downloadProgress} sx={{ borderRadius: 1, height: 6 }} />
                                        </Box>
                                    )}
                                </FormControl>

                                <FormControl fullWidth size="small">
                                    <FormLabel sx={{ mb: 0.5, fontSize: '0.85rem' }}>HuggingFace Token</FormLabel>
                                    <TextField
                                        value={settings.hf_token || ''}
                                        onChange={(e) => handleSave('hf_token', e.target.value)}
                                        placeholder="hf_..."
                                        type={showToken ? 'text' : 'password'}
                                        size="small"
                                        fullWidth
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <Key fontSize="small" sx={{ opacity: 0.7 }} />
                                                </InputAdornment>
                                            ),
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        aria-label="toggle token visibility"
                                                        onClick={() => setShowToken(!showToken)}
                                                        edge="end"
                                                        size="small"
                                                    >
                                                        {showToken ? <Box component="span" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>HIDE</Box> : <Box component="span" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>SHOW</Box>}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                            sx: { borderRadius: 1.5 }
                                        }}
                                    />
                                </FormControl>

                                {/* Available Models List */}
                                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                        <Typography variant="subtitle2" fontWeight="700">Available Models</Typography>
                                        <Stack direction="row" spacing={1}>
                                            {selectedModels.size > 0 && (
                                                <Tooltip title="Delete Selected">
                                                    <IconButton
                                                        onClick={handleDeleteModels}
                                                        size="small"
                                                        color="error"
                                                        sx={{
                                                            bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
                                                            '&:hover': { bgcolor: (theme) => alpha(theme.palette.error.main, 0.2) }
                                                        }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Refresh List">
                                                <IconButton onClick={fetchModels} size="small">
                                                    <RefreshIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </Box>

                                    <TableContainer sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        maxHeight: 300,
                                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)'
                                    }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell padding="checkbox" sx={{ bgcolor: 'background.paper' }}>
                                                        <Checkbox
                                                            size="small"
                                                            indeterminate={selectedModels.size > 0 && selectedModels.size < availableModels.length}
                                                            checked={availableModels.length > 0 && selectedModels.size === availableModels.length}
                                                            onChange={handleSelectAll}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Model Name</TableCell>
                                                    <TableCell align="right" sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>Type</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {availableModels.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                            {isLoadingModels ? 'Loading models...' : 'No models found locally'}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    availableModels.map((model) => {
                                                        const isSelected = selectedModels.has(model);
                                                        return (
                                                            <TableRow
                                                                key={model}
                                                                hover
                                                                selected={isSelected}
                                                                role="checkbox"
                                                                onClick={() => handleSelectOne(model)}
                                                                sx={{ cursor: 'pointer' }}
                                                            >
                                                                <TableCell padding="checkbox">
                                                                    <Checkbox
                                                                        size="small"
                                                                        checked={isSelected}
                                                                        onChange={() => handleSelectOne(model)}
                                                                    />
                                                                </TableCell>
                                                                <TableCell component="th" scope="row">
                                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{model}</Typography>

                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Box component="span" sx={{
                                                                        px: 1,
                                                                        py: 0.25,
                                                                        borderRadius: 1,
                                                                        bgcolor: model.includes('VibeVoice') ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.action.active, 0.1),
                                                                        color: model.includes('VibeVoice') ? 'primary.main' : 'text.secondary',
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 600
                                                                    }}>
                                                                        {model.includes('VibeVoice') ? 'VibeVoice' : 'Standard'}
                                                                    </Box>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            </Stack>
                        </Paper>
                    </Grid>

                    {/* User Instructions */}
                    <Grid item xs={12}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 3,
                                border: 'none',
                                backgroundColor: 'transparent'
                            }}
                        >
                            <Stack spacing={3}>
                                <Typography variant="subtitle1" fontWeight="700">User Instructions</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    The current system is optimized for use with Microsoft/VibeVoice. You may need to update the backend configuration to support different models.
                                </Typography>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>

            </Stack>

            <Snackbar
                open={!!message}
                autoHideDuration={3000}
                onClose={() => setMessage('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>{message}</Alert>
            </Snackbar>

            <Snackbar
                open={!!errorObj}
                autoHideDuration={3000}
                onClose={() => setErrorObj('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>{errorObj}</Alert>
            </Snackbar>
        </Container >
    );
}
