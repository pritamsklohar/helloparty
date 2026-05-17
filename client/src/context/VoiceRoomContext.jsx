import { createContext, useContext, useState, useRef } from 'react';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const VoiceRoomContext = createContext();

export const VoiceRoomProvider = ({ children }) => {
  const [activeRoom, setActiveRoom] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Global Session State to prevent unmount loss
  const [roomData, setRoomData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [seats, setSeats] = useState(Array(8).fill(null));
  const [messages, setMessages] = useState([]);
  const [remotePeers, setRemotePeers] = useState([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [speakingPeers, setSpeakingPeers] = useState({});
  const [mutedPeers, setMutedPeers] = useState(new Set());
  const [adminMutedPeers, setAdminMutedPeers] = useState(new Set());

  // Global Session Refs
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // Map<socketId, { peer, stream, user }>
  const socketToUserRef = useRef(new Map()); // Map<socketId, user>
  const myUserId = useRef(null);
  const isInitializingRef = useRef(false);

  const joinRoom = (roomDataVal) => {
    setActiveRoom(roomDataVal);
    setRoomData(roomDataVal);
    setIsMinimized(false);
  };

  const minimizeRoom = () => {
    setIsMinimized(true);
  };

  const restoreRoom = () => {
    setIsMinimized(false);
  };

  const closeRoom = async () => {
    const roomId = activeRoom?._id || roomData?._id;
    
    // 1. If host is leaving and closing
    const currentUser = useAuthStore.getState().user;
    const hostId = activeRoom?.host?._id || activeRoom?.host;
    const isHost = hostId && (hostId === currentUser?._id || hostId === currentUser?.id);
    
    if (activeRoom && isHost) {
      try {
        await api.delete(`/rooms/${activeRoom._id}`);
      } catch (error) {
        console.error('Failed to remove room from DB:', error);
      }
    }

    // 2. Shut down Socket and clear signaling channels
    if (socketRef.current) {
      socketRef.current.emit('peer:leave_room', { roomId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // 3. Close and release microphone hardware
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // 4. Destroy active WebRTC peer connections
    peersRef.current.forEach(data => {
      try {
        data.peer.destroy();
      } catch (e) {
        console.warn("Error destroying WebRTC peer:", e);
      }
    });
    peersRef.current.clear();
    socketToUserRef.current.clear();
    
    myUserId.current = null;
    isInitializingRef.current = false;

    // 5. Reset state
    setActiveRoom(null);
    setRoomData(null);
    setIsMinimized(false);
    setSeats(Array(8).fill(null));
    setMessages([]);
    setRemotePeers([]);
    setActiveSpeakerId(null);
    setSpeakingPeers({});
    setMutedPeers(new Set());
    setAdminMutedPeers(new Set());
  };

  return (
    <VoiceRoomContext.Provider value={{ 
      activeRoom, setActiveRoom,
      isMinimized, setIsMinimized,
      roomData, setRoomData,
      isMuted, setIsMuted,
      isSpeakerOff, setIsSpeakerOff,
      seats, setSeats,
      messages, setMessages,
      remotePeers, setRemotePeers,
      activeSpeakerId, setActiveSpeakerId,
      speakingPeers, setSpeakingPeers,
      mutedPeers, setMutedPeers,
      adminMutedPeers, setAdminMutedPeers,
      socketRef,
      localStreamRef,
      peersRef,
      socketToUserRef,
      myUserId,
      isInitializingRef,
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
