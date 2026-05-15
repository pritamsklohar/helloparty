import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.post('/auth/login', { email, password });
      localStorage.setItem('accessToken', response.data.accessToken);
      set({ 
        user: response.data.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
      return true;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Login failed', 
        isLoading: false 
      });
      return false;
    }
  },

  register: async (userData) => {
    try {
      set({ isLoading: true, error: null });
      
      let response;
      if (userData instanceof FormData) {
        response = await api.post('/auth/register', userData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        response = await api.post('/auth/register', userData);
      }

      localStorage.setItem('accessToken', response.data.accessToken);
      set({ 
        user: response.data.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
      return true;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Registration failed', 
        isLoading: false 
      });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      localStorage.removeItem('accessToken');
      set({ user: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const response = await api.get('/auth/me');
      set({ user: response.data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      localStorage.removeItem('accessToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user })
}));

export default useAuthStore;
