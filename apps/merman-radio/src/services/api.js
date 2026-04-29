import axios from 'axios';
import CryptoJS from 'crypto-js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const HMAC_SECRET = import.meta.env.VITE_APP_SIGNATURE_SECRET;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('merman_token');
    const timestamp = Date.now().toString();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (HMAC_SECRET) {
      const message = `${config.url}:${timestamp}`;
      const signature = CryptoJS.HmacSHA256(message, HMAC_SECRET).toString(CryptoJS.enc.Hex);
      
      config.headers['X-App-Timestamp'] = timestamp;
      config.headers['X-App-Signature'] = signature;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (!error.config.url.includes('/login')) {
        localStorage.removeItem('merman_token');
        localStorage.removeItem('merman_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;