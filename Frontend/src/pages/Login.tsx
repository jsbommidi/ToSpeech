import React, { useState, useEffect, useRef } from 'react';
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    Card,
    CardContent,
    alpha,
    useTheme,
    Alert,
    InputAdornment,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Mail, Mic } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorTimestamp, setErrorTimestamp] = useState<number>(0);
    const hasLoginError = useRef(false);
    const navigate = useNavigate();
    const theme = useTheme();
    const { login, register, isAuthenticated, loading } = useAuth();

    useEffect(() => {
        // Only navigate if authenticated and no login error is being displayed
        if (isAuthenticated && !loading && !hasLoginError.current) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, loading, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!email) {
            setError('Please enter your email');
            return;
        }

        setError('');
        setErrorTimestamp(0);
        setIsSubmitting(true);
        hasLoginError.current = false;

        if (isRegister) {
            // Registration
            const result = await register(email);
            if (result.success) {
                hasLoginError.current = false;
                navigate('/', { replace: true });
            } else {
                hasLoginError.current = true;
                setIsSubmitting(false);
                setError(result.error || 'Registration failed. Please try again.');
                setErrorTimestamp(Date.now());
            }
        } else {
            // Login
            const result = await login(email);
            if (result.success) {
                hasLoginError.current = false;
                navigate('/', { replace: true });
            } else {
                hasLoginError.current = true;
                setIsSubmitting(false);
                setError(result.error || 'Login failed. Please try again.');
                setErrorTimestamp(Date.now());
            }
        }
    };

    const toggleMode = () => {
        setIsRegister(!isRegister);
        setEmail('');
        setError('');
        hasLoginError.current = false;
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme.palette.mode === 'dark'
                    ? theme.palette.background.default
                    : theme.palette.background.default,
                position: 'relative',
            }}
        >
            <Container maxWidth="sm">
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Card
                        elevation={3}
                        sx={{
                            borderRadius: 4,
                            overflow: 'hidden',
                            border: `1px solid ${theme.palette.divider}`,
                        }}
                    >
                        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                            {/* Logo/Icon */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    mb: 4,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: 2,
                                        bgcolor: 'primary.main',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mb: 2,
                                    }}
                                >
                                    <Mic size={32} color={theme.palette.primary.contrastText} />
                                </Box>
                                <Typography
                                    variant="h4"
                                    sx={{
                                        fontWeight: 700,
                                        color: theme.palette.text.primary,
                                        mb: 0.5,
                                    }}
                                >
                                    ToSpeech
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ textAlign: 'center' }}
                                >
                                    Local Text to Audio
                                </Typography>
                            </Box>

                            {/* Title */}
                            <Typography
                                variant="h5"
                                gutterBottom
                                sx={{
                                    textAlign: 'center',
                                    mb: 1,
                                    fontWeight: 600,
                                    color: theme.palette.text.primary,
                                }}
                            >
                                {isRegister ? 'Create Account' : 'Welcome Back'}
                            </Typography>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    textAlign: 'center',
                                    mb: 4,
                                }}
                            >
                                {isRegister
                                    ? 'Enter your email to get started'
                                    : 'Sign in to access your voice notes'}
                            </Typography>

                            {/* Error Alert */}
                            {error && (
                                <Alert severity="error" sx={{ mb: 3 }}>
                                    {error}
                                </Alert>
                            )}

                            {/* Form */}
                            <Box component="form" onSubmit={handleSubmit} noValidate>
                                <TextField
                                    fullWidth
                                    type="email"
                                    label="Email Address"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        // Clear error when user starts typing (but only after it's been shown for at least 2 seconds)
                                        if (error && Date.now() - errorTimestamp > 2000) {
                                            setError('');
                                            setErrorTimestamp(0);
                                            hasLoginError.current = false;
                                        }
                                    }}
                                    required
                                    autoComplete="email"
                                    autoFocus
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Mail
                                                    size={20}
                                                    style={{
                                                        color: theme.palette.text.secondary,
                                                    }}
                                                />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ mb: 3 }}
                                />

                                <Button
                                    type="submit"
                                    fullWidth
                                    size="large"
                                    variant="contained"
                                    disabled={isSubmitting}
                                    sx={{
                                        py: 1.5,
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                    }}
                                >
                                    {isSubmitting ? 'Please wait...' : (isRegister ? 'Create Account' : 'Sign In')}
                                </Button>
                            </Box>

                            {/* Toggle between login/register */}
                            <Box
                                sx={{
                                    mt: 3,
                                    pt: 3,
                                    borderTop: `1px solid ${theme.palette.divider}`,
                                    textAlign: 'center',
                                }}
                            >
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {isRegister ? 'Already have an account?' : "Don't have an account?"}
                                </Typography>
                                <Button
                                    onClick={toggleMode}
                                    sx={{
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        color: theme.palette.primary.dark,
                                        '&:hover': {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                        },
                                    }}
                                >
                                    {isRegister ? 'Login instead' : 'Create an account'}
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            </Container>
        </Box>
    );
}
