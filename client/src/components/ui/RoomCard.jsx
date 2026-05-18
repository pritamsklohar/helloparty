import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUsers, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { useVoiceRoom } from '../../context/VoiceRoomContext';

const RoomCard = ({ room }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { joinRoom } = useVoiceRoom();

  const handleJoin = (e) => {
    e.preventDefault();
    if (user?.inRoom) {
      toast.error("Already in Room");
      return;
    }
    // Normalize properties for home page room cards
    const normalizedRoom = {
      ...room,
      _id: room.id || room._id,
      name: room.name || room.title
    };
    joinRoom(normalizedRoom);
    navigate(`/room/${room.id}`);
  };

  const getGameBadgeColor = (type) => {
    switch(type) {
      case 'VOICE': return 'bg-primary/20 text-primary border-primary/30';
      case 'WEREWOLF': return 'bg-secondary/20 text-secondary border-secondary/30';
      case 'SPY': return 'bg-success/20 text-success border-success/30';
      case 'DRAW_GUESS': return 'bg-accent/20 text-accent border-accent/30';
      default: return 'bg-white/10 text-white/80 border-white/20';
    }
  };

  const formatGameType = (type) => {
    if (!type) return 'VOICE';
    return type.replace('_', ' & ');
  };

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div 
        onClick={handleJoin}
        className="block cursor-pointer bg-surface/60 backdrop-blur-sm border border-border hover:border-primary/50 rounded-2xl p-5 relative overflow-hidden group shadow-lg hover:shadow-primary/20 transition-all h-full"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <div className="flex justify-between items-start mb-4">
          <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider border ${getGameBadgeColor(room.gameType || room.type)}`}>
            {formatGameType(room.gameType || room.type)}
          </div>
          
          <div className="flex items-center gap-2">
            {room.isPrivate && <FiLock className="text-white/40 text-sm" />}
            <div className="flex items-center gap-1.5 bg-surfaceAlt px-2 py-1 rounded-md border border-border">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
              </span>
              <span className="text-xs font-medium text-white/80">LIVE</span>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-white mb-1 truncate group-hover:text-primary transition-colors">{room.name}</h3>
        
        <div className="flex items-center gap-3 mt-5">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 overflow-hidden border-2 border-surfaceAlt z-10 relative">
              <img src={room.host.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.host.username}`} alt={room.host.username} className="w-full h-full object-cover" />
            </div>
            {room.membersCount > 1 && (
              <div className="w-8 h-8 rounded-full bg-surfaceAlt border-2 border-surface absolute -right-4 -bottom-1 flex items-center justify-center text-xs font-bold text-white/70 z-0">
                +{room.membersCount - 1}
              </div>
            )}
          </div>
          
          <div className="ml-4 flex-1">
            <div className="text-sm font-medium text-white/90 truncate">{room.host.username}</div>
            <div className="flex items-center gap-1.5 text-xs text-white/50 mt-0.5">
              <FiUsers />
              <span>{room.membersCount} / {room.maxMembers}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RoomCard;
