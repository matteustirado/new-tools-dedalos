import { io } from 'socket.io-client';

let socket;

export const initSocket = () => {
  if (!socket) {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    
    socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};