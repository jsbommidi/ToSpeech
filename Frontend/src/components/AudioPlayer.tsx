import { useState, useEffect, useRef } from 'react';
import {
    Box,
    IconButton,
    Typography,
    Paper,
    useTheme,
    CircularProgress,
    alpha,
    Menu,
    MenuItem,
    Button,
} from '@mui/material';
import {
    PlayArrow,
    Pause,
} from '@mui/icons-material';
import { api } from '../lib/api';

interface AudioPlayerProps {
    transcriptId?: number;
    audioUrl?: string; // Direct URL to audio file
    autoPlay?: boolean;
}

export default function AudioPlayer({ transcriptId, audioUrl, autoPlay = false }: AudioPlayerProps) {
    const theme = useTheme();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Fetch audio as blob and generate waveform
    useEffect(() => {
        let active = true;
        setIsLoading(true);
        setError(null);
        setWaveformPeaks([]);
        setAudioSrc(null);

        const fetchAndAnalyze = async () => {
            try {
                let blob: Blob;

                if (audioUrl) {
                    const response = await api.get(audioUrl, {
                        responseType: 'blob'
                    });
                    blob = response.data;
                } else if (transcriptId) {
                    const response = await api.get(`/transcripts/${transcriptId}/audio`, {
                        responseType: 'blob'
                    });
                    blob = response.data;
                } else {
                    if (active) {
                        setError("No audio source");
                        setIsLoading(false);
                    }
                    return;
                }

                if (!active) return;

                const url = URL.createObjectURL(blob);
                setAudioSrc(url);

                const arrayBuffer = await blob.arrayBuffer();
                const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
                const audioContext = new AudioContextClass();

                try {
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                    if (active) {
                        setDuration(audioBuffer.duration);
                    }

                    const channelData = audioBuffer.getChannelData(0);
                    const samples = 150;
                    const blockSize = Math.floor(channelData.length / samples);
                    const peaks = [];

                    for (let i = 0; i < samples; i++) {
                        const start = i * blockSize;
                        let sum = 0;
                        for (let j = 0; j < blockSize; j++) {
                            sum += Math.abs(channelData[start + j]);
                        }
                        peaks.push(sum / blockSize);
                    }

                    const max = Math.max(...peaks) || 1;
                    const normalizedPeaks = peaks.map(p => p / max);

                    if (active) {
                        setWaveformPeaks(normalizedPeaks);
                    }
                } catch (decodeErr) {
                    console.error("Error decoding audio data:", decodeErr);
                } finally {
                    if (audioContext.state !== 'closed') {
                        await audioContext.close();
                    }
                }

                if (active) {
                    setIsLoading(false);
                }

            } catch (err) {
                console.error("Error loading audio:", err);
                if (active) {
                    setError("Failed to load audio");
                    setIsLoading(false);
                }
            }
        };

        fetchAndAnalyze();

        return () => {
            active = false;
        };
    }, [transcriptId, audioUrl]);

    useEffect(() => {
        return () => {
            if (audioSrc) {
                URL.revokeObjectURL(audioSrc);
            }
        }
    }, [audioSrc]);

    useEffect(() => {
        if (!isLoading && autoPlay && audioRef.current && !isPlaying && audioSrc) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => setIsPlaying(true))
                    .catch(e => {
                        console.error("Autoplay failed", e);
                        setIsPlaying(false);
                    });
            }
        }
    }, [isLoading, autoPlay, audioSrc]);

    // Update playback rate when it changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);


    const formatTime = (time: number) => {
        if (!Number.isFinite(time)) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
        }
    };

    const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(1, x / width));

        const newTime = percentage * duration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);

        if (!isPlaying) {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    // Draw waveform
    useEffect(() => {
        if (!canvasRef.current || waveformPeaks.length === 0 || !containerRef.current) return;

        const canvas = canvasRef.current;
        const rect = containerRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        const width = Math.max(rect.width, 100);
        const height = Math.max(rect.height, 40);

        canvas.width = width * dpr;
        canvas.height = height * dpr;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);

        const barCount = waveformPeaks.length;
        const totalBarWidth = width / barCount;
        const barWidth = totalBarWidth * 0.5;
        const gap = totalBarWidth * 0.5;

        ctx.clearRect(0, 0, width, height);

        waveformPeaks.forEach((peak, index) => {
            const x = index * totalBarWidth + (gap / 2);
            // Use 80% height for bars
            const barHeight = Math.max(3, peak * height * 0.8);
            const y = (height - barHeight) / 2;

            const peakTime = (index / barCount) * duration;
            const isPlayed = peakTime <= currentTime;

            // Colors based on theme
            const playedColor = theme.palette.primary.main;
            const unplayedColor = alpha(theme.palette.text.primary, 0.1);

            ctx.fillStyle = isPlayed ? playedColor : unplayedColor;

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y, barWidth, barHeight, 4);
            } else {
                ctx.rect(x, y, barWidth, barHeight);
            }
            ctx.fill();
        });

    }, [waveformPeaks, currentTime, duration, theme]);

    const handleSpeedClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleSpeedClose = (speed?: number) => {
        setAnchorEl(null);
        if (speed) {
            setPlaybackRate(speed);
        }
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                borderRadius: 3,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                width: '100%',
                overflow: 'hidden'
            }}
        >
            {error && (
                <Box sx={{ display: 'none' }}>{/* Hidden error state for cleaner UI, or handle differently */}</Box>
            )}
            {audioSrc && (
                <audio
                    ref={audioRef}
                    src={audioSrc}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={handleEnded}
                    onError={() => setError('Failed to play audio')}
                />
            )}

            <IconButton
                onClick={togglePlay}
                disabled={isLoading}
                sx={{
                    width: 40,
                    height: 40,
                    color: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.2),
                    }
                }}
            >
                {isLoading ? (
                    <CircularProgress size={20} color="inherit" />
                ) : isPlaying ? (
                    <Pause fontSize="small" />
                ) : (
                    <PlayArrow fontSize="small" />
                )}
            </IconButton>

            <Box
                ref={containerRef}
                sx={{
                    flex: 1,
                    height: 40,
                    cursor: 'pointer',
                    position: 'relative',
                    borderRadius: 1,
                    overflow: 'hidden',
                }}
                onClick={handleWaveformClick}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block'
                    }}
                />
            </Box>

            <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 65, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>

            {/* Playback Speed Control */}
            <Button
                size="small"
                onClick={handleSpeedClick}
                sx={{
                    minWidth: 40,
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    fontWeight: 600,
                }}
            >
                {playbackRate}x
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => handleSpeedClose()}
            >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <MenuItem
                        key={rate}
                        selected={rate === playbackRate}
                        onClick={() => handleSpeedClose(rate)}
                        dense
                    >
                        {rate}x
                    </MenuItem>
                ))}
            </Menu>

        </Paper>
    );
}
