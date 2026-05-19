import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiSend, FiUsers, FiInfo, FiMoreVertical, FiLogOut, FiTrash2, FiBellOff, FiImage, FiSmile, FiMessageCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import { socket } from '../services/socket';
import EmojiPicker from '../components/chat/EmojiPicker';
import MessageText from '../components/chat/MessageText';

const GroupChatPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [inputText, setInputText] = useState('');
  const [showInputOverlay, setShowInputOverlay] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { 
    messagesCache, 
    loadingMessages, 
    fetchGroupHistory,
    groupsCache,
    loadingGroups,
    fetchGroupDetail,
    mutedChatIds,
    toggleMuteChat
  } = useChatStore();

  const group = groupsCache[id] || null;
  const messages = messagesCache[id] || [];

  useEffect(() => {
    if (id) {
      const cachedGroup = groupsCache[id];
      fetchGroupDetail(id, !!cachedGroup).catch(() => {
        toast.error('Group not found');
        navigate('/chat');
      });

      const cachedMsgs = messagesCache[id] || [];
      fetchGroupHistory(id, cachedMsgs.length > 0);
    }
  }, [id, navigate, fetchGroupDetail, fetchGroupHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user?._id) return;

    socket.emit('send_group_message', {
      groupId: id,
      senderId: user._id,
      text: inputText
    });

    setInputText('');
  };

  const [showMenu, setShowMenu] = useState(false);
  const isOwner = group?.creator?._id === user?._id || group?.creator === user?._id;

  const handleDismissGroup = async () => {
    if (!window.confirm('Dismiss this group? This will delete it for everyone.')) return;
    try {
      await api.delete(`/groups/${id}`);
      toast.success('Group dismissed');
      navigate('/chat');
    } catch (err) {
      toast.error('Failed to dismiss group');
    }
  };

  if (!group || (loadingMessages[id] && messages.length === 0)) return (
    <div className="flex h-screen bg-bg items-center justify-center">
       <div className="w-10 h-10 border-4 border-white/10 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-bg text-white overflow-hidden">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between bg-surfaceAlt/20 border-b border-white/5 backdrop-blur-xl relative z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white bg-white/5 rounded-full hover:bg-white/10 transition-all">
            <FiChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-3" onClick={() => navigate(`/groups/${id}/info`)}>
             <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-lg cursor-pointer">
                <img src={group?.avatarUrl} className="w-full h-full object-cover" alt="" />
             </div>
             <div className="cursor-pointer">
                <h2 className="font-bold text-sm tracking-tight">{group?.name}</h2>
                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest flex items-center gap-1">
                   <FiUsers size={10} className="text-primary" /> {group?.members?.length} Members
                </p>
             </div>
          </div>
        </div>
        
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <FiMoreVertical size={20} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-2 z-[70]"
                >
                  <button 
                    onClick={() => {
                      setShowMenu(false);
                      navigate(`/groups/${id}/info`);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/90 hover:bg-white/5 rounded-xl transition-colors text-left"
                  >
                    <FiInfo size={18} className="text-primary" /> View Group
                  </button>
                  <button 
                    onClick={() => {
                      toggleMuteChat(id);
                      setShowMenu(false);
                      if (mutedChatIds.includes(id)) {
                        toast.success('Group unmuted');
                      } else {
                        toast.success('Group muted');
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/90 hover:bg-white/5 rounded-xl transition-colors text-left"
                  >
                    <FiBellOff size={18} className={mutedChatIds.includes(id) ? 'text-white/40' : 'text-yellow-400'} />
                    {mutedChatIds.includes(id) ? 'Unmute Group' : 'Mute Group'}
                  </button>
                  {isOwner && (
                    <button 
                      onClick={handleDismissGroup}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                    >
                      <FiTrash2 size={18} /> Dismiss Group
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
         {messages.map((msg, i) => {
           const isMine = msg.sender?._id === user?._id || msg.sender === user?._id;
           return (
             <motion.div 
               key={msg._id || i}
               initial={{ opacity: 0, x: isMine ? 20 : -20 }}
               animate={{ opacity: 1, x: 0 }}
               className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2`}
             >
               {!isMine && (
                 <div className="w-8 h-8 rounded-xl overflow-hidden bg-surfaceAlt flex-shrink-0 border border-white/5 shadow-md">
                    <img src={msg.sender?.avatarUrl} className="w-full h-full object-cover" alt="" />
                 </div>
               )}
               <div className={`max-w-[75%] space-y-1.5 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMine && <span className="text-[9px] font-black text-white/20 uppercase tracking-widest ml-1">{msg.sender?.username}</span>}
                  <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-xl ${
                    isMine 
                      ? 'bg-gradient-to-br from-primary to-primaryHover text-white rounded-br-none shadow-primary/20' 
                      : 'bg-surfaceAlt/40 text-white/90 rounded-bl-none border border-white/5'
                  }`}>
                    <MessageText text={msg.text} />
                  </div>
                  <span className="text-[7px] text-white/10 uppercase font-black tracking-[0.2em] px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
               </div>
             </motion.div>
           );
         })}
         <div ref={messagesEndRef} />
      </main>

      {/* Input Bar (Button Mode) */}
      {!showInputOverlay && (
        <div className="p-4 bg-transparent pb-8 md:pb-4">
          <button 
            type="button" 
            onClick={() => setShowInputOverlay(true)}
            className="w-full bg-surfaceAlt/20 border border-white/5 text-white/50 rounded-3xl py-4 px-6 text-left text-sm flex items-center gap-3 shadow-lg"
          >
            <FiMessageCircle className="text-xl" />
            {inputText ? inputText : "Type something to the squad..."}
          </button>
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
              <form onSubmit={(e) => { handleSendMessage(e); setShowInputOverlay(false); setShowEmojiPicker(false); }} className="flex items-center gap-3 max-w-4xl mx-auto w-full relative z-10">
                <button type="button" className="w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors active:scale-90 flex-shrink-0">
                  <FiImage className="text-2xl" />
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (!showEmojiPicker && document.activeElement) {
                      document.activeElement.blur();
                    } else if (showEmojiPicker) {
                      inputRef.current?.focus();
                    }
                    setShowEmojiPicker(!showEmojiPicker);
                  }} 
                  className={`w-10 h-10 flex items-center justify-center transition-colors active:scale-90 flex-shrink-0 ${showEmojiPicker ? 'text-primary' : 'text-white/60 hover:text-white'}`}
                >
                  <FiSmile className="text-2xl" />
                </button>
                
                <div className="flex-1 relative">
                  <input 
                    ref={inputRef}
                    autoFocus
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type something to the squad..."
                    className="w-full bg-surface border border-white/10 text-white rounded-2xl py-3 px-4 focus:outline-none focus:border-primary transition-all placeholder:text-white/20 text-sm shadow-inner"
                  />
                </div>

                <motion.button 
                  type="submit"
                  disabled={!inputText.trim()}
                  className={`w-10 h-10 flex items-center justify-center rounded-full shadow-lg transition-all flex-shrink-0 ml-1 ${inputText.trim() ? 'bg-primary text-white active:scale-90 shadow-primary/30' : 'bg-white/10 text-white/30'}`}
                >
                  <FiSend className="text-xl" />
                </motion.button>
              </form>
              <EmojiPicker 
                isOpen={showEmojiPicker} 
                onClose={() => {
                  setShowEmojiPicker(false);
                  inputRef.current?.focus();
                }} 
                onSelect={(emoji) => setInputText(prev => prev + emoji)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroupChatPage;
