import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiMoreVertical, FiSmile, FiGift, FiPlus, FiSend, FiUser, FiBellOff, FiSlash, FiTrash2, FiMessageCircle, FiImage, FiCamera } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

import useChatStore from '../store/chatStore';
import useAuthStore from '../store/authStore';
import { socket } from '../services/socket';
import EmojiPicker from '../components/chat/EmojiPicker';
import MessageText from '../components/chat/MessageText';

const ChatRoomPage = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [message, setMessage] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showPlusOptions, setShowPlusOptions] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, show: false, messageId: null });
  const [showInputOverlay, setShowInputOverlay] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const longPressTimer = useRef(null);
  const messagesEndRef = useRef(null);

  const { 
    messagesCache, 
    loadingMessages, 
    fetchPrivateHistory, 
    clearUnreadCount,
    usersCache,
    loadingUsers,
    fetchUserDetail,
    mutedChatIds,
    toggleMuteChat
  } = useChatStore();

  const user = usersCache[uid] || null;
  const messages = user ? (messagesCache[user._id] || []) : [];

  useEffect(() => {
    if (uid) {
      const cachedProfile = usersCache[uid];
      fetchUserDetail(uid, !!cachedProfile).catch(() => {
        toast.error('User not found');
        navigate('/chat');
      });
    }
  }, [uid, navigate, fetchUserDetail]);

  useEffect(() => {
    if (user) {
      const handleStatusChange = (data) => {
        if (data.userId === user._id) {
          setIsOnline(data.status === 'online');
        }
      };

      const handleStatusRes = (data) => {
        if (data.userId === user._id) {
          setIsOnline(data.isOnline);
        }
      };

      const handleTypingStatus = (data) => {
        if (data.userId === user._id) {
          setIsOtherTyping(data.isTyping);
        }
      };

      const handleMessagesSeen = (data) => {
        if (data.seenBy === user._id) {
          // Mark all cached messages in this conversation as read
          const userMessages = useChatStore.getState().messagesCache[user._id] || [];
          const updated = userMessages.map(m => ({ ...m, isRead: true }));
          useChatStore.setState(state => ({
            messagesCache: { ...state.messagesCache, [user._id]: updated }
          }));
        }
      };

      socket.on('user_status_change', handleStatusChange);
      socket.on('user_status_res', handleStatusRes);
      socket.on('user_typing_status', handleTypingStatus);
      socket.on('messages_seen', handleMessagesSeen);

      const checkStatus = () => {
        socket.emit('check_online_status', user._id);
      };

      // Emit check immediately if connected, otherwise wait for connection
      if (socket.connected) {
        checkStatus();
      } else {
        socket.on('connect', checkStatus);
      }

      return () => {
        socket.off('user_status_change', handleStatusChange);
        socket.off('user_status_res', handleStatusRes);
        socket.off('user_typing_status', handleTypingStatus);
        socket.off('messages_seen', handleMessagesSeen);
        socket.off('connect', checkStatus);
      };
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const cachedList = messagesCache[user._id] || [];
      // Fetch in background silently if we already have messages cached
      fetchPrivateHistory(user._id, cachedList.length > 0);
      
      // Clear unread count locally and mark as read on server
      clearUnreadCount(user._id);
      if (currentUser) {
        socket.emit('mark_as_read', { senderId: user._id, receiverId: currentUser._id });
      }
    }
  }, [user, currentUser, fetchPrivateHistory, clearUnreadCount]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleContextMenu = (e, messageId, senderId) => {
    e.preventDefault();
    if (senderId !== currentUser?._id) return;

    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      show: true,
      messageId
    });
  };

  const handleTouchStart = (e, messageId, senderId) => {
    if (senderId !== currentUser?._id) return;
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenu({
        x: touch.pageX,
        y: touch.pageY,
        show: true,
        messageId
      });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleUnsend = () => {
    if (contextMenu.messageId) {
      socket.emit('unsend_message', {
        messageId: contextMenu.messageId,
        senderId: currentUser._id,
        receiverId: user._id
      });
      setContextMenu({ ...contextMenu, show: false });
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    if (!currentUser || !user) return;

    // Typing start
    socket.emit('typing_start', { senderId: currentUser._id, receiverId: user._id });

    // Typing stop (timeout)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { senderId: currentUser._id, receiverId: user._id });
    }, 2000);
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!message.trim() || !currentUser || !user) return;

    // Ensure typing stop is emitted
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing_stop', { senderId: currentUser._id, receiverId: user._id });

    const messageData = {
      senderId: currentUser._id,
      receiverId: user._id,
      text: message
    };

    socket.emit('send_private_message', messageData);
    setMessage('');
  };

  if (!user) return (
    <div className="flex h-screen bg-bg items-center justify-center">
      <div className="w-10 h-10 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col h-[100dvh] bg-bg overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 bg-surfaceAlt/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
          >
            <FiChevronLeft className="text-3xl" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-white tracking-wide">{user.username}</h1>
            <span className={`text-[10px] font-medium flex items-center gap-1 ${isOnline ? 'text-green-400' : 'text-white/30'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`}></span>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="relative">
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
          >
            <FiMoreVertical className="text-2xl" />
          </button>

          <AnimatePresence>
            {showOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="py-2 px-1 flex flex-col">
                    <button onClick={() => { setShowOptions(false); navigate(`/user/${user.uid}`); }} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left">
                      <FiUser className="text-lg text-primary" /> View Profile
                    </button>
                    <button 
                      onClick={() => {
                        toggleMuteChat(user._id);
                        setShowOptions(false);
                        if (mutedChatIds.includes(user._id)) {
                          toast.success('Chat unmuted');
                        } else {
                          toast.success('Chat muted');
                        }
                      }} 
                      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left"
                    >
                      <FiBellOff className={`text-lg ${mutedChatIds.includes(user._id) ? 'text-white/40' : 'text-yellow-400'}`} />
                      {mutedChatIds.includes(user._id) ? 'Unmute Chat' : 'Mute Chat'}
                    </button>
                    <button onClick={() => setShowOptions(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-white/10 rounded-xl transition-colors text-left">
                      <FiSlash className="text-lg" /> Block User
                    </button>
                    <div className="h-[1px] bg-white/10 my-1 mx-3" />
                    <button onClick={() => { 
                      useChatStore.setState(state => ({
                        messagesCache: { ...state.messagesCache, [user._id]: [] }
                      }));
                      setShowOptions(false); 
                    }} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-white/10 rounded-xl transition-colors text-left">
                      <FiTrash2 className="text-lg" /> Clear Chat
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>
 
      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        {loadingMessages[user._id] && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20 select-none pointer-events-none">
            <FiMessageCircle size={80} className="mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest text-center">Say hello to {user.username}!</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {messages.map(msg => (
              <motion.div 
                key={msg._id || msg.id || Math.random()}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col max-w-[80%] ${msg.sender === currentUser?._id ? 'self-end' : 'self-start'}`}
                onContextMenu={(e) => handleContextMenu(e, msg._id || msg.id, msg.sender)}
                onTouchStart={(e) => handleTouchStart(e, msg._id || msg.id, msg.sender)}
                onTouchEnd={handleTouchEnd}
              >
                <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg transition-all active:scale-[0.98] ${
                  msg.sender === currentUser?._id 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-surfaceAlt text-white/90 rounded-tl-none border border-white/5'
                }`}>
                  <MessageText text={msg.text} />
                </div>
                <div className="flex items-center justify-end gap-1 mt-1 px-1">
                  <span className={`text-[10px] text-white/30`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.sender === currentUser?._id && (
                    <span className={`text-[10px] font-bold ${msg.isRead ? 'text-primary' : 'text-white/20'}`}>
                      {msg.isRead ? 'seen' : 'sent'}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}

            {isOtherTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="self-start bg-surfaceAlt/50 text-white/40 text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/5"
              >
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce"></span>
                  <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
                {user.username} is typing...
              </motion.div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Bar (Button Mode) */}
      {!showInputOverlay && (
        <div className="p-4 bg-surfaceAlt/50 backdrop-blur-xl border-t border-white/5 pb-8 md:pb-4">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <button type="button" className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors active:scale-90 flex-shrink-0">
              <FiSmile className="text-2xl" />
            </button>
            
            <div className="flex-1 relative">
              <button 
                type="button" 
                onClick={() => setShowInputOverlay(true)}
                className="w-full bg-surface border border-white/10 text-white/50 rounded-2xl py-3 px-4 text-left text-sm flex items-center gap-2 shadow-inner overflow-hidden whitespace-nowrap"
              >
                {message ? <span className="text-white truncate">{message}</span> : "Type a message..."}
              </button>
            </div>

            <div className="flex items-center gap-1 relative">
              <button type="button" className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors active:scale-90 flex-shrink-0">
                <FiGift className="text-2xl text-accent" />
              </button>
              <button 
                type="button" 
                onClick={() => setShowPlusOptions(!showPlusOptions)}
                className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors active:scale-90 flex-shrink-0"
              >
                <FiPlus className="text-2xl text-primary" />
              </button>

              <AnimatePresence>
                {showPlusOptions && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPlusOptions(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full right-0 mb-2 w-48 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="py-2 px-1 flex flex-col">
                         <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-white/30 font-bold">Options</div>
                         <button onClick={() => setShowPlusOptions(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left">
                           <FiImage className="text-lg text-blue-400" /> Gallery
                         </button>
                         <button onClick={() => setShowPlusOptions(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left">
                           <FiCamera className="text-lg text-purple-400" /> Camera
                         </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* Input Overlay (Active Mode) */}
      <AnimatePresence>
        {showInputOverlay && (
          <>
            <div className="fixed inset-0 z-[110]" onClick={() => { setShowInputOverlay(false); setShowEmojiPicker(false); }} />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 w-full bg-surfaceAlt border-t border-white/10 p-3 z-[120] flex flex-col shadow-2xl pb-6 md:pb-4"
            >
              <EmojiPicker 
                isOpen={showEmojiPicker} 
                onClose={() => setShowEmojiPicker(false)} 
                onSelect={(emoji) => setMessage(prev => prev + emoji)}
              />
              <form onSubmit={(e) => { handleSendMessage(e); setShowInputOverlay(false); setShowEmojiPicker(false); }} className="flex items-center gap-3 max-w-4xl mx-auto w-full relative">
                <button type="button" className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors active:scale-90 flex-shrink-0">
                  <FiImage className="text-2xl" />
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (!showEmojiPicker && document.activeElement) {
                      document.activeElement.blur();
                    }
                    setShowEmojiPicker(!showEmojiPicker);
                  }} 
                  className={`w-10 h-10 flex items-center justify-center transition-colors active:scale-90 flex-shrink-0 ${showEmojiPicker ? 'text-primary' : 'text-white/60 hover:text-white'}`}
                >
                  <FiSmile className="text-2xl" />
                </button>
                
                <div className="flex-1 relative">
                  <input 
                    autoFocus
                    type="text" 
                    value={message}
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    className="w-full bg-surface border border-white/10 text-white rounded-2xl py-3 px-4 focus:outline-none focus:border-primary transition-all placeholder:text-white/20 text-sm shadow-inner"
                  />
                </div>

                <motion.button 
                  type="submit"
                  disabled={!message.trim()}
                  className={`w-10 h-10 flex items-center justify-center rounded-full shadow-lg transition-all flex-shrink-0 ml-1 ${message.trim() ? 'bg-primary text-white active:scale-90 shadow-primary/30' : 'bg-white/10 text-white/30'}`}
                >
                  <FiSend className="text-xl" />
                </motion.button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Message Context Menu */}
      <AnimatePresence>
        {contextMenu.show && (
          <>
            <div 
              className="fixed inset-0 z-[100]"
              onClick={() => setContextMenu({ ...contextMenu, show: false })}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ ...contextMenu, show: false }); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[101] min-w-[120px] bg-surfaceAlt/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1"
              style={{ 
                left: Math.min(contextMenu.x, window.innerWidth - 130), 
                top: Math.min(contextMenu.y, window.innerHeight - 60) 
              }}
            >
              <button 
                onClick={handleUnsend}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-400/10 transition-colors text-left"
              >
                <FiTrash2 className="text-base" />
                Unsend
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatRoomPage;
