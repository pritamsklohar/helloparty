import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiCamera, FiCheck, FiInfo, FiHash } from 'react-icons/fi';
import { motion } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';

const CreateGroupPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatarUrl: ''
  });

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await api.get('/users/friends/all');
        setFriends(res.data.friends);
      } catch (err) {
        console.error('Failed to load friends');
      }
    };
    fetchFriends();
  }, []);

  const toggleFriend = (id) => {
    setSelectedFriends(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Group name is required');

    setLoading(true);
    try {
      const res = await api.post('/groups', {
        ...formData,
        members: selectedFriends
      });
      toast.success('Group Created!');
      navigate(`/groups/${res.data._id}`);
    } catch (err) {
      toast.error('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-8 bg-transparent border-b border-white/5">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 flex items-center justify-center text-white bg-surfaceAlt/80 rounded-full hover:bg-white/10 transition-colors"
        >
          <FiChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-black tracking-tight uppercase">New Squad</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-10">
        <form onSubmit={handleSubmit} className="space-y-10 max-w-lg mx-auto py-6">
          {/* Avatar Selection Preview */}
          <div className="flex flex-col items-center justify-center space-y-4">
             <motion.div 
               whileHover={{ scale: 1.05 }}
               className="w-32 h-32 rounded-[40px] bg-surfaceAlt border-4 border-white/5 overflow-hidden flex items-center justify-center shadow-2xl relative group"
             >
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <FiCamera className="text-3xl text-white/10" />
                    <span className="text-[8px] font-black text-white/5 uppercase">Upload</span>
                  </div>
                )}
                <input 
                  type="text" 
                  placeholder="Paste URL"
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
             </motion.div>
          </div>

          <div className="space-y-8">
             {/* Name & Bio */}
             <div className="space-y-6 bg-surfaceAlt/10 p-6 rounded-[32px] border border-white/5">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Squad Name</label>
                  <input 
                    type="text"
                    placeholder="E.g. Weekend Vibes"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-surfaceAlt/20 border border-white/5 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:border-primary/40 transition-all placeholder:text-white/10"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    placeholder="Tell them the vibe..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full bg-surfaceAlt/20 border border-white/5 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:border-primary/40 transition-all placeholder:text-white/10 resize-none"
                  />
                </div>
             </div>

             {/* Friend Selection */}
             <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest">Select Squad Members</label>
                  <span className="text-[10px] font-black text-primary uppercase">{selectedFriends.length} Selected</span>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                   {friends.length === 0 ? (
                     <p className="text-xs text-white/20 text-center py-6">No friends found to invite.</p>
                   ) : (
                     friends.map(friend => {
                       const isSelected = selectedFriends.includes(friend._id);
                       return (
                         <div 
                          key={friend._id}
                          onClick={() => toggleFriend(friend._id)}
                          className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
                            isSelected ? 'bg-primary/10 border-primary/30 shadow-lg' : 'bg-surfaceAlt/10 border-white/5 hover:bg-white/5'
                          }`}
                         >
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/5">
                                <img src={friend.avatarUrl} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{friend.username}</span>
                                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">LV {friend.level || 1}</span>
                              </div>
                           </div>
                           <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                             isSelected ? 'bg-primary border-primary' : 'border-white/10'
                           }`}>
                             {isSelected && <FiCheck size={12} className="text-white" />}
                           </div>
                         </div>
                       );
                     })
                   )}
                </div>
             </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-primary text-white font-black rounded-[24px] shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-xs disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FiCheck size={18} />
                Create Squad
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
};

export default CreateGroupPage;
