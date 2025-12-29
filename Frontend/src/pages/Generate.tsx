import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import {
    Box, Paper, TextField, Button, Select, MenuItem, Typography,
    FormControl, InputLabel, LinearProgress, Alert, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TablePagination,
    Checkbox, IconButton, Collapse, Toolbar, Tooltip, Chip, Stack,
    InputAdornment, alpha, useTheme, Menu
} from '@mui/material';
import {
    Search as SearchIcon,
    Sort as SortIcon,
    Delete as DeleteIcon,
    CloudDownload as DownloadIcon,
    PlayArrow as PlayIcon,
    KeyboardArrowUp as KeyboardArrowUpIcon,
    RestartAlt as ResetIcon,
    Stop as StopIcon,
    Close as CloseIcon,
    CheckCircle as CheckCircleIcon,
    CalendarToday as CalendarIcon,
    AccessTime as TimeIcon
} from '@mui/icons-material';
import AudioPlayer from '../components/AudioPlayer';
import { ttsAPI, settingsAPI, type AudioHistoryItem } from '../lib/api';
import { format } from 'date-fns';

// --- Types ---
type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

// --- Utility Functions ---
const formatVoiceName = (voice: string): string => {
    const parts = voice.split('-');
    if (parts.length >= 2) {
        const lang = parts[0];
        const nameGender = parts[1].split('_');
        const name = nameGender[0];
        const gender = nameGender[1] === 'man' ? 'Male' : nameGender[1] === 'woman' ? 'Female' : '';

        const langMap: Record<string, string> = {
            'en': 'English',
            'de': 'German',
            'fr': 'French',
            'it': 'Italian',
            'jp': 'Japanese',
            'kr': 'Korean',
            'nl': 'Dutch',
            'pl': 'Polish',
            'pt': 'Portuguese',
            'sp': 'Spanish',
            'in': 'Indian English'
        };

        const langName = langMap[lang] || lang.toUpperCase();
        return `${name} (${gender}, ${langName})`;
    }
    return voice;
};

