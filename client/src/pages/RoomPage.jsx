import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiSettings, FiShare2, FiMic, FiMicOff, FiVolume2, FiVolumeX, FiGift, FiUserPlus, FiSmile, FiSend, FiX, FiMoreVertical, FiPlus, FiUsers, FiAlertTriangle, FiLogOut } from 'react-icons/fi';
import { FaCrown, FaGamepad, FaStop } from 'react-icons/fa';
import api from '../services/api';
import { useVoiceRoom } from '../context/VoiceRoomContext';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { useRef } from 'react';
import useAuthStore from '../store/authStore';

const RoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { joinRoom, closeRoom } = useVoiceRoom();
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false); 
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [gameActive, setGameActive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState({}); 
  
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null); 
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [mutedPeers, setMutedPeers] = useState(new Set()); 
  
  // WebRTC & Seats Refs
  const socketRef = useRef();
  const localStreamRef = useRef();
  const peersRef = useRef(new Map()); // Map<userId, { peer, stream }>
  const [remotePeers, setRemotePeers] = useState([]); // Array of userIds to trigger re-render
  const isInitializingRef = useRef(false);
  
  // Mapping socketId -> userObject { userId, username, avatarUrl }
  const socketToUserRef = useRef(new Map());
  const { user: currentUser } = useAuthStore();
  
  const ownerId = roomData?.host?.id || roomData?.host?._id;
  const isOwner = (uid) => uid === ownerId;
  const [seats, setSeats] = useState(Array(8).fill(null));
  const [seatModal, setSeatModal] = useState(null); // { type, seatIndex, userId }
  const myUserId = useRef(null);

  // Helper to update UI list
  const updateRemotePeers = () => {
    setRemotePeers(Array.from(peersRef.current.keys()));
  };

  useEffect(() => {
    // 1. Get Room Data
    const fetchRoom = async () => {
      try {
        const res = await api.get(`/rooms/${id}`);
        setRoomData(res.data);
        joinRoom(res.data);
      } catch (err) {
        console.error('Failed to load room:', err);
        navigate('/lobby');
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();

    // 2. Initialize WebRTC & Socket
    const initWebRTC = async () => {
      if (isInitializingRef.current || socketRef.current) return;
      isInitializingRef.current = true;

      try {
        console.log('Initializing owner/user mic. Default micEnabled: true');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        
        socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
          withCredentials: true
        });

        socketRef.current.on('connect', () => {
          myUserId.current = socketRef.current.id;
          socketRef.current.emit('peer:join_room', { 
            roomId: id, 
            user: {
              userId: currentUser?._id || currentUser?.id,
              username: currentUser?.username,
              avatarUrl: currentUser?.avatarUrl
            }
          });
        });

        socketRef.current.on('peer:existing_users', ({ users, seats: initialSeats }) => {
          if (initialSeats) setSeats(initialSeats);
          users.forEach(({ socketId, user: userData }) => {
            socketToUserRef.current.set(socketId, userData);
            if (!peersRef.current.has(socketId)) {
              const peer = createPeer(socketId, stream);
              peersRef.current.set(socketId, { peer, stream: null, user: userData });
            }
          });
          updateRemotePeers();
        });

        socketRef.current.on('peer:seats_updated', ({ seats: updatedSeats }) => {
          setSeats(updatedSeats);
        });

        socketRef.current.on('peer:new_user_joined', ({ socketId, user: userData }) => {
          socketToUserRef.current.set(socketId, userData);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'SYSTEM',
            content: `${userData.username} joined the room`
          }]);
          if (!peersRef.current.has(socketId)) {
            const peer = addPeer(socketId, stream);
            peersRef.current.set(socketId, { peer, stream: null, user: userData });
            updateRemotePeers();
          }
        });

        socketRef.current.on('peer:receive_message', (msg) => {
          setMessages(prev => [...prev, msg]);
        });

        socketRef.current.on('peer:offer', ({ sdp, fromUserId }) => {
          const peerData = peersRef.current.get(fromUserId);
          if (peerData && peerData.peer) {
            try {
              peerData.peer.signal(sdp);
            } catch (e) {
              console.warn('Signal error (offer):', e);
            }
          }
        });

        socketRef.current.on('peer:answer', ({ sdp, fromUserId }) => {
          const peerData = peersRef.current.get(fromUserId);
          if (peerData && peerData.peer) {
            try {
              peerData.peer.signal(sdp);
            } catch (e) {
              console.warn('Signal error (answer):', e);
            }
          }
        });

        socketRef.current.on('peer:ice_candidate', ({ candidate, fromUserId }) => {
          const peerData = peersRef.current.get(fromUserId);
          if (peerData && peerData.peer) {
            try {
              peerData.peer.signal(candidate);
            } catch (e) {
              console.warn('Signal error (ice):', e);
            }
          }
        });

        socketRef.current.on('peer:mute_updated', ({ socketId, isMuted }) => {
          setMutedPeers(prev => {
            const next = new Set(prev);
            if (isMuted) next.add(socketId);
            else next.delete(socketId);
            return next;
          });
        });

        socketRef.current.on('peer:user_left', ({ userId }) => {
          const userData = socketToUserRef.current.get(userId);
          if (userData) {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              type: 'SYSTEM',
              content: `${userData.username} left the room`
            }]);
          }
          const peerData = peersRef.current.get(userId);
          if (peerData) {
            peerData.peer.destroy();
            peersRef.current.delete(userId);
            socketToUserRef.current.delete(userId);
            setMutedPeers(prev => {
              const next = new Set(prev);
              next.delete(userId);
              return next;
            });
            updateRemotePeers();
          }
        });
      } catch (err) {
        console.error('WebRTC Init Error:', err);
      } finally {
        isInitializingRef.current = false;
      }
    };

    initWebRTC();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      peersRef.current.forEach(data => data.peer.destroy());
      peersRef.current.clear();
    };
  }, [id, navigate]);

  // Peer Helper Functions
  const createPeer = (userToSignal, stream) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });
    peer.on('signal', signal => {
      if (socketRef.current) {
        socketRef.current.emit('peer:offer', { targetUserId: userToSignal, sdp: signal });
      }
    });
    peer.on('stream', remoteStream => {
      const peerData = peersRef.current.get(userToSignal);
      if (peerData) {
        peerData.stream = remoteStream;
        updateRemotePeers();
      }
    });
    return peer;
  };

  const addPeer = (userId, stream) => {
    const peer = new Peer({ initiator: false, trickle: false, stream });
    peer.on('signal', signal => {
      if (socketRef.current) {
        socketRef.current.emit('peer:answer', { targetUserId: userId, sdp: signal });
      }
    });
    peer.on('stream', remoteStream => {
      const peerData = peersRef.current.get(userId);
      if (peerData) {
        peerData.stream = remoteStream;
        updateRemotePeers();
      }
    });
    return peer;
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMuteState = audioTrack.enabled; 
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        if (!audioTrack.enabled && activeSpeakerId === myUserId.current) {
          setActiveSpeakerId(null);
        }

        socketRef.current.emit('peer:mute_state', { roomId: id, isMuted: !audioTrack.enabled });
      }
    }
  };

  const handleSeatClick = (index) => {
    const occupantId = seats[index];
    const amISitting = seats.includes(myUserId.current);
    
    if (occupantId === myUserId.current) {
      setSeatModal({ type: 'CONFIRM_STAND', seatIndex: index });
    } else if (occupantId) {
      setSeatModal({ type: 'PROFILE', seatIndex: index, userId: occupantId });
    } else {
      if (amISitting) {
        setSeatModal({ type: 'CONFIRM_CHANGE', seatIndex: index });
      } else {
        setSeatModal({ type: 'CONFIRM_SIT', seatIndex: index });
      }
    }
  };

  const sitDown = (index) => {
    socketRef.current.emit('peer:sit_down', { roomId: id, seatIndex: index });
    setSeatModal(null);
  };

  const standUp = () => {
    socketRef.current.emit('peer:stand_up', { roomId: id });
    setSeatModal(null);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOff(!isSpeakerOff);
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.room-menu-container')) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isMenuOpen]);

  const isHostMe = isOwner(currentUser?.id || currentUser?._id);
  
  const hostSocketId = !isHostMe 
    ? Array.from(peersRef.current.entries()).find(([_, data]) => 
        isOwner(data.user?.userId)
      )?.[0]
    : myUserId.current;

  const handleSpeakingUpdate = (socketId, isSpeaking) => {
    if (!socketId) return; 
    if (isSpeaking) {
      setActiveSpeakerId(socketId);
    } else if (activeSpeakerId === socketId) {
      setActiveSpeakerId(null);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const newMsg = {
      id: Date.now().toString(),
      type: 'TEXT',
      sender: { username: 'You' },
      content: message,
      isOwn: true
    };
    
    setMessages(prev => [...prev, newMsg]);
    socketRef.current.emit('peer:send_message', { roomId: id, message: message });
    setMessage('');
  };

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden relative">
      {/* Dynamic background effect */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[100px] rounded-full mix-blend-screen animate-pulse-ring"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/10 blur-[100px] rounded-full mix-blend-screen animate-pulse-ring" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Room Header (Absolute to match the image design) */}
      <header className="absolute top-0 left-0 w-full h-16 pt-2 flex items-center justify-between px-3 z-50">
        
        {/* Left Side Group */}
        <div className="flex items-center gap-1">
          {/* Back Button */}
          <button onClick={() => navigate('/lobby')} className="text-white hover:text-white/80 transition-colors mr-0.5">
            <FiChevronLeft className="text-2xl" />
          </button>
          
          {/* Room Info Pill */}
          <div className="flex items-center bg-black/20 rounded-full pr-3 p-1 backdrop-blur-sm border border-white/10">
            {/* Host Avatar */}
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-white/20">
              <img 
                src={roomData?.host?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${roomData?.host?.username || 'Host'}`} 
                alt="Host" 
                className="w-full h-full object-cover bg-surfaceAlt" 
              />
            </div>
            
            {/* Room Name & UID */}
            <div className="flex flex-col mx-2 justify-center max-w-[100px] sm:max-w-[150px]">
              <span className="text-sm font-bold text-white leading-tight truncate">
                {loading ? 'Loading...' : roomData?.name || 'Room'}
              </span>
              <span className="text-[10px] text-white/70 leading-tight font-mono">
                ID: {loading ? '...' : roomData?.roomId || id}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side Group */}
        <div className="flex items-center gap-2 relative room-menu-container">
          {/* User Count Indicator */}
          <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-full">
            <FiUsers className="text-white/60 text-xs" />
            <span className="text-xs font-bold text-white">
              {loading ? '...' : (roomData?.members?.length || 1)}
            </span>
          </div>
          
          {/* More Options Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className={`text-white transition-all p-1 rounded-full ${isMenuOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}
          >
            <FiMoreVertical className="text-xl" />
          </button>

          {/* Options Dropdown Menu */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-12 right-0 w-48 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden"
              >
                <div className="py-2 px-1 flex flex-col">
                  <button className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left">
                    <FiUserPlus className="text-lg text-primary" />
                    Invite Friend
                  </button>
                  <button className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left">
                    <FiAlertTriangle className="text-lg text-yellow-500" />
                    Report Room
                  </button>
                  <div className="h-[1px] bg-white/5 my-1 mx-2" />
                  <button 
                    onClick={() => {
                      closeRoom();
                      navigate('/lobby');
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                  >
                    <FiLogOut className="text-lg" />
                    Exit Room
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pt-20 relative z-10 w-full h-full pb-14">
        
        {/* Host Area (Top Center) */}
        <div className="flex flex-col items-center justify-center mt-2 mb-8">
          <div className={`w-20 h-20 rounded-full border-2 p-0.5 relative transition-all duration-300
            ${isOwner(roomData?.host?.id || roomData?.host?._id) ? 'border-[#8e44ad]' : 'border-[#2ecc71]'}
            ${activeSpeakerId === hostSocketId ? 'animate-pulse-glow scale-110' : ''}
          `}>
            {/* Rippling Rings when host is talking */}
            {activeSpeakerId === hostSocketId && (
              <>
                <div className={`animate-ripple ${isOwner(roomData?.host?.id || roomData?.host?._id) ? 'ripple-owner' : 'ripple-user'}`} style={{ animationDelay: '0s' }}></div>
                <div className={`animate-ripple ${isOwner(roomData?.host?.id || roomData?.host?._id) ? 'ripple-owner' : 'ripple-user'}`} style={{ animationDelay: '0.4s' }}></div>
              </>
            )}
            <img 
              src={roomData?.host?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${roomData?.host?.username || 'Host'}`} 
              alt="Host" 
              className="w-full h-full rounded-full object-cover bg-surfaceAlt relative z-10" 
            />
            
            {/* If I am the host, use local VAD */}
            {isHostMe ? (
              <AudioStream 
                stream={localStreamRef.current} 
                micEnabled={!isMuted}
                muted={true} 
                onSpeaking={(speaking) => handleSpeakingUpdate(myUserId.current, speaking)}
              />
            ) : (
              /* If I am a guest, find host peer stream */
              hostSocketId && peersRef.current.get(hostSocketId)?.stream && (
                <AudioStream 
                  stream={peersRef.current.get(hostSocketId).stream} 
                  micEnabled={!mutedPeers.has(hostSocketId)}
                  muted={isSpeakerOff} 
                  onSpeaking={(speaking) => handleSpeakingUpdate(hostSocketId, speaking)}
                />
              )
            )}
            
            <div className="absolute -bottom-1 -right-1 bg-[#8e44ad] text-[10px] px-1.5 rounded-full text-white font-bold border border-white/20">OWNER</div>
          </div>
          <div className={`text-xs font-bold mt-2 transition-colors ${activeSpeakerId === hostSocketId ? 'text-primary' : 'text-white/90'}`}>
            {roomData?.host?.username || 'Host Name'}
          </div>
        </div>

        {/* Seats Grid */}
        <div className="grid grid-cols-4 gap-y-10 gap-x-4 px-6 relative z-10">
          {seats.map((userId, i) => {
            const isMe = userId === myUserId.current;
            const peerData = userId ? peersRef.current.get(userId) : null;
            const isMutedRemote = mutedPeers.has(userId);
            const isActuallySpeaking = userId && activeSpeakerId === userId;
            
            // Get user info from map
            const userData = socketToUserRef.current.get(userId);
            const userUid = isMe ? (currentUser?.id || currentUser?._id) : userData?.userId;
            const userIsOwner = isOwner(userUid);
            
            const avatarUrl = isMe 
              ? (currentUser?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username}`) 
              : (userData?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`);
            
            const userName = isMe 
              ? (currentUser?.username || 'You') 
              : (userData?.username || `Guest ${i+1}`);

            return (
              <div key={i} className="flex flex-col items-center">
                <div 
                  onClick={() => handleSeatClick(i)}
                  className={`w-14 h-14 rounded-full border-2 transition-all duration-300 cursor-pointer flex items-center justify-center relative shadow-xl
                    ${userId ? 'bg-surfaceAlt' : 'bg-black/10 border-white/10 hover:bg-white/5'}
                    ${userIsOwner ? 'border-[#8e44ad]' : 'border-[#2ecc71]'}
                    ${isActuallySpeaking ? 'animate-pulse-glow scale-110' : ''}
                  `}
                >
                  {/* Rippling Rings when talking */}
                  {isActuallySpeaking && (
                    <>
                      <div className={`animate-ripple ${userIsOwner ? 'ripple-owner' : 'ripple-user'}`} style={{ animationDelay: '0s' }}></div>
                      <div className={`animate-ripple ${userIsOwner ? 'ripple-owner' : 'ripple-user'}`} style={{ animationDelay: '0.4s' }}></div>
                    </>
                  )}

                  {userId ? (
                    <>
                      <img 
                        src={avatarUrl} 
                        alt="User"
                        className="w-full h-full object-cover rounded-full relative z-10"
                      />
                      {isMe ? (
                        <AudioStream 
                          stream={localStreamRef.current} 
                          micEnabled={!isMuted}
                          muted={true} 
                          onSpeaking={(speaking) => handleSpeakingUpdate(myUserId.current, speaking)}
                        />
                      ) : (
                        peerData?.stream && (
                          <AudioStream 
                            stream={peerData.stream} 
                            micEnabled={!isMutedRemote}
                            muted={isSpeakerOff} 
                            onSpeaking={(speaking) => handleSpeakingUpdate(userId, speaking)}
                          />
                        )
                      )}
                      {isMe && (
                        <div className="absolute -top-1 -right-1 bg-primary text-[8px] px-1 rounded-full text-white font-bold">YOU</div>
                      )}
                      {userIsOwner && !isMe && (
                        <div className="absolute -top-1 -right-1 bg-[#8e44ad] text-[6px] px-1 rounded-full text-white font-bold">OWNER</div>
                      )}
                    </>
                  ) : (
                    <FiPlus className="text-white/30 text-xl" />
                  )}
                </div>
                <span className={`text-[10px] mt-1.5 transition-colors max-w-[60px] truncate ${isActuallySpeaking ? 'text-primary font-bold' : 'text-white/50'}`}>
                  {userName}
                </span>
              </div>
            );
          })}
        </div>

        {/* Seat Interaction Modal */}
        <AnimatePresence>
          {seatModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setSeatModal(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-surfaceAlt/95 backdrop-blur-xl border border-white/10 w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl relative z-10"
              >
                {seatModal.type === 'PROFILE' ? (
                  <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full border-2 border-primary p-0.5 mb-4 shadow-lg shadow-primary/20">
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seatModal.userId}`} 
                        alt="Profile" 
                        className="w-full h-full rounded-full object-cover bg-bg" 
                      />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Guest {seatModal.seatIndex + 1}</h3>
                    <p className="text-xs text-white/50 mb-6 font-mono">UID: {seatModal.userId.substring(0, 8)}</p>
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <button className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-sm font-medium transition-colors">
                        <FiSend className="text-primary" /> Message
                      </button>
                      <button className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-sm font-medium transition-colors">
                        <FiUserPlus className="text-primary" /> Follow
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                      <FiPlus className="text-2xl text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      {seatModal.type === 'CONFIRM_SIT' && 'Take this seat?'}
                      {seatModal.type === 'CONFIRM_STAND' && 'Stand up from seat?'}
                      {seatModal.type === 'CONFIRM_CHANGE' && 'Move to this seat?'}
                    </h3>
                    <p className="text-xs text-white/50 mb-6">
                      {seatModal.type === 'CONFIRM_SIT' && 'You will be able to speak once you sit down.'}
                      {seatModal.type === 'CONFIRM_STAND' && 'You will stop speaking and become a listener.'}
                      {seatModal.type === 'CONFIRM_CHANGE' && 'You will move from your current seat to this one.'}
                    </p>
                    <div className="flex gap-3 w-full">
                      <button 
                        onClick={() => setSeatModal(null)}
                        className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => seatModal.type === 'CONFIRM_STAND' ? standUp() : sitDown(seatModal.seatIndex)}
                        className="flex-1 bg-primary hover:bg-primary-dark py-3 rounded-2xl text-sm font-bold text-white transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Chat Area (Overlay at Bottom) */}
        <div className="w-full h-48 px-3 flex flex-col justify-end pb-2 overflow-hidden pointer-events-none mt-auto">
          <div className="flex-1 overflow-y-auto space-y-2 flex flex-col-reverse scrollbar-hide pointer-events-auto">
            {[...messages].reverse().map((msg, i) => (
              <div key={msg.id} className="bg-black/30 backdrop-blur-sm rounded-xl px-3 py-2 self-start max-w-[85%] border border-white/5">
                {msg.type === 'SYSTEM' ? (
                  <p className="text-[11px] text-yellow-300/90 leading-relaxed font-medium">
                    🔔 System: {msg.content}
                  </p>
                ) : (
                  <p className="text-xs text-white/90 leading-relaxed">
                    <span className="font-bold text-[#b47ceb]">{msg.sender?.username || 'User'}: </span>
                    {msg.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Control Bar (Fixed) */}
      <div className="absolute bottom-0 left-0 w-full h-14 bg-transparent px-4 flex items-center justify-between z-20 pb-2">
        {/* Left Icons */}
        <div className="flex gap-4 text-white hover:text-white/80 transition-colors">
          <button onClick={toggleSpeaker}>
            {isSpeakerOff ? <FiVolumeX className="text-xl text-red-500" /> : <FiVolume2 className="text-xl" />}
          </button>
          <button onClick={toggleMute}>
            {isMuted ? <FiMicOff className="text-xl text-red-500" /> : <FiMic className="text-xl" />}
          </button>
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="flex-1 mx-4 h-9 bg-black/20 rounded-full border border-white/10 px-4 flex items-center">
          <input 
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type..."
            className="w-full bg-transparent border-none outline-none text-white text-xs placeholder:text-white/40"
          />
        </form>

        {/* Right Icons */}
        <div className="flex gap-4 text-white hover:text-white/80 transition-colors items-center">
          <button><FiSmile className="text-xl" /></button>
          <button><FiGift className="text-xl text-[#ff4757]" /></button>
          <button><FiSettings className="text-xl" /></button>
        </div>
      </div>
    </div>
  );
};

// CSS injected into head for simplicity in this example
const injectStyles = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes ripple {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .animate-ripple {
      position: absolute;
      top: -6px; left: -6px; right: -6px; bottom: -6px;
      border-radius: 50%;
      border-width: 4px; /* Thicker solid ring */
      border-style: solid;
      animation: ripple 1.2s infinite;
      z-index: 5;
      pointer-events: none;
    }
    .ripple-owner { border-color: #8e44ad; }
    .ripple-user { border-color: #2ecc71; }

    @keyframes pulse-glow {
      0%, 100% { transform: scale(1.05); }
      50% { transform: scale(1.15); }
    }
    .animate-pulse-glow { animation: pulse-glow 0.8s infinite; }
  `;
  document.head.appendChild(style);
};
injectStyles();

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
          const currentlySpeaking = average > 20; // Increased threshold to 20 for solid detection

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
              }, 300); // 300ms smoothing delay
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

export default RoomPage;
