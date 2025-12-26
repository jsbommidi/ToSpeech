import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { settingsAPI, type UserSettings, type UserSettingsUpdate } from '../lib/api';
import Cookies from 'js-cookie';

// Default settings per requirements
const defaultSettings: Omit<UserSettings, 'id' | 'user_id'> = {
  sample_rate: 24000, // 24kHz is optimal for VibeVoice TTS model
  quality: 'high',
  format: 'uncompressed',
  auto_save: true,
  tts_model: 'default',
  hf_token: '',
};

interface SettingsContextType {
  settings: Omit<UserSettings, 'id' | 'user_id'>;
  loading: boolean;
  updateSettings: (newSettings: UserSettingsUpdate) => Promise<void>;
  resetSettings: () => Promise<void>;
  clearLocalState: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage if available (optimistic load)
  const [settings, setSettingsState] = useState<Omit<UserSettings, 'id' | 'user_id'>>(() => {
    const saved = localStorage.getItem('tospeech-settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth status helper
  const checkAuth = () => !!Cookies.get('auth_token');

  // Load from backend on mount or auth change
  useEffect(() => {
    const isAuth = checkAuth();
    setIsAuthenticated(isAuth);

    if (isAuth) {
      setLoading(true);
      settingsAPI.getSettings()
        .then(response => {
          const { id, user_id, ...backendSettings } = response.data;
          // Merge backend settings, falling back to defaults for nulls if any
          // (API guarantees values mostly, but hf_token might be null)
          const merged = {
            ...defaultSettings,
            ...backendSettings,
            hf_token: backendSettings.hf_token || ''
          };
          setSettingsState(merged);
          localStorage.setItem('tospeech-settings', JSON.stringify(merged));
        })
        .catch(err => {
          console.error("Failed to fetch settings", err);
          // If fetch fails (offline?), we still have localStorage
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // Could depend on location/path if we want to re-fetch on generic navigation, but mount is usually enough

  const updateSettings = async (newSettings: UserSettingsUpdate) => {
    // Optimistic update
    setSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('tospeech-settings', JSON.stringify(updated));
      return updated;
    });

    if (checkAuth()) {
      try {
        await settingsAPI.updateSettings(newSettings);
      } catch (error) {
        console.error("Failed to sync settings to backend", error);
        // We could revert state here if strict consistency is needed, 
        // but for settings, "last write wins" locally is usually fine UX.
      }
    }
  };

  const resetSettings = async () => {
    setSettingsState(defaultSettings);
    localStorage.setItem('tospeech-settings', JSON.stringify(defaultSettings));

    if (checkAuth()) {
      try {
        await settingsAPI.updateSettings({
          ...defaultSettings,
          // Ensure we explicitly set fields to default
        });
      } catch (err) {
        console.error("Failed to reset backend settings", err);
      }
    }
  };

  const clearLocalState = () => {
    setSettingsState(defaultSettings);
    localStorage.removeItem('tospeech-settings');
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        resetSettings,
        clearLocalState
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
