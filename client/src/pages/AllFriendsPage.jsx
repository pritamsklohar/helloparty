import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiSearch, FiUserPlus, FiUsers, FiMessageCircle, FiX } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const AllFriendsPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [searchUserId, setSearchUserId] = useState('');
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        setLoading(true);
        const res = await api.get('/users/friends/all');
        setFriends(res.data.friends);
      } catch (err) {
        toast.error('Failed to load friends');
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg relative">
      {/* Header */}
      <header className="flex items-center px-4 py-4 bg-surfaceAlt/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors active:scale-95 mr-2"
        >
          <FiChevronLeft className="text-3xl" />
        </button>
        <h1 className="text-xl font-bold text-white tracking-wide">All Friends</h1>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FiSearch className="text-white/50 text-lg" />
          </div>
          <input
            type="text"
            placeholder="Search friend"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surfaceAlt/50 border border-white/10 text-white rounded-full py-3 pl-11 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/40 shadow-inner"
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="flex justify-center items-center h-[50vh]">
              <div className="w-8 h-8 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : friends.length > 0 ? (
            <div className="space-y-3 mt-2">
              {friends.filter(f => f.username.toLowerCase().includes(searchQuery.toLowerCase())).map(friend => (
                <div 
                  key={friend._id} 
                  onClick={() => navigate(`/user/${friend.uid}`)}
                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-surfaceAlt/50 transition-colors cursor-pointer border border-transparent hover:border-border group"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-surface flex-shrink-0 border-2 border-transparent group-hover:border-primary/50 transition-colors">
                    <img src={friend.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`} alt={friend.username} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold truncate text-base group-hover:text-primary transition-colors">{friend.username}</h3>
                    <p className="text-sm text-white/40 truncate mt-0.5">UID: {friend.uid}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/chat/${friend.uid}`);
                    }}
                    className="w-10 h-10 flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
                  >
                    <FiMessageCircle className="text-xl" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center mt-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-surfaceAlt to-surface flex items-center justify-center mb-6 shadow-xl border border-white/5 relative"
              >
                <FiUsers className="text-4xl text-primary opacity-80" />
              </motion.div>
              
              <h2 className="text-2xl font-black text-white mb-2">No friends yet</h2>
              <p className="text-white/50 mb-8 max-w-[280px] text-sm leading-relaxed">
                Your friend list is empty. Add some friends to start chatting and playing together!
              </p>
              
              <button 
                onClick={() => setShowAddFriendModal(true)}
                className="bg-gradient-to-r from-primary to-primaryHover text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 active:scale-95 transition-all flex items-center gap-3"
              >
                <FiUserPlus className="text-xl" />
                Add New Friend
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

export default AllFriendsPage;