export default function Generate() {
    // --- Generate State ---
    const [text, setText] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [selectedSpeaker, setSelectedSpeaker] = useState('');
    const [availableSpeakers, setAvailableSpeakers] = useState<string[]>([]);

    const [cfgScale, setCfgScale] = useState(1.5);
    const [inferenceSteps, setInferenceSteps] = useState(5);
    const [generating, setGenerating] = useState(false);
    const [streamingLog, setStreamingLog] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

    // --- History/Archive State ---
    const [history, setHistory] = useState<AudioHistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');
    const [filterModel, setFilterModel] = useState<string>('all');

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Selection & Expansion
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Download Menu
    const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<null | HTMLElement>(null);

    const theme = useTheme();

    // --- Refs ---
    const abortControllerRef = useRef<AbortController | null>(null);
    const taskPollingIntervalRef = useRef<number | null>(null);

    // --- Actions ---
    const handleStop = async () => {
        // 1. Cancel active generation (streaming)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // 2. Cancel Celery task if exists
        if (currentTaskId) {
            try {
                await ttsAPI.cancelTask(currentTaskId);
                setStreamingLog(prev => prev + '\n' + 'Task cancelled by user.');
            } catch (err) {
                console.error('Failed to cancel task:', err);
            }
            setCurrentTaskId(null);
        }

        // 3. Clear polling interval
        if (taskPollingIntervalRef.current) {
            clearInterval(taskPollingIntervalRef.current);
            taskPollingIntervalRef.current = null;
        }

        setGenerating(false);

        // 4. Stop playback (by collapsing the active history item)
        setExpandedId(null);
    };

    // --- Effects ---
    useEffect(() => {
        fetchModels();
        fetchHistory();

        // Cleanup polling interval on unmount
        return () => {
            if (taskPollingIntervalRef.current) {
                clearInterval(taskPollingIntervalRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (selectedModel) {
            fetchSpeakers(selectedModel);
        } else {
            setAvailableSpeakers([]);
            setSelectedSpeaker('');
        }
    }, [selectedModel]);

    // --- Fetchers ---
    const fetchModels = async () => {
        try {
            const res = await settingsAPI.getAvailableModels();
            setAvailableModels(res.data.models);
            if (res.data.models.length > 0) {
                setSelectedModel(res.data.models[0]);
            }
        } catch (err) {
            console.error("Failed to fetch models", err);
            setError("Failed to fetch available models.");
        }
    };

    const fetchSpeakers = async (modelName: string) => {
        try {
            const res = await settingsAPI.getModelSpeakers(modelName);
            setAvailableSpeakers(res.data.speakers);

            if (res.data.speakers.length > 0) {
                // If currently selected speaker is not in the new list, select the first one
                // Or if no speaker selected, select first
                // Note: We access state 'selectedSpeaker' directly here which relies on closure.
                // Better to rely on the fact that if we change model, we likely trigger this.
                // But we don't have access to the *latest* selectedSpeaker if it changed rapidly?
                // Actually 'selectedSpeaker' is in scope.

                // We should only force reset if the current selection is invalid for the new set
                // But simplified logic: just set to first if not currently set or if we want to ensure valid start
                // The current code (lines 167-169) forces selection of speakers[0].
                // Let's keep that behavior for now as it ensures a valid selection on model change.
                setSelectedSpeaker(res.data.speakers[0]);
                setError(null);
            } else {
                setSelectedSpeaker('');
                // If even fallback failed (no voices in system at all)
                setError('No voices available for this model.');
            }
        } catch (err) {
            console.error("Failed to fetch speakers", err);
            setError("Failed to fetch available voices for this model.");
        }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await ttsAPI.getHistory();
            setHistory(res.data);
        } catch (err) {
            console.error("Failed to fetch history", err);
            setError("Failed to fetch generation history.");
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleGenerate = async () => {
        if (!text) return;
        setGenerating(true);
        setStreamingLog('');
        setError(null);
        setCurrentTaskId(null);

        try {
            // Start Celery task
            setStreamingLog('Starting generation task...');
            const response = await ttsAPI.generateCelery({
                text,
                model_name: selectedModel,
                speaker: selectedSpeaker,
                cfg_scale: (cfgScale || cfgScale === 0) ? cfgScale : 1.5,
                inference_steps: (inferenceSteps || inferenceSteps === 0) ? inferenceSteps : 5
            });

            const taskId = response.data.task_id;
            setCurrentTaskId(taskId);
            setStreamingLog(prev => prev + '\n' + `Task ID: ${taskId}`);

            // Poll for task status
            taskPollingIntervalRef.current = setInterval(async () => {
                try {
                    const statusResponse = await ttsAPI.getTaskStatus(taskId);
                    const { state, status, result } = statusResponse.data;

                    if (state === 'PROGRESS') {
                        setStreamingLog(prev => {
                            const lines = prev.split('\n');
                            // Replace last status line or add new one
                            if (lines[lines.length - 1].startsWith('Status:')) {
                                lines[lines.length - 1] = `Status: ${status}`;
                                return lines.join('\n');
                            }
                            return prev + '\n' + `Status: ${status}`;
                        });
                    } else if (state === 'SUCCESS') {
                        // Task completed
                        if (taskPollingIntervalRef.current) {
                            clearInterval(taskPollingIntervalRef.current);
                            taskPollingIntervalRef.current = null;
                        }

                        // Check if it was actually cancelled or failed
                        if (result && result.status === 'cancelled') {
                            setStreamingLog(prev => prev + '\n' + 'Task was cancelled.');
                            setGenerating(false);
                            setCurrentTaskId(null);
                        } else if (result && result.status === 'error') {
                            setError(`Generation failed: ${result.message}`);
                            setGenerating(false);
                            setCurrentTaskId(null);
                        } else {
                            setStreamingLog(prev => prev + '\n' + 'Generation completed!');
                            setGenerating(false);
                            setCurrentTaskId(null);

                            // Refresh history
                            await fetchHistory();
                            setPage(0);
                            setSortBy('date-desc');
                        }
                    } else if (state === 'FAILURE') {
                        // Task failed
                        if (taskPollingIntervalRef.current) {
                            clearInterval(taskPollingIntervalRef.current);
                            taskPollingIntervalRef.current = null;
                        }
                        setError(`Generation failed: ${status}`);
                        setGenerating(false);
                        setCurrentTaskId(null);
                    } else if (state === 'REVOKED') {
                        // Task was cancelled
                        if (taskPollingIntervalRef.current) {
                            clearInterval(taskPollingIntervalRef.current);
                            taskPollingIntervalRef.current = null;
                        }
                        setStreamingLog(prev => prev + '\n' + 'Task was cancelled.');
                        setGenerating(false);
                        setCurrentTaskId(null);
                    }
                } catch (err) {
                    console.error('Failed to poll task status:', err);
                }
            }, 1000); // Poll every second

        } catch (err: any) {
            console.error("Generate failed", err);
            setError("Failed to start generation task. Check backend connection.");
            setGenerating(false);
            setCurrentTaskId(null);
        }
    };

    const handleResetSettings = () => {
        setText('');
        setCfgScale(1.5);
        setInferenceSteps(5);
        if (availableModels.length > 0) {
            const defaultModel = availableModels[0];
            setSelectedModel(defaultModel);
            // If the model didn't change, we need to manually reset the speaker to the first one available
            // If it did change, the useEffect will handle fetching and selecting the first speaker
            if (defaultModel === selectedModel && availableSpeakers.length > 0) {
                setSelectedSpeaker(availableSpeakers[0]);
            }
        }
    };



    // --- History Logic ---

    const filteredAndSortedHistory = useMemo(() => {
        let data = [...history];

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.text_input.toLowerCase().includes(lowerQuery) ||
                item.model_name.toLowerCase().includes(lowerQuery) ||
                (item.speaker && item.speaker.toLowerCase().includes(lowerQuery))
            );
        }

        if (filterModel !== 'all') {
            data = data.filter(item => item.model_name === filterModel);
        }

        data.sort((a, b) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            const textA = a.text_input.toLowerCase();
            const textB = b.text_input.toLowerCase();

            switch (sortBy) {
                case 'date-desc': return dateB - dateA;
                case 'date-asc': return dateA - dateB;
                case 'name-asc': return textA.localeCompare(textB);
                case 'name-desc': return textB.localeCompare(textA);
                default: return 0;
            }
        });

        return data;
    }, [history, searchQuery, filterModel, sortBy]);

    const paginatedHistory = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredAndSortedHistory.slice(start, start + rowsPerPage);
    }, [filteredAndSortedHistory, page, rowsPerPage]);

    const handleSelectPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            const newSelected = new Set(selectedIds);
            paginatedHistory.forEach(item => newSelected.add(item.id));
            setSelectedIds(newSelected);
        } else {
            const newSelected = new Set(selectedIds);
            paginatedHistory.forEach(item => newSelected.delete(item.id));
            setSelectedIds(newSelected);
        }
    }

    const handleSelectOne = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkDownload = (format: 'wav' | 'mp3', bitrate?: string) => {
        const itemsToDownload = history.filter(item => selectedIds.has(item.id));
        itemsToDownload.forEach((item, index) => {
            setTimeout(async () => {
                try {
                    let downloadUrl: string;
                    let filename: string;

                    if (format === 'wav') {
                        // Direct WAV download
                        downloadUrl = item.file_path;
                        filename = `audio-${item.id}.wav`;
                    } else {
                        // MP3 conversion via backend
                        downloadUrl = `http://localhost:1311/api/v1/audio/convert/${item.id}?format=mp3&bitrate=${bitrate}`;
                        filename = `audio-${item.id}-${bitrate}kbps.mp3`;
                    }

                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch (error) {
                    console.error('Download failed:', error);
                    alert(`Failed to download audio ${item.id}`);
                }
            }, index * 500);
        });
        handleDownloadMenuClose();
    };

    const handleDownloadMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setDownloadMenuAnchor(event.currentTarget);
    };

    const handleDownloadMenuClose = () => {
        setDownloadMenuAnchor(null);
    };

    const handleBulkDelete = () => {
        alert("Delete functionality is not yet supported by the backend.");
    };

    const uniqueModels = useMemo(() => Array.from(new Set(history.map(h => h.model_name))), [history]);
    const isPageSelected = paginatedHistory.length > 0 && paginatedHistory.every(item => selectedIds.has(item.id));
    const isPageIndeterminate = paginatedHistory.some(item => selectedIds.has(item.id)) && !isPageSelected;

    return (
        <Box sx={{ p: 4, maxWidth: '100%', overflowX: 'hidden' }}>
            {/* --- Generation Section --- */}
            <Paper
                elevation={0}
                sx={{
                    p: 0,
                    mb: 3,
                    background: 'transparent'
                }}
            >
                {/* Row 1: Header + Model + Voice */}
                {/* Row 1: Header + Model + Voice */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                        Generate Speech
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', minWidth: 280, alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 140, maxWidth: 200 }}>
                            <InputLabel>Model</InputLabel>
                            <Select
                                value={selectedModel}
                                label="Model"
                                onChange={(e) => setSelectedModel(e.target.value)}
                            >
                                {availableModels.map((m) => (
                                    <MenuItem
                                        key={m}
                                        value={m}
                                    >
                                        {m}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 140, maxWidth: 200 }}>
                            <InputLabel>Voice</InputLabel>
                            <Select
                                value={selectedSpeaker}
                                label="Voice"
                                onChange={(e) => setSelectedSpeaker(e.target.value)}
                                disabled={!selectedModel || availableSpeakers.length === 0}
                            >
                                {availableSpeakers.length === 0 ? (
                                    <MenuItem value="" disabled>
                                        No voices available
                                    </MenuItem>
                                ) : (
                                    availableSpeakers.map((s) => (
                                        <MenuItem key={s} value={s}>
                                            {formatVoiceName(s)}
                                        </MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>

                        <TextField
                            label="CFG"
                            type="number"
                            value={isNaN(cfgScale) ? '' : cfgScale}
                            onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                            inputProps={{ step: 0.1, min: 1.0, max: 10.0 }}
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 80 }}
                        />

                        <TextField
                            label="Steps"
                            type="number"
                            value={isNaN(inferenceSteps) ? '' : inferenceSteps}
                            onChange={(e) => setInferenceSteps(parseInt(e.target.value))}
                            inputProps={{ step: 1, min: 1, max: 100 }}
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 80 }}
                        />

                        <Tooltip title="Reset all settings">
                            <IconButton
                                onClick={handleResetSettings}
                                sx={{
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                                }}
                            >
                                <ResetIcon />
                            </IconButton>
                        </Tooltip>

                        <Button
                            variant="contained"
                            onClick={handleGenerate}
                            disabled={generating || !text.trim() || !selectedModel || !selectedSpeaker}
                            sx={{
                                fontWeight: 700,
                                textTransform: 'none',
                                boxShadow: 'none',
                                height: 40,
                                minWidth: 100,
                                '&:hover': {
                                    boxShadow: theme.shadows[4]
                                }
                            }}
                        >
                            {generating ? '...' : 'Generate'}
                        </Button>

                        <Button
                            variant="outlined"
                            color="error"
                            onClick={handleStop}
                            disabled={!generating && !expandedId}
                            sx={{
                                fontWeight: 700,
                                textTransform: 'none',
                                height: 40,
                                minWidth: 40,
                                borderColor: alpha(theme.palette.error.main, 0.5),
                                color: theme.palette.error.main,
                                '&:hover': {
                                    borderColor: theme.palette.error.main,
                                    bgcolor: alpha(theme.palette.error.main, 0.05)
                                }
                            }}
                        >
                            <StopIcon />
                        </Button>
                    </Box>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                <Box sx={{ mb: 3 }}>
                    <TextField
                        label="Text to Generate"
                        fullWidth
                        multiline
                        minRows={4}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Enter text to generate speech..."
                        InputLabelProps={{ shrink: true }}
                        sx={{
                            '& .MuiInputBase-root': {
                                bgcolor: alpha(theme.palette.background.paper, 0.5)
                            },
                            '& textarea': {
                                resize: 'vertical',
                            }
                        }}
                    />
                </Box>

                {/* Progress Bar */}
                {
                    generating && (
                        <Box sx={{ mt: 3, mb: 3, height: 8, display: 'flex', alignItems: 'center' }}>
                            <LinearProgress
                                sx={{ width: '100%', height: 8, borderRadius: 4 }}
                            />
                        </Box>
                    )
                }

                {/* Bottom Section: Actual Text Display */}
                <TextField
                    label="Streaming Text Updates"
                    fullWidth
                    multiline
                    minRows={3}
                    value={generating ? streamingLog : (history.length > 0 ? history[0].text_input : "No generation history yet.")}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                        readOnly: true,
                    }}
                    sx={{
                        '& .MuiInputBase-root': {
                            bgcolor: alpha(theme.palette.background.paper, 0.5)
                        },
                        '& textarea': {
                            resize: 'vertical', // Allow vertical resizing
                        }
                    }}
                />

                {/* Result Actions: Audio Player & Save Button */}
                {
                    !generating && history.length > 0 && (
                        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ flexGrow: 1 }}>
                                <AudioPlayer audioUrl={history[0].file_path} autoPlay={false} />
                            </Box>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<DownloadIcon />}
                                href={history[0].file_path}
                                download={`audio-${history[0].id}.wav`}
                                sx={{
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    whiteSpace: 'nowrap',
                                    borderRadius: 2,
                                    px: 4,
                                    height: 40,
                                    boxShadow: theme.shadows[4]
                                }}
                            >
                                Save
                            </Button>
                        </Box>
                    )
                }
            </Paper >

            {/* --- History / Archive Section --- */}
            < Paper
                elevation={0}
                sx={{
                    width: '100%',
                    background: 'transparent'
                }
                }
            >
                {/* Toolbar */}
                < Toolbar
                    sx={{
                        pl: { sm: 2 },
                        pr: { xs: 1, sm: 1 },
                        ...(selectedIds.size > 0 && {
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                        }),
                        gap: 2,
                        py: 2
                    }}
                >
                    {
                        selectedIds.size > 0 ? (
                            <>
                                <Typography sx={{ flex: '1 1 100%' }} color="inherit" variant="subtitle1" component="div">
                                    {selectedIds.size} selected
                                </Typography>
                                <Tooltip title="Download Selected">
                                    <IconButton onClick={handleDownloadMenuOpen}>
                                        <DownloadIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Selected">
                                    <IconButton onClick={handleBulkDelete}>
                                        <DeleteIcon />
                                    </IconButton>
                                </Tooltip>
                            </>
                        ) : (
                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, mr: 2 }}>
                                    History
                                </Typography>

                                <TextField
                                    size="small"
                                    placeholder="Search history..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>
                                    }}
                                    sx={{ flexGrow: 1, minWidth: 200 }}
                                />

                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <InputLabel>Model</InputLabel>
                                    <Select
                                        value={filterModel}
                                        label="Model"
                                        onChange={(e) => setFilterModel(e.target.value)}
                                    >
                                        <MenuItem value="all">All Models</MenuItem>
                                        {uniqueModels.map(m => (
                                            <MenuItem key={m} value={m}>{m}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <InputLabel>Sort By</InputLabel>
                                    <Select
                                        value={sortBy}
                                        label="Sort By"
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                        startAdornment={<InputAdornment position="start"><SortIcon fontSize="small" /></InputAdornment>}
                                    >
                                        <MenuItem value="date-desc">Newest First</MenuItem>
                                        <MenuItem value="date-asc">Oldest First</MenuItem>
                                        <MenuItem value="name-asc">Text (A-Z)</MenuItem>
                                        <MenuItem value="name-desc">Text (Z-A)</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                        )
                    }
                </Toolbar >

                {/* Table */}
                < TableContainer >
                    <Table sx={{ '& td, & th': { borderBottom: 'none' } }}>
                        <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={isPageIndeterminate}
                                        checked={isPageSelected}
                                        onChange={handleSelectPage}
                                    />
                                </TableCell>
                                <TableCell>ID</TableCell>
                                <TableCell sx={{ width: '40%' }}>Text Input</TableCell>
                                <TableCell>Model & Voice</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell align="center">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedHistory.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                        <Typography color="text.secondary">
                                            {loadingHistory ? "Loading history..." : "No generation history found."}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedHistory.map((row) => {
                                const isItemSelected = selectedIds.has(row.id);
                                const isExpanded = expandedId === row.id;

                                return (
                                    <Fragment key={row.id}>
                                        <TableRow
                                            hover
                                            selected={isItemSelected}
                                            sx={{ '& td, & th': { borderBottom: 'none' } }}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={isItemSelected}
                                                    onChange={() => handleSelectOne(row.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    {row.id}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={row.text_input}>
                                                    <Typography noWrap sx={{ maxWidth: 300, fontWeight: 500, cursor: 'default' }}>
                                                        {row.text_input}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                <Stack spacing={0.5}>
                                                    <Chip label={row.model_name} size="small" sx={{ width: 'fit-content' }} />
                                                    {row.speaker && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatVoiceName(row.speaker)} • {row.duration ? `${row.duration}s` : ''}
                                                        </Typography>
                                                    )}
                                                    {!row.speaker && row.duration && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {row.duration}s
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {format(new Date(row.timestamp), 'MMM d, yyyy')}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {format(new Date(row.timestamp), 'h:mm a')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                                                    color={isExpanded ? 'primary' : 'default'}
                                                >
                                                    {isExpanded ? <KeyboardArrowUpIcon /> : <PlayIcon />}
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow key={`${row.id}-details`}>
                                            <TableCell style={{ paddingBottom: 0, paddingTop: 0, borderBottom: 'none' }} colSpan={6}>
                                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                    <Box sx={{
                                                        p: 3,
                                                        bgcolor: alpha(theme.palette.primary.main, 0.04), // Subtle tint matching theme
                                                        borderRadius: 2,
                                                        my: 2,
                                                        mx: 1,
                                                        border: '1px solid',
                                                        borderColor: 'divider'
                                                    }}>

                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                                    recording_{row.id}.wav
                                                                </Typography>
                                                                <Chip
                                                                    label="completed"
                                                                    size="small"
                                                                    color="success"
                                                                    icon={<CheckCircleIcon />}
                                                                    sx={{ fontWeight: 700 }}
                                                                />
                                                            </Box>
                                                            <IconButton onClick={() => setExpandedId(null)} size="small" sx={{ color: 'text.secondary' }}>
                                                                <CloseIcon />
                                                            </IconButton>
                                                        </Box>

                                                        {/* Metadata Row */}
                                                        <Box sx={{ display: 'flex', gap: 3, mb: 3, color: 'text.secondary', fontSize: '0.875rem' }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <CalendarIcon sx={{ fontSize: '1rem' }} />
                                                                {format(new Date(row.timestamp), 'MMM d, yyyy')}
                                                            </Box>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <TimeIcon sx={{ fontSize: '1rem' }} />
                                                                {format(new Date(row.timestamp), 'h:mm a')}
                                                            </Box>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography component="span" sx={{ fontSize: 'inherit', fontWeight: 500 }}>Words:</Typography>
                                                                {row.text_input.split(/\s+/).filter(w => w.length > 0).length}
                                                            </Box>
                                                        </Box>

                                                        {/* Audio Player */}
                                                        <Box sx={{ mb: 4 }}>
                                                            <AudioPlayer audioUrl={row.file_path} autoPlay={false} />
                                                        </Box>

                                                        {/* Transcript Content */}
                                                        <Box>
                                                            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1, fontWeight: 600 }}>
                                                                Transcript Content
                                                            </Typography>
                                                            <Paper
                                                                elevation={0}
                                                                sx={{
                                                                    p: 3,
                                                                    bgcolor: theme.palette.mode === 'dark' ? alpha('#000000', 0.4) : alpha(theme.palette.common.black, 0.03),
                                                                    border: '1px solid',
                                                                    borderColor: 'divider',
                                                                    borderRadius: 2,
                                                                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                                                    color: 'text.secondary',
                                                                    fontSize: '0.9rem',
                                                                    lineHeight: 1.6
                                                                }}
                                                            >
                                                                {row.text_input}
                                                            </Paper>
                                                        </Box>

                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </Fragment>
                                );
                            })}
                        </TableBody >
                    </Table >
                </TableContainer >

                <TablePagination
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    component="div"
                    count={filteredAndSortedHistory.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                />
            </Paper >

            {/* Download Format Menu */}
            <Menu
                anchorEl={downloadMenuAnchor}
                open={Boolean(downloadMenuAnchor)}
                onClose={handleDownloadMenuClose}
            >
                <MenuItem onClick={() => handleBulkDownload('wav')}>
                    <Box>
                        <Typography variant="body2" fontWeight={600}>WAV (Original)</Typography>
                        <Typography variant="caption" color="text.secondary">24 kHz, 16-bit PCM</Typography>
                    </Box>
                </MenuItem>
                <MenuItem onClick={() => handleBulkDownload('mp3', '128')}>
                    <Box>
                        <Typography variant="body2" fontWeight={600}>MP3 - 128 kbps</Typography>
                        <Typography variant="caption" color="text.secondary">Standard quality</Typography>
                    </Box>
                </MenuItem>
                <MenuItem onClick={() => handleBulkDownload('mp3', '192')}>
                    <Box>
                        <Typography variant="body2" fontWeight={600}>MP3 - 192 kbps</Typography>
                        <Typography variant="caption" color="text.secondary">High quality</Typography>
                    </Box>
                </MenuItem>
                <MenuItem onClick={() => handleBulkDownload('mp3', '256')}>
                    <Box>
                        <Typography variant="body2" fontWeight={600}>MP3 - 256 kbps</Typography>
                        <Typography variant="caption" color="text.secondary">Very high quality</Typography>
                    </Box>
                </MenuItem>
                <MenuItem onClick={() => handleBulkDownload('mp3', '320')}>
                    <Box>
                        <Typography variant="body2" fontWeight={600}>MP3 - 320 kbps</Typography>
                        <Typography variant="caption" color="text.secondary">Maximum quality</Typography>
                    </Box>
                </MenuItem>
            </Menu>
        </Box >
    );
}
