import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('gym_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Ignora as rotas de autenticação para evitar loop de redirecionamento
      if (!error.config.url.includes('/login') && !error.config.url.includes('/verify-2fa-reset')) {
        localStorage.removeItem('gym_token');
        localStorage.removeItem('gym_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;