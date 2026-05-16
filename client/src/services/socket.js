import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL;

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false
});

export const connectSocket = (userId) => {
  if (!userId) return; // Safety check
  
  if (!socket.connected) {
    socket.connect();
    socket.on('connect', () => {
      socket.emit('join_personal', userId);
      console.log('Socket connected and joined personal room:', userId);
    });
  } else {
    socket.emit('join_personal', userId);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
