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
    localStorage.setItem('inRoom', 'true');
    localStorage.setItem('activeRoomId', roomDataVal._id);
  };

  const minimizeRoom = () => {
    setIsMinimized(true);
  };

  const restoreRoom = () => {
    setIsMinimized(false);
  };

  const closeRoom = async () => {
    const roomId = activeRoom?._id || roomData?._id;

    // 2. Shut down Socket and clear signaling channels
    if (socketRef.current) {
      const socketToDisconnect = socketRef.current;
      let disconnected = false;
      const doDisconnect = () => {
        if (!disconnected) {
          disconnected = true;
          socketToDisconnect.disconnect();
        }
      };
      
      socketToDisconnect.emit('peer:leave_room', { roomId }, doDisconnect);
      setTimeout(doDisconnect, 250); // safety fallback
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
    localStorage.setItem('inRoom', 'false');
    localStorage.removeItem('activeRoomId');
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
