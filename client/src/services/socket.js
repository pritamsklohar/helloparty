import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL;

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
  transports: ['websocket']
});

// Register the connect listener exactly once at the module level to prevent accumulation
socket.on('connect', () => {
  const userId = socket.authUserId;
  if (userId) {
    socket.emit('join_personal', userId);
    console.log('Socket connected and joined personal room:', userId);
  }
});

export const connectSocket = (userId) => {
  if (!userId) return; // Safety check
  
  socket.authUserId = userId;
  
  if (!socket.connected) {
    socket.connect();
  } else {
    socket.emit('join_personal', userId);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
