import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authAPI, type User } from '../lib/api';

interface AuthContextType {
    user: User | null;
    login: (email: string) => Promise<{ success: boolean; error?: string }>;
    register: (email: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    updateUser: (updatedUser: User) => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    // const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            // Optimistically load user from local storage
            const storedUser = localStorage.getItem('tospeech-user');
            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser));
                } catch (e) {
                    console.error('Failed to parse stored user', e);
                    localStorage.removeItem('tospeech-user');
                }
            }

            // Verify session with backend (via cookie)
            try {
                const response = await authAPI.getMe();
                setUser(response.data);
                localStorage.setItem('tospeech-user', JSON.stringify(response.data));
            } catch (err) {
                // If 401 or network error, assume not logged in (or session expired)
                // Only clear if we actually failed auth
                // console.warn("Session check failed", err);
                setUser(null);
                localStorage.removeItem('tospeech-user');
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    const register = async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            await authAPI.register(email);
            // Auto login after register
            return login(email);
        } catch (error: any) {
            console.error('Registration failed:', error);
            let errorMessage = 'Registration failed. Please try again.';

            if (error.response?.data?.detail) {
                const detail = error.response.data.detail;
                if (Array.isArray(detail)) {
                    // Handle Pydantic validation errors (array of objects)
                    // limit to first error for cleaner UI
                    errorMessage = detail.length > 0 ? detail[0].msg : 'Invalid input';
                } else if (typeof detail === 'string') {
                    errorMessage = detail;
                }
            }
            return { success: false, error: errorMessage };
        }
    };

    const login = async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await authAPI.login(email);
            // Cookie is set automatically by backend response
            // const { access_token } = response.data; 
            // setToken(access_token);

            // Fetch user details
            const userResponse = await authAPI.getMe();
            const userData = userResponse.data;

            setUser(userData);
            localStorage.setItem('tospeech-user', JSON.stringify(userData));

            return { success: true };
        } catch (error: any) {
            console.error('Login failed:', error);
            let errorMessage = 'Login failed. Please try again.';

            if (error.response?.data?.detail) {
                const detail = error.response.data.detail;
                if (Array.isArray(detail)) {
                    errorMessage = detail.length > 0 ? detail[0].msg : 'Invalid input';
                } else if (typeof detail === 'string') {
                    errorMessage = detail;
                }
            }
            return { success: false, error: errorMessage };
        }
    };

    const logout = async () => {
        try {
            await authAPI.logout();
        } catch (e) {
            console.error("Logout failed on backend", e);
        }
        localStorage.removeItem('tospeech-user');
        setUser(null);
        // setToken(null);
    };

    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
        localStorage.setItem('tospeech-user', JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, updateUser, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
