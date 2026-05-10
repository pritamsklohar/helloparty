import { createContext, useContext, useState } from 'react';
import api from '../services/api';

const VoiceRoomContext = createContext();

export const VoiceRoomProvider = ({ children }) => {
  const [activeRoom, setActiveRoom] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const joinRoom = (roomData) => {
    setActiveRoom(roomData);
    setIsMinimized(false);
  };

  const minimizeRoom = () => {
    setIsMinimized(true);
  };

  const closeRoom = async () => {
    if (activeRoom) {
      try {
        await api.delete(`/rooms/${activeRoom._id}`);
      } catch (error) {
        console.error('Failed to remove room from DB:', error);
      }
    }
    setActiveRoom(null);
    setIsMinimized(false);
  };

  const restoreRoom = () => {
    setIsMinimized(false);
  };

  return (
    <VoiceRoomContext.Provider value={{ 
      activeRoom, 
      isMinimized, 
      joinRoom, 
      minimizeRoom, 
      closeRoom, 
      restoreRoom 
    }}>
      {children}
    </VoiceRoomContext.Provider>
  );
};

export const useVoiceRoom = () => {
  const context = useContext(VoiceRoomContext);
  if (!context) {
    throw new Error('useVoiceRoom must be used within a VoiceRoomProvider');
  }
  return context;
};
