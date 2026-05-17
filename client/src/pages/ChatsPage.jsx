import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiPlus, FiUserPlus, FiUsers, FiList, FiMessageSquare, FiX } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import useChatStore from '../store/chatStore';
import useAuthStore from '../store/authStore';

const ChatsPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [searchUserId, setSearchUserId] = useState('');
  const [requestCount, setRequestCount] = useState(0);

  const { conversations, loadingConversations, fetchConversations } = useChatStore();

  const fetchRequests = async () => {
    try {
      const res = await api.get('/users/requests/all');
      setRequestCount(res.data.requests.length);
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  useEffect(() => {
    // Show spinner only if no conversations exist in cache yet
    const isCacheEmpty = conversations.length === 0;
    fetchConversations(!isCacheEmpty);
    fetchRequests();
  }, [fetchConversations]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg relative">
      <header className="absolute top-0 left-0 w-full z-50 flex items-center justify-between px-4 py-4 bg-transparent backdrop-blur-md border-b border-white/5">
        {/* Search Bar */}
        <div className="flex-1 max-w-sm relative mr-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FiSearch className="text-white/50 text-lg" />
          </div>
          <input
            type="text"
            placeholder="Search chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surfaceAlt/80 border border-white/10 text-white rounded-full py-2.5 pl-11 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/40 shadow-inner"
          />
        </div>

        {/* Plus Icon with Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-11 h-11 rounded-full bg-surfaceAlt/80 flex items-center justify-center text-white hover:bg-white/10 transition-colors border border-white/10 shadow-lg active:scale-95 relative"
          >
            <FiPlus className="text-2xl" />
            {requestCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-surface rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse"></span>
            )}
          </button>

          <AnimatePresence>
            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-[60]"
                  onClick={() => setShowDropdown(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-3 w-56 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[70] overflow-hidden"
                >
                  <div className="py-2 px-1 flex flex-col">
                    <button 
                      onClick={() => {
                        setShowDropdown(false);
                        setShowAddFriendModal(true);
                      }}
                      className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left"
                    >
                      <FiUserPlus className="text-xl text-primary" />
                      Add Friend
                    </button>
                    <button 
                      onClick={() => {
                        setShowDropdown(false);
                        navigate('/groups/create');
                      }}
                      className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left"
                    >
                      <FiUsers className="text-xl text-[#2ecc71]" />
                      Create Group
                    </button>
                    <div className="h-[1px] bg-white/10 my-1 mx-3" />
                    <button 
                      onClick={() => {
                        setShowDropdown(false);
                        navigate('/requests');
                      }}
                      className="flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <FiUserPlus className="text-xl text-[#f1c40f]" />
                        Friend Requests
                      </div>
                      {requestCount > 0 && (
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                      )}
                    </button>
                    <button 
                      onClick={() => {
                        setShowDropdown(false);
                        navigate('/friends');
                      }}
                      className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-white/90 hover:bg-white/10 rounded-xl transition-colors text-left"
                    >
                      <FiList className="text-xl text-[#3498db]" />
                      All Friends List
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content: Chat List */}
      <main className="flex-1 overflow-y-auto pt-24 pb-24 px-4 scroll-smooth">
        <div className="max-w-3xl mx-auto h-full">
          {loadingConversations && conversations.length === 0 ? (
            <div className="flex justify-center items-center h-[50vh]">
              <div className="w-8 h-8 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : conversations.length > 0 ? (
            <div className="space-y-2 mt-4">
              {conversations.filter(chat => chat.username.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
                <div 
                  key={chat._id} 
                  onClick={() => navigate(chat.isGroup ? `/groups/${chat._id}` : `/chat/${chat.uid}`)}
                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-surfaceAlt/50 transition-colors cursor-pointer border border-transparent hover:border-border group"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-surface flex-shrink-0 border-2 border-transparent group-hover:border-primary/50 transition-colors">
                    <img src={chat.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.username}`} alt={chat.username} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className="text-white font-bold truncate text-base group-hover:text-primary transition-colors">{chat.username}</h3>
                      <span className="text-[11px] font-medium text-white/40 flex-shrink-0 ml-2">
                        {new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-sm text-white/60 truncate leading-tight flex-1">{chat.lastMessage}</p>
                      {chat.unreadCount > 0 && (
                        <div className="bg-primary text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 animate-pulse flex-shrink-0">
                          {chat.unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-28 h-28 rounded-full bg-gradient-to-br from-surfaceAlt to-surface flex items-center justify-center mb-6 shadow-2xl border border-white/5 relative"
              >
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 blur-sm"></div>
                <FiMessageSquare className="text-5xl text-primary opacity-90 drop-shadow-lg relative z-10" />
              </motion.div>
              
              <h2 className="text-2xl font-black text-white mb-3 tracking-tight">No Messages Yet</h2>
              <p className="text-white/50 mb-10 max-w-[250px] text-sm leading-relaxed">
                Connect with friends and start your first conversation to see it here.
              </p>
              
              <button 
                onClick={() => navigate('/friends')}
                className="bg-gradient-to-r from-primary to-primaryHover text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all flex items-center gap-3"
              >
                <FiPlus className="text-xl" />
                Start a New Conversation
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Friend Modal */}
      <AnimatePresence>
        {showAddFriendModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowAddFriendModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-surface rounded-3xl overflow-hidden shadow-2xl border border-border flex flex-col"
            >
              <div className="p-5 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white tracking-wide">Add Friend</h2>
                <button 
                  onClick={() => setShowAddFriendModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <FiX className="text-lg" />
                </button>
              </div>
              <div className="px-6 pb-6 pt-2">
                <div className="relative mb-6">
                  <input
                    type="text"
                    value={searchUserId}
                    onChange={(e) => setSearchUserId(e.target.value)}
                    placeholder="UID"
                    className="w-full bg-bg border border-border text-white rounded-xl py-3 px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/30 font-medium text-center tracking-widest"
                  />
                </div>
                <button 
                  onClick={() => {
                    if (searchUserId.trim()) {
                      setShowAddFriendModal(false);
                      navigate(`/user/${searchUserId.trim()}`);
                    }
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-primary to-primaryHover text-white rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                >
                  <FiSearch className="text-lg" />
                  Search User
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatsPage;
