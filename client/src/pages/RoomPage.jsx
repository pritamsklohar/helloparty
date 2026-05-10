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

// Mock data
const MOCK_USERS = [
  { id: '1', username: 'Alex', isHost: true, isSpeaking: true, isMuted: false },
  { id: '2', username: 'SarahX', isHost: false, isSpeaking: false, isMuted: true },
  { id: '3', username: 'NightWolf', isHost: false, isSpeaking: false, isMuted: false },
  { id: '4', username: 'Picasso', isHost: false, isSpeaking: false, isMuted: false },
  { id: '5', username: 'Emma', isHost: false, isSpeaking: true, isMuted: false },
];

const MOCK_MESSAGES = [
  { id: '1', type: 'SYSTEM', content: 'Alex created the room' },
  { id: '2', type: 'TEXT', sender: { username: 'SarahX' }, content: 'Hey everyone! Ready for a game?' },
  { id: '3', type: 'TEXT', sender: { username: 'NightWolf' }, content: 'Yeah let\'s play Spy!' },
  { id: '4', type: 'SYSTEM', content: 'Emma joined the room' },
];

const RoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { joinRoom, closeRoom } = useVoiceRoom();
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [gameActive, setGameActive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState({}); // { peerId: boolean }
  
  const [speakingToggle, setSpeakingToggle] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  
  // WebRTC Refs
  const socketRef = useRef();
  const localStreamRef = useRef();
  const peersRef = useRef([]); // { peerId, peer, stream }
  const [remoteStreams, setRemoteStreams] = useState([]); // Array of { socketId, stream }

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
      try {
        // Get local audio
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        
        // Connect socket
        socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
          withCredentials: true
        });

        socketRef.current.emit('peer:join_room', { roomId: id });

        // Handle existing users
        socketRef.current.on('peer:existing_users', ({ users }) => {
          users.forEach(userId => {
            const peer = createPeer(userId, socketRef.current.id, stream);
            peersRef.current.push({ peerId: userId, peer });
          });
          setRemoteStreams([...peersRef.current]);
        });

        // Handle new user
        socketRef.current.on('peer:new_user_joined', ({ userId }) => {
          const peer = addPeer(userId, socketRef.current.id, stream);
          peersRef.current.push({ peerId: userId, peer });
          setRemoteStreams([...peersRef.current]);
        });

        // Handle offer
        socketRef.current.on('peer:offer', ({ sdp, fromUserId }) => {
          const peer = peersRef.current.find(p => p.peerId === fromUserId)?.peer;
          if (peer) peer.signal(sdp);
        });

        // Handle answer
        socketRef.current.on('peer:answer', ({ sdp, fromUserId }) => {
          const peer = peersRef.current.find(p => p.peerId === fromUserId)?.peer;
          if (peer) peer.signal(sdp);
        });

        // Handle ICE
        socketRef.current.on('peer:ice_candidate', ({ candidate, fromUserId }) => {
          const peer = peersRef.current.find(p => p.peerId === fromUserId)?.peer;
          if (peer) peer.signal(candidate);
        });

        // Handle user left
        socketRef.current.on('peer:user_left', ({ userId }) => {
          const peerObj = peersRef.current.find(p => p.peerId === userId);
          if (peerObj) peerObj.peer.destroy();
          peersRef.current = peersRef.current.filter(p => p.peerId !== userId);
          setRemoteStreams([...peersRef.current]);
        });

      } catch (err) {
        console.error('WebRTC Init Error:', err);
      }
    };

    initWebRTC();

    const interval = setInterval(() => setSpeakingToggle(prev => !prev), 1500);
    return () => {
      clearInterval(interval);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      peersRef.current.forEach(p => p.peer.destroy());
    };
  }, [id, navigate]);

  // Peer Helper Functions
  const createPeer = (userToSignal, callerId, stream) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });
    peer.on('signal', signal => {
      socketRef.current.emit('peer:offer', { targetUserId: userToSignal, sdp: signal });
    });
    peer.on('stream', remoteStream => {
      const peerObj = peersRef.current.find(p => p.peerId === userToSignal);
      if (peerObj) {
        peerObj.stream = remoteStream;
        setRemoteStreams([...peersRef.current]);
      }
    });
    return peer;
  };

  const addPeer = (incomingSignal, callerId, stream) => {
    const peer = new Peer({ initiator: false, trickle: false, stream });
    peer.on('signal', signal => {
      socketRef.current.emit('peer:answer', { targetUserId: incomingSignal, sdp: signal });
    });
    peer.on('stream', remoteStream => {
      const peerObj = peersRef.current.find(p => p.peerId === incomingSignal);
      if (peerObj) {
        peerObj.stream = remoteStream;
        setRemoteStreams([...peersRef.current]);
      }
    });
    return peer;
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        socketRef.current.emit('peer:mute_state', { roomId: id, isMuted: !audioTrack.enabled });
      }
    }
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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setMessages([...messages, {
      id: Date.now().toString(),
      type: 'TEXT',
      sender: { username: 'You' },
      content: message,
      isOwn: true
    }]);
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
          <div className="w-20 h-20 rounded-full border-2 border-[#8e44ad] p-0.5 relative shadow-[0_0_15px_rgba(142,68,173,0.5)]">
            <img 
              src={roomData?.host?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${roomData?.host?.username || 'Host'}`} 
              alt="Host" 
              className="w-full h-full rounded-full object-cover bg-surfaceAlt" 
            />
          </div>
          <div className="text-xs font-bold mt-2 text-white/90">
            {roomData?.host?.username || 'Host Name'}
          </div>
        </div>

        {/* Remote Peers Grid */}
        <div className="grid grid-cols-4 gap-4 px-4">
          {remoteStreams.slice(0, 8).map((peer, i) => (
            <div key={peer.peerId} className="flex flex-col items-center">
              <div className={`w-14 h-14 rounded-full border-2 transition-all duration-300 ${speakingPeers[peer.peerId] ? 'border-primary animate-pulse-glow scale-110' : 'border-white/20'} flex items-center justify-center bg-surfaceAlt overflow-hidden relative shadow-xl`}>
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${peer.peerId}`} 
                  alt="User"
                  className="w-full h-full object-cover"
                />
                <AudioStream 
                  stream={peer.stream} 
                  muted={isSpeakerOff} 
                  onSpeaking={(isSpeaking) => {
                    setSpeakingPeers(prev => ({ ...prev, [peer.peerId]: isSpeaking }));
                  }}
                />
              </div>
              <span className={`text-[10px] mt-1 transition-colors ${speakingPeers[peer.peerId] ? 'text-primary font-bold' : 'text-white/50'}`}>Guest {i+1}</span>
            </div>
          ))}
          
          {[...Array(Math.max(0, 8 - remoteStreams.length))].map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center bg-black/10 text-white/40 hover:bg-white/5 transition-colors cursor-pointer">
                <FiPlus className="text-xl" />
              </div>
            </div>
          ))}
        </div>

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
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 5px rgba(142, 68, 173, 0.4), 0 0 10px rgba(142, 68, 173, 0.2); border-color: rgba(142, 68, 173, 0.5); }
      50% { box-shadow: 0 0 20px rgba(142, 68, 173, 0.8), 0 0 30px rgba(142, 68, 173, 0.4); border-color: rgba(142, 68, 173, 1); }
    }
    .animate-pulse-glow { animation: pulse-glow 1s infinite; }
  `;
  document.head.appendChild(style);
};
injectStyles();

// Helper component to play remote audio streams with Voice Activity Detection
const AudioStream = ({ stream, muted, onSpeaking }) => {
  const audioRef = useRef();

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speaking = false;
      const checkSpeaking = () => {
        analyser.getByteFrequencyData(dataArray);
        let values = 0;
        for (let i = 0; i < bufferLength; i++) {
          values += dataArray[i];
        }
        const average = values / bufferLength;
        const currentlySpeaking = average > 15; // Sensitivity threshold

        if (currentlySpeaking !== speaking) {
          speaking = currentlySpeaking;
          onSpeaking(speaking);
        }
        requestAnimationFrame(checkSpeaking);
      };
      
      checkSpeaking();

      return () => {
        audioContext.close();
      };
    }
  }, [stream, onSpeaking]);

  return <audio ref={audioRef} autoPlay muted={muted} className="hidden" />;
};

export default RoomPage;
