import React from 'react';

const TOTAL_EMOJIS = 50;
const COLS = 10;
const TILE_SIZE = 24; // smaller size for in-text
const ORIGINAL_TILE_SIZE = 256;
const PADDING = 6;
const SCALE = TILE_SIZE / ORIGINAL_TILE_SIZE;
const bgWidth = (COLS * ORIGINAL_TILE_SIZE + 11 * PADDING) * SCALE;

const getSpriteSheet = (category) => {
  switch (category) {
    case 'girl': return '/emojis/girl_emoji_spritesheet_256px.png';
    case 'boy': return '/emojis/boy_emoji_spritesheet_256px.png';
    default: return '/emojis/emojis_spritesheet_256px.png';
  }
};

const renderEmoji = (category, index) => {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = (col * 262 + 6) * SCALE;
  const y = (row * 262 + 6) * SCALE;

  return (
    <span
      key={`emoji-${category}-${index}-${Math.random()}`}
      className="inline-block align-middle mx-0.5"
      style={{
        width: `${TILE_SIZE}px`,
        height: `${TILE_SIZE}px`,
        backgroundImage: `url('${getSpriteSheet(category)}')`,
        backgroundSize: `${bgWidth}px auto`,
        backgroundPosition: `-${x}px -${y}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

const MessageText = ({ text }) => {
  if (!text) return null;
  
  // Split by [category:X] regex (emoji, girl, boy)
  const parts = text.split(/(\[(?:emoji|girl|boy):\d+\])/g);
  
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(emoji|girl|boy):(\d+)\]$/);
        if (match) {
          const category = match[1];
          const index = parseInt(match[2], 10);
          if (index >= 0 && index < TOTAL_EMOJIS) {
            return renderEmoji(category, index);
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export default MessageText;
