import { createContext, useContext, useState, useRef, useEffect } from 'react';
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
    localStorage.setItem('roomMinimized', 'false');

    // Update local user state in authStore
    const authUser = useAuthStore.getState().user;
    if (authUser) {
      useAuthStore.setState({
        user: { ...authUser, inRoom: roomDataVal._id }
      });
    }
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
    localStorage.removeItem('roomMinimized');

    // Update local user state in authStore
    const authUser = useAuthStore.getState().user;
    if (authUser) {
      useAuthStore.setState({
        user: { ...authUser, inRoom: null }
      });
    }
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
      
      {/* PERSISTENT AUDIO ELEMENTS WRAPPED GLOBALLY TO PREVENT UNMOUNT/DISCONNECT ON MINIMIZE */}
      <div className="hidden">
        {/* Play local mic for VAD if active */}
        {localStreamRef.current && (
          <AudioStream 
            stream={localStreamRef.current} 
            micEnabled={!isMuted}
            muted={true} 
            onSpeaking={(speaking) => {
              if (speaking) {
                setActiveSpeakerId(myUserId.current);
              } else if (activeSpeakerId === myUserId.current) {
                setActiveSpeakerId(null);
              }
            }}
          />
        )}
        
        {/* Play all remote streams */}
        {remotePeers.map(socketId => {
          const peerData = peersRef.current.get(socketId);
          if (peerData && peerData.stream) {
            return (
              <AudioStream 
                key={socketId}
                stream={peerData.stream} 
                micEnabled={!mutedPeers.has(socketId)}
                muted={isSpeakerOff} 
                onSpeaking={(speaking) => {
                  if (speaking) {
                    setActiveSpeakerId(socketId);
                  } else if (activeSpeakerId === socketId) {
                    setActiveSpeakerId(null);
                  }
                }}
              />
            );
          }
          return null;
        })}
      </div>
    </VoiceRoomContext.Provider>
  );
};

// Helper component to play remote audio streams with Voice Activity Detection
const AudioStream = ({ stream, muted, onSpeaking, micEnabled }) => {
  const audioRef = useRef();
  const timeoutRef = useRef(null);
  const speakingRef = useRef(false);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!stream || !micEnabled) {
      if (speakingRef.current) {
        speakingRef.current = false;
        onSpeaking(false);
      }
      return;
    }

    let audioContext, analyser, source, dataArray, animationId;

    const setupAudio = () => {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        const checkSpeaking = () => {
          analyser.getByteFrequencyData(dataArray);
          let values = 0;
          for (let i = 0; i < bufferLength; i++) {
            values += dataArray[i];
          }
          const average = values / bufferLength;
          const currentlySpeaking = average > 20;

          if (currentlySpeaking) {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            if (!speakingRef.current) {
              speakingRef.current = true;
              onSpeaking(true);
            }
          } else if (speakingRef.current) {
            if (!timeoutRef.current) {
              timeoutRef.current = setTimeout(() => {
                speakingRef.current = false;
                onSpeaking(false);
                timeoutRef.current = null;
              }, 300);
            }
          }
          animationId = requestAnimationFrame(checkSpeaking);
        };
        checkSpeaking();
      } catch (err) {
        console.error('Audio Setup Error:', err);
      }
    };

    setupAudio();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (audioContext) audioContext.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [stream, micEnabled]);

  return <audio ref={audioRef} autoPlay muted={muted} className="hidden" />;
};

export const useVoiceRoom = () => {
  const context = useContext(VoiceRoomContext);
  if (!context) {
    throw new Error('useVoiceRoom must be used within a VoiceRoomProvider');
  }
  return context;
};
