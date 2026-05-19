import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft } from 'react-icons/fi';

const EmojiPicker = ({ isOpen, onClose, onSelect }) => {
  const [category, setCategory] = useState('emoji');
  
  const TOTAL_EMOJIS = 50;
  const COLS = 10;
  
  const TILE_SIZE = 48;
  const ORIGINAL_TILE_SIZE = 256;
  const PADDING = 6;
  const SCALE = TILE_SIZE / ORIGINAL_TILE_SIZE;
  
  const bgWidth = (COLS * ORIGINAL_TILE_SIZE + 11 * PADDING) * SCALE;

  const getSpriteSheet = () => {
    switch (category) {
      case 'girl': return '/emojis/girl_emoji_spritesheet_256px.png';
      case 'boy': return '/emojis/boy_emoji_spritesheet_256px.png';
      default: return '/emojis/emojis_spritesheet_256px.png';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full bg-[#13131f] border-t border-white/10 z-[150] flex flex-col overflow-hidden"
          style={{ height: '320px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-3 border-b border-white/5 bg-surfaceAlt/50">
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors active:scale-90 rounded-full hover:bg-white/5"
            >
              <FiArrowLeft className="text-xl" />
            </button>
            <div className="flex bg-black/40 rounded-xl p-1 gap-1">
              {['emoji', 'girl', 'boy'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    category === cat 
                      ? 'bg-primary text-white shadow-lg' 
                      : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
          
          {/* Emoji Grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-x-2 gap-y-3 justify-items-center content-start scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {Array.from({ length: TOTAL_EMOJIS }).map((_, i) => {
              const col = i % COLS;
              const row = Math.floor(i / COLS);
              const x = (col * 262 + 6) * SCALE;
              const y = (row * 262 + 6) * SCALE;

              return (
                <button
                  key={`${category}-${i}`}
                  type="button"
                  onClick={() => onSelect(`[${category}:${i}]`)}
                  className="w-[48px] h-[48px] rounded-lg hover:bg-white/10 active:scale-90 transition-all flex-shrink-0"
                  style={{
                    backgroundImage: `url('${getSpriteSheet()}')`,
                    backgroundSize: `${bgWidth}px auto`,
                    backgroundPosition: `-${x}px -${y}px`,
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmojiPicker;
