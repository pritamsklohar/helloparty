import React from 'react';

const TOTAL_EMOJIS = 50;
const COLS = 10;
const TILE_SIZE = 24; // smaller size for in-text
const ORIGINAL_TILE_SIZE = 256;
const PADDING = 6;
const SCALE = TILE_SIZE / ORIGINAL_TILE_SIZE;
const bgWidth = (COLS * ORIGINAL_TILE_SIZE + 11 * PADDING) * SCALE;

const renderEmoji = (index) => {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = (col * 262 + 6) * SCALE;
  const y = (row * 262 + 6) * SCALE;

  return (
    <span
      key={`emoji-${index}-${Math.random()}`}
      className="inline-block align-middle mx-0.5"
      style={{
        width: `${TILE_SIZE}px`,
        height: `${TILE_SIZE}px`,
        backgroundImage: `url('/emojis/emojis_spritesheet_256px.png')`,
        backgroundSize: `${bgWidth}px auto`,
        backgroundPosition: `-${x}px -${y}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

const MessageText = ({ text }) => {
  if (!text) return null;
  
  // Split by [emoji:X] regex
  const parts = text.split(/(\[emoji:\d+\])/g);
  
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[emoji:(\d+)\]$/);
        if (match) {
          const index = parseInt(match[1], 10);
          if (index >= 0 && index < TOTAL_EMOJIS) {
            return renderEmoji(index);
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export default MessageText;
