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
import toast from 'react-hot-toast';

const RoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const {
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
    closeRoom
  } = useVoiceRoom();

  const [loading, setLoading] = useState(!roomData);
  const [activeMembersCount, setActiveMembersCount] = useState(roomData?.members?.length || 1);
  const [message, setMessage] = useState('');
  const [gameActive, setGameActive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [seatModal, setSeatModal] = useState(null); 
  const { user: currentUser } = useAuthStore();
  
  const ownerId = roomData?.host?.id || roomData?.host?._id;
  const isOwner = (uid) => uid === ownerId;

  // Instant check for local ban
  const bannedUntil = localStorage.getItem(`banned_room_${id}`);
  const isBannedLocally = bannedUntil && parseInt(bannedUntil) > Date.now();

  useEffect(() => {
    if (isBannedLocally) {
      const remainingMs = parseInt(bannedUntil) - Date.now();
      const min = Math.floor(remainingMs / 60000);
      const sec = Math.ceil((remainingMs % 60000) / 1000);
      toast.error(`You are banned from this room for ${min} min ${sec} sec`);
      navigate('/lobby', { replace: true });
    }
  }, [isBannedLocally, bannedUntil, navigate]);

  // Helper to update UI list
  const updateRemotePeers = () => {
    setRemotePeers(Array.from(peersRef.current.keys()));
  };

  // Automatically redirect back to lobby/lastPath if room was minimized on reload
  useEffect(() => {
    const shouldMinimize = localStorage.getItem('roomMinimized') === 'true';
    if (shouldMinimize) {
      const lastPath = localStorage.getItem('lastPath') || '/lobby';
      const timer = setTimeout(() => {
        navigate(lastPath);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [navigate]);

  useEffect(() => {
    if (isBannedLocally) return;

    // 1. Get Room Data
    const fetchRoom = async () => {
      try {
        if (!roomData) {
          setLoading(true);
        }
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

    // 2. Initialize WebRTC & Socket (with listener re-binding support)
    const initWebRTC = async () => {
      if (isInitializingRef.current) return;
      isInitializingRef.current = true;

      let stream = localStreamRef.current;
      if (!stream) {
        try {
          console.log('Initializing owner/user mic. Default micEnabled: true');
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = stream;
        } catch (err) {
          console.warn('Microphone permission denied or unavailable. Entering in listen-only mode:', err);
        }
      }

      try {
        if (!socketRef.current) {
          socketRef.current = io(import.meta.env.VITE_API_URL, {
            withCredentials: true,
            transports: ['websocket']
          });
        }

        const socketInstance = socketRef.current;

        // Deduplicate listeners to avoid multiple binding memory leaks/closures
        socketInstance.off('connect');
        socketInstance.off('peer:existing_users');
        socketInstance.off('peer:seats_updated');
        socketInstance.off('peer:new_user_joined');
        socketInstance.off('peer:receive_message');
        socketInstance.off('peer:offer');
        socketInstance.off('peer:answer');
        socketInstance.off('peer:ice_candidate');
        socketInstance.off('peer:mute_updated');
        socketInstance.off('peer:admin_stood_up');
        socketInstance.off('peer:kicked_by_owner');
        socketInstance.off('voice_room:error');
        socketInstance.off('peer:user_left');

        const onConnect = () => {
          myUserId.current = socketInstance.id;
          
          // Map my own socket ID to my user details
          socketToUserRef.current.set(socketInstance.id, {
            userId: currentUser?._id || currentUser?.id,
            uid: currentUser?.uid,
            username: currentUser?.username,
            avatarUrl: currentUser?.avatarUrl
          });

          socketInstance.emit('peer:join_room', { 
            roomId: id, 
            user: {
              userId: currentUser?._id || currentUser?.id,
              uid: currentUser?.uid, // Send numeric display UID
              username: currentUser?.username,
              avatarUrl: currentUser?.avatarUrl
            }
          });
        };

        socketInstance.on('connect', onConnect);

        if (socketInstance.connected) {
          onConnect();
        }

        socketInstance.on('peer:existing_users', ({ users, seats: initialSeats, activeMembersCount: count }) => {
          if (count !== undefined) setActiveMembersCount(count);
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

         socketInstance.on('peer:seats_updated', ({ seats: updatedSeats, seatsUsers, owner, activeMembersCount: count }) => {
          if (count !== undefined) setActiveMembersCount(count);
          setSeats(updatedSeats);
          if (seatsUsers) {
            seatsUsers.forEach(({ socketId, user: userData }) => {
              socketToUserRef.current.set(socketId, userData);
            });
          }
          if (owner) {
            const updatedHost = {
              _id: owner.userId,
              id: owner.userId,
              username: owner.username,
              avatarUrl: owner.avatarUrl
            };
            setRoomData(prev => prev ? { ...prev, host: updatedHost } : prev);
            setActiveRoom(prev => prev ? { ...prev, host: updatedHost } : prev);
          }
        });

        socketInstance.on('peer:new_user_joined', ({ socketId, user: userData }) => {
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

        socketInstance.on('peer:receive_message', (msg) => {
          setMessages(prev => [...prev, msg]);
        });

        socketInstance.on('peer:offer', ({ sdp, fromUserId }) => {
          const peerData = peersRef.current.get(fromUserId);
          if (peerData && peerData.peer) {
            try {
              peerData.peer.signal(sdp);
            } catch (e) {
              console.warn('Signal error (offer):', e);
            }
          }
        });

        socketInstance.on('peer:answer', ({ sdp, fromUserId }) => {
          const peerData = peersRef.current.get(fromUserId);
          if (peerData && peerData.peer) {
            try {
              peerData.peer.signal(sdp);
            } catch (e) {
              console.warn('Signal error (answer):', e);
            }
          }
        });

        socketInstance.on('peer:ice_candidate', ({ candidate, fromUserId }) => {
          const peerData = peersRef.current.get(fromUserId);
          if (peerData && peerData.peer) {
            try {
              peerData.peer.signal(candidate);
            } catch (e) {
              console.warn('Signal error (ice):', e);
            }
          }
        });

        socketInstance.on('peer:mute_updated', ({ socketId, isMuted, selfMuted, adminMuted }) => {
          setMutedPeers(prev => {
            const next = new Set(prev);
            if (isMuted) next.add(socketId);
            else next.delete(socketId);
            return next;
          });
          setAdminMutedPeers(prev => {
            const next = new Set(prev);
            if (adminMuted) {
              next.add(socketId);
              if (socketId === myUserId.current && localStreamRef.current) {
                const audioTrack = localStreamRef.current.getAudioTracks()[0];
                if (audioTrack) {
                  audioTrack.enabled = false;
                  setIsMuted(true);
                  if (activeSpeakerId === myUserId.current) {
                    setActiveSpeakerId(null);
                  }
                }
              }
            } else {
              next.delete(socketId);
            }
            return next;
          });
        });

        socketInstance.on('peer:admin_stood_up', () => {
          toast.error("You have been stood up from your seat by the owner.");
          if (socketRef.current) {
            socketRef.current.emit('peer:stand_up', { roomId: id });
          }
        });

        socketInstance.on('peer:kicked_by_owner', (data) => {
          const min = data?.remainingMinutes ?? 10;
          const sec = data?.remainingSeconds ?? 0;
          toast.error(`You are kicked please rejoin again in ${min} min ${sec} sec`);
          closeRoom();
          navigate('/lobby');
        });

        socketInstance.on('voice_room:error', ({ message }) => {
          toast.error(message);
          closeRoom();
          navigate('/lobby');
        });

        socketInstance.on('peer:user_left', ({ userId }) => {
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

    // Always run initWebRTC on mount to re-bind listeners and update remote peers correctly
    initWebRTC();

    // Set minimized to false on mount/expansion
    setIsMinimized(false);

    return () => {
      // Clean up: AUTOMATICALLY minimize the room globally rather than disconnecting!
      if (socketRef.current && roomData) {
        setIsMinimized(true);
      }
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
    if (adminMutedPeers.has(myUserId.current)) {
      toast.error("You have been muted by the owner.");
      return;
    }
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
      // Owners/hosts occupy the Owner seat 0 and cannot take user seats 1-8!
      if (isHostMe) return;

      if (amISitting) {
        setSeatModal({ type: 'CONFIRM_CHANGE', seatIndex: index });
      } else {
        setSeatModal({ type: 'CONFIRM_SIT', seatIndex: index });
      }
    }
  };

  const sitDown = (index) => {
    if (socketRef.current) {
      socketRef.current.emit('peer:sit_down', { roomId: id, seatIndex: index });
    }
    setSeatModal(null);
  };

  const standUp = () => {
    if (socketRef.current) {
      socketRef.current.emit('peer:stand_up', { roomId: id });
    }
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
    if (socketRef.current) {
      socketRef.current.emit('peer:send_message', { roomId: id, message: message });
    }
    setMessage('');
  };

  if (isBannedLocally) {
    return null;
  }

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
          <button 
            onClick={() => {
              localStorage.setItem('roomMinimized', 'true');
              navigate('/lobby');
            }} 
            className="text-white hover:text-white/80 transition-colors mr-0.5"
          >
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
              {loading ? '...' : activeMembersCount}
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
          <div 
            onClick={() => {
              if (hostSocketId) {
                setSeatModal({ type: 'PROFILE', seatIndex: -1, userId: hostSocketId });
              }
            }}
            className={`w-20 h-20 rounded-full border-2 p-0.5 relative transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 shadow-2xl
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
                      {userId && adminMutedPeers.has(userId) && (
                        <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-1 border border-bg z-20 flex items-center justify-center w-5 h-5 shadow-lg shadow-red-500/30">
                          <FiMicOff className="text-[10px]" />
                        </div>
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
                  (() => {
                    const occupantUser = socketToUserRef.current.get(seatModal.userId);
                    const avatarUrl = occupantUser?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seatModal.userId}`;
                    const userName = occupantUser?.username || `Guest ${seatModal.seatIndex + 1}`;
                    
                    return (
                      <div className="p-6 flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-full border-2 border-primary p-0.5 mb-4 shadow-lg shadow-primary/20 overflow-hidden">
                          <img 
                            src={avatarUrl} 
                            alt={userName} 
                            className="w-full h-full rounded-full object-cover bg-bg" 
                          />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">{userName}</h3>
                        <p className="text-xs text-white/50 mb-6 font-mono">UID: {occupantUser?.uid || seatModal.userId}</p>
                        <div className="grid grid-cols-2 gap-3 w-full">
                          {occupantUser?.uid && (
                            <button 
                              onClick={() => {
                                setSeatModal(null);
                                navigate(`/user/${occupantUser.uid}`);
                              }}
                              className="col-span-2 flex items-center justify-center gap-2 bg-primary hover:bg-primaryHover py-3 rounded-2xl text-sm font-bold text-white transition-colors mb-1"
                            >
                              <FiUserPlus /> View Profile
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSeatModal(null);
                              if (occupantUser?.uid) {
                                navigate(`/chat/${occupantUser.uid}`);
                              }
                            }}
                            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-sm font-medium transition-colors"
                          >
                            <FiSend className="text-primary" /> Message
                          </button>
                          <button 
                            onClick={() => setSeatModal(null)}
                            className="col-span-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-sm font-medium transition-colors"
                          >
                            <FiX className="text-red-400" /> Close
                          </button>

                          {isHostMe && seatModal.userId !== myUserId.current && (
                            <>
                              <button 
                                onClick={() => {
                                  setSeatModal(null);
                                  if (socketRef.current) {
                                    socketRef.current.emit('peer:admin_mute_toggle', { roomId: id, targetSocketId: seatModal.userId });
                                  }
                                }}
                                className={`col-span-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 border
                                  ${adminMutedPeers.has(seatModal.userId)
                                    ? 'bg-green-600/20 hover:bg-green-600/30 border-green-500/30 text-green-400' 
                                    : 'bg-orange-600/20 hover:bg-orange-600/30 border-orange-500/30 text-orange-400'
                                  }
                                `}
                              >
                                <FiMicOff /> {adminMutedPeers.has(seatModal.userId) ? 'Unmute' : 'Mute'}
                              </button>
                              <button 
                                onClick={() => {
                                  if (window.confirm("Are you sure you want to kick this user? They will be banned for 10 minutes.")) {
                                    setSeatModal(null);
                                    if (socketRef.current) {
                                      socketRef.current.emit('peer:admin_kick', { roomId: id, targetSocketId: seatModal.userId });
                                    }
                                  }
                                }}
                                className="col-span-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 py-3 rounded-2xl text-sm font-bold text-red-400 transition-all active:scale-95"
                              >
                                <FiAlertTriangle /> Kick
                              </button>
                              {seatModal.seatIndex !== -1 && (
                                <button 
                                  onClick={() => {
                                    setSeatModal(null);
                                    if (socketRef.current) {
                                      socketRef.current.emit('peer:admin_lift_up', { roomId: id, targetSocketId: seatModal.userId });
                                    }
                                  }}
                                  className="col-span-2 flex items-center justify-center gap-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 py-3 rounded-2xl text-sm font-bold text-yellow-400 transition-all active:scale-95"
                                >
                                  <FiLogOut /> Lift Up (Stand Up)
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()
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
