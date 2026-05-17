import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiSend, FiUsers, FiInfo, FiMoreVertical, FiLogOut, FiTrash2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import { socket } from '../services/socket';

const GroupChatPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [group, setGroup] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loadingGroup, setLoadingGroup] = useState(true);
  const messagesEndRef = useRef();

  const { messagesCache, loadingMessages, fetchGroupHistory } = useChatStore();
  const messages = messagesCache[id] || [];

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        setLoadingGroup(true);
        const res = await api.get(`/groups/${id}`);
        setGroup(res.data);
      } catch (err) {
        toast.error('Group not found');
        navigate('/chat');
      } finally {
        setLoadingGroup(false);
      }
    };

    if (id) {
      fetchGroup();
      const cached = messagesCache[id] || [];
      fetchGroupHistory(id, cached.length > 0);
    }
  }, [id, navigate, fetchGroupHistory]);

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

  if (loadingGroup || (loadingMessages[id] && messages.length === 0)) return (
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
                      setShowMenu(false);
                      toast('Muting coming soon!');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/90 hover:bg-white/5 rounded-xl transition-colors text-left"
                  >
                    <FiLogOut size={18} className="text-accent rotate-180" /> Mute Group
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
                    {msg.text}
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

      {/* Input */}
      <footer className="p-4 bg-transparent">
        <form onSubmit={handleSendMessage} className="relative flex items-center gap-3">
           <div className="flex-1 relative">
             <input 
              type="text"
              placeholder="Type something to the squad..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-surfaceAlt/20 border border-white/5 rounded-3xl py-4.5 pl-6 pr-12 text-sm focus:outline-none focus:border-primary/40 focus:bg-surfaceAlt/30 transition-all placeholder:text-white/10"
             />
           </div>
           <button 
            type="submit"
            className="w-14 h-14 bg-primary text-white rounded-[22px] flex items-center justify-center shadow-xl shadow-primary/20 active:scale-90 transition-all hover:bg-primaryHover"
           >
             <FiSend size={22} className="rotate-[-10deg]" />
           </button>
        </form>
      </footer>
    </div>
  );
};

export default GroupChatPage;
