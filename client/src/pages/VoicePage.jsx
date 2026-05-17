import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiPlus, FiX, FiLock, FiUnlock, FiVideo, FiMic } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import { socket } from '../services/socket';

const VoicePage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');
  const category = 'voice'; // 'voice' only for now
  const [isLoading, setIsLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [fetchingRooms, setFetchingRooms] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');

  const fetchRooms = async () => {
    setFetchingRooms(true);
    try {
      const res = await api.get('/rooms');
      setRooms(res.data);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setFetchingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();

    const handleRoomCreated = (newRoom) => {
      setRooms(prev => {
        if (prev.some(r => r._id === newRoom._id)) return prev;
        return [newRoom, ...prev];
      });
    };

    const handleRoomDeleted = (roomId) => {
      setRooms(prev => prev.filter(r => r._id !== roomId));
    };

    const handleRoomCountUpdated = ({ roomId, activeMembersCount }) => {
      setRooms(prev => prev.map(room => {
        if (room._id === roomId) {
          return {
            ...room,
            members: Array(activeMembersCount).fill(null)
          };
        }
        return room;
      }));
    };

    socket.on('room_created', handleRoomCreated);
    socket.on('room_deleted', handleRoomDeleted);
    socket.on('room_count_updated', handleRoomCountUpdated);

    return () => {
      socket.off('room_created', handleRoomCreated);
      socket.off('room_deleted', handleRoomDeleted);
      socket.off('room_count_updated', handleRoomCountUpdated);
    };
  }, []);

  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.host?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    if (localStorage.getItem('inRoom') === 'true') {
      toast.error("Already in Room");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await api.post('/rooms', {
        name: roomName.trim(),
        category,
        isPrivate: hasPassword,
        password: hasPassword ? password : ''
      });
      setIsModalOpen(false);
      navigate(`/room/${res.data._id}`);
    } catch (error) {
      console.error('Failed to create room:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-bg relative">
      {/* Transparent Header */}
      <header className="absolute top-0 left-0 right-0 z-40 px-4 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex-1 max-w-md relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-lg drop-shadow-md z-10" />
          <input 
            type="text" 
            placeholder="Search by room name or host..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full py-2.5 pl-12 pr-4 focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all text-sm placeholder:text-white/70 shadow-inner"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="ml-4 w-11 h-11 rounded-full bg-primary/90 backdrop-blur-md flex items-center justify-center text-white hover:bg-primaryHover hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/30"
        >
          <FiPlus className="text-2xl" />
        </button>
      </header>

      {/* Main Content Area (Room List) */}
      <main className="flex-1 overflow-y-auto pt-24 pb-24 px-4 scrollbar-hide">
        {fetchingRooms ? (
          <div className="flex flex-col items-center justify-center h-48 opacity-50">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm">Finding active rooms...</p>
          </div>
        ) : filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {filteredRooms.map((room) => (
              <motion.div
                key={room._id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (localStorage.getItem('inRoom') === 'true') {
                    toast.error("Already in Room");
                    return;
                  }
                  navigate(`/room/${room._id}`);
                }}
                className="bg-surfaceAlt/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-surfaceAlt/60 transition-all group relative overflow-hidden"
              >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors" />
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-lg truncate group-hover:text-primary transition-colors">
                      {room.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-white/10">
                        <img 
                          src={room.host?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.host?.username || 'Host'}`} 
                          alt="Host" 
                          className="w-full h-full object-cover bg-surface"
                        />
                      </div>
                      <span className="text-xs text-white/50">by {room.host?.username || 'System'}</span>
                    </div>
                  </div>
                  
                  <div className="bg-black/30 backdrop-blur-sm border border-white/10 px-2 py-1 rounded-lg flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-white/90">{room.members?.length || 0}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-bold tracking-wider uppercase">
                    Voice
                  </span>
                  {room.isPrivate && (
                    <FiLock className="text-white/30 text-xs" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50 py-20">
            <div className="w-24 h-24 rounded-full bg-surfaceAlt flex items-center justify-center mb-6">
              <FiMic className="text-4xl text-white/50" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No active rooms nearby</h2>
            <p className="max-w-xs text-sm">Tap the + button in the top right to start your own voice or video room!</p>
          </div>
        )}
      </main>

      {/* Create Room Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-10"
            >
              <div className="p-5 border-b border-border flex justify-between items-center bg-surfaceAlt/30">
                <h3 className="text-xl font-bold text-white">Create Room</h3>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-surfaceAlt flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                  <FiX className="text-lg" />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="p-6 space-y-6">
                {/* Removed Category Selection */}

                {/* Room Name */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Room Name</label>
                  <input 
                    type="text" 
                    required
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Chill Voice Chat..."
                    className="w-full bg-surfaceAlt border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Password Toggle */}
                <div className="flex items-center justify-between p-3 bg-surfaceAlt rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasPassword ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/40'}`}>
                      {hasPassword ? <FiLock className="text-sm" /> : <FiUnlock className="text-sm" />}
                    </div>
                    <div className="font-bold text-white text-sm">Private Room</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={hasPassword}
                      onChange={() => {
                        setHasPassword(!hasPassword);
                        if(hasPassword) setPassword('');
                      }}
                    />
                    <div className="w-11 h-6 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary border border-border"></div>
                  </label>
                </div>

                {/* Password Field */}
                <AnimatePresence>
                  {hasPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <label className="block text-sm font-medium text-white/70 mb-2">Room Password</label>
                      <input 
                        type="password" 
                        required={hasPassword}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter secret password"
                        className="w-full bg-surfaceAlt border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <button 
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3 rounded-lg font-bold text-base text-white transition-all mt-2 shadow-lg active:scale-[0.98] bg-gradient-to-r from-primary to-primaryHover hover:shadow-primary/30 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Creating...' : 'Create Voice Room'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoicePage;
