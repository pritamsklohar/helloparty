import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiPower } from 'react-icons/fi';
import { useVoiceRoom } from '../context/VoiceRoomContext';

const MinimizedRoom = () => {
  const { activeRoom, closeRoom } = useVoiceRoom();
  const navigate = useNavigate();
  const location = useLocation();
  const constraintsRef = useRef(null);

  // Don't show if no active room or if we're already on the room page
  if (!activeRoom || location.pathname.startsWith('/room/')) {
    return null;
  }

  const handleRestore = () => {
    navigate(`/room/${activeRoom._id}`);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    closeRoom();
  };

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[998]" />
      <AnimatePresence>
        <motion.div
          drag
          dragConstraints={constraintsRef}
          dragElastic={0}
          dragMomentum={false}
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.9 }}
          className="fixed bottom-24 right-4 z-[999] cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
        >
          <div 
            onClick={handleRestore}
            className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-full h-11 flex items-center pl-1.5 pr-0.5 shadow-2xl group min-w-[140px]"
          >
            {/* Left Side: DP */}
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
              <img 
                src={activeRoom.host?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRoom.host?.username || 'Host'}`} 
                alt="Room" 
                className="w-full h-full object-cover"
              />
            </div>

            {/* Middle: Name */}
            <div className="mx-2 overflow-hidden max-w-[80px] flex-1">
              <p className="text-white font-bold text-xs truncate leading-tight">
                {activeRoom.name}
              </p>
            </div>

            {/* Right: Shut Down Icon (Very right side) */}
            <button 
              onClick={handleClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <FiPower className="text-lg" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default MinimizedRoom;
