import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // No longer manually sending token, browser handles cookies
  return config;
});

// Response interceptor to handle 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear auth and redirect
      Cookies.remove('auth_token');
      localStorage.removeItem('tospeech-user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);


export interface User {
  id: number;
  email: string;
  is_active: boolean;
}

export const authAPI = {
  login: async (email: string) => {
    return api.post('/auth/login', { email });
  },
  logout: async () => {
    return api.post('/auth/logout');
  },
  register: async (email: string) => {
    return api.post('/register', { email });
  },
  getMe: async () => {
    return api.get<User>('/api/v1/users/me');
  }
};

export interface AudioHistoryItem {
  id: number;
  text_input: string;
  file_path: string;
  model_name: string;
  speaker?: string;
  cfg_scale: number;
  inference_steps: number;
  duration?: number;
  timestamp: string;
}

export const ttsAPI = {
  getHistory: async () => {
    return api.get<AudioHistoryItem[]>('/api/v1/history');
  },
  // Celery-based generation
  generateCelery: async (data: { text: string; model_name: string; speaker?: string; cfg_scale: number; inference_steps: number }) => {
    return api.post<{ task_id: string; status: string; message: string }>('/api/v1/generate/celery', data);
  },
  getTaskStatus: async (taskId: string) => {
    return api.get<{ task_id: string; state: string; status?: string; result?: any }>(`/api/v1/generate/celery/${taskId}`);
  },
  cancelTask: async (taskId: string) => {
    return api.post<{ task_id: string; status: string; message: string }>(`/api/v1/generate/celery/${taskId}/cancel`);
  }
};

export interface UserSettings {
  id: number;
  user_id: number;
  sample_rate: number;
  quality: string;
  format: string;
  auto_save: boolean;
  tts_model: string;
  hf_token: string | null;
}

export type UserSettingsUpdate = Partial<Omit<UserSettings, 'id' | 'user_id'>>;

export const settingsAPI = {
  getSettings: async () => {
    return api.get<UserSettings>('/api/v1/settings');
  },
  updateSettings: async (settings: UserSettingsUpdate) => {
    return api.patch<UserSettings>('/api/v1/settings', settings);
  },
  getAvailableModels: async () => {
    return api.get<{ models: string[] }>('/api/v1/models/available');
  },
  downloadModel: async (url: string, hf_token: string | null) => {
    return api.post('/api/v1/models/download', { url, hf_token });
  },
  getDownloadStatus: async (repoId: string) => {
    return api.get<{ status: string; progress: number; filename?: string; detail?: string }>('/api/v1/models/status', {
      params: { repo_id: repoId }
    });
  },
  getModelSpeakers: async (modelName: string) => {
    return api.get<{ speakers: string[] }>(`/api/v1/models/${modelName}/speakers`);
  },
  deleteModel: async (modelName: string) => {
    return api.delete<{ message: string }>(`/api/v1/models/${modelName}`);
  }
};
