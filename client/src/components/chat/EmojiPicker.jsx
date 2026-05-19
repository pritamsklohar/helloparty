import { motion, AnimatePresence } from 'framer-motion';

const EmojiPicker = ({ isOpen, onClose, onSelect }) => {
  const TOTAL_EMOJIS = 50;
  const COLS = 10;
  
  const TILE_SIZE = 48;
  const ORIGINAL_TILE_SIZE = 256;
  const PADDING = 6;
  const SCALE = TILE_SIZE / ORIGINAL_TILE_SIZE;
  
  const bgWidth = (COLS * ORIGINAL_TILE_SIZE + 11 * PADDING) * SCALE;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="absolute bottom-full left-0 w-full bg-[#13131f] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 z-[150] flex flex-col mb-2 overflow-hidden"
          style={{ height: '280px' }}
        >
          {/* Drag Handle */}
          <div className="w-full flex justify-center py-3 cursor-pointer" onClick={onClose}>
            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
          </div>
          
          {/* Emoji Grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 pt-1 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-x-2 gap-y-3 justify-items-center content-start scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {Array.from({ length: TOTAL_EMOJIS }).map((_, i) => {
              const col = i % COLS;
              const row = Math.floor(i / COLS);
              const x = (col * 262 + 6) * SCALE;
              const y = (row * 262 + 6) * SCALE;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onSelect(`[emoji:${i}]`);
                  }}
                  className="w-[48px] h-[48px] rounded-lg hover:bg-white/10 active:scale-90 transition-all flex-shrink-0"
                  style={{
                    backgroundImage: `url('/emojis/emojis_spritesheet_256px.png')`,
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
