import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiCopy, FiMessageSquare, FiUserMinus, FiUserPlus, FiMoreVertical, FiMapPin, FiImage, FiChevronRight } from 'react-icons/fi';
import { FaMars, FaVenus } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';
import { FiEdit2 } from 'react-icons/fi';

const UserProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  
  const usersCache = useChatStore((state) => state.usersCache);
  const fetchUserDetail = useChatStore((state) => state.fetchUserDetail);
  
  const cachedProfile = usersCache[id];
  const [profileData, setProfileData] = useState(cachedProfile || null);
  const [loading, setLoading] = useState(!cachedProfile);
  const [friendStatus, setFriendStatus] = useState(cachedProfile?.friendStatus || 'none');
  const [showOptions, setShowOptions] = useState(false);
  const [latestMemory, setLatestMemory] = useState(null);

  const isOwnProfile = currentUser?._id === profileData?._id || currentUser?.uid === profileData?.uid;

  useEffect(() => {
    if (cachedProfile) {
      setProfileData(cachedProfile);
      setFriendStatus(cachedProfile.friendStatus || 'none');
    }
  }, [cachedProfile]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!cachedProfile) {
          setLoading(true);
        }
        
        const freshProfile = await fetchUserDetail(id, !!cachedProfile);
        setProfileData(freshProfile);
        setFriendStatus(freshProfile.friendStatus || 'none');
        
        try {
          const memRes = await api.get(`/memories/user/${freshProfile._id}`);
          if (memRes.data && memRes.data.length > 0) {
            setLatestMemory(memRes.data[0]);
          }
        } catch (memErr) {
          console.error("No memories found");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        if (!cachedProfile) {
          toast.error("User not found or does not exist!");
          navigate(-1);
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      loadProfile();
    }
  }, [id, cachedProfile, fetchUserDetail, navigate]);

  const handleAddFriend = async () => {
    try {
      await api.post(`/users/send-request/${profileData.uid}`);
      setFriendStatus('sent');
      toast.success('Friend request sent!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async () => {
    try {
      await api.post(`/users/accept-request/${profileData._id}`);
      setFriendStatus('friend');
      toast.success('Friend request accepted!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to accept request');
    }
  };

  const handleRemoveFriend = async () => {
    if (window.confirm('Are you sure you want to remove this friend?')) {
      try {
        await api.post(`/users/remove-friend/${profileData._id}`);
        setFriendStatus('none');
        setShowOptions(false);
        toast.success('Friend removed');
      } catch (error) {
        toast.error('Failed to remove friend');
      }
    }
  };

  const copyId = () => {
    if (profileData) {
      const idToCopy = profileData.uid || profileData._id;
      navigator.clipboard.writeText(idToCopy);
      toast.success('ID copied to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-bg">
        <header className="flex items-center px-4 py-4 bg-transparent sticky top-0 z-50">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors active:scale-95">
            <FiChevronLeft className="text-3xl" />
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!profileData) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg relative">
      <header className="absolute top-0 w-full flex items-center justify-between px-4 py-4 bg-transparent z-50">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center text-white bg-black/30 backdrop-blur-md border border-white/10 hover:bg-black/50 rounded-full transition-colors active:scale-95"
        >
          <FiChevronLeft className="text-2xl" />
        </button>

        {friendStatus === 'friend' && (
          <div className="relative">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="w-10 h-10 flex items-center justify-center text-white bg-black/30 backdrop-blur-md border border-white/10 hover:bg-black/50 rounded-full transition-colors active:scale-95"
            >
              <FiMoreVertical className="text-xl" />
            </button>

            <AnimatePresence>
              {showOptions && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowOptions(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <button 
                      onClick={handleRemoveFriend}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-red-400 hover:bg-white/10 transition-colors text-left"
                    >
                      <FiUserMinus className="text-lg" />
                      Remove Friend
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Cover */}
        <div className="w-full h-48 md:h-56 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        <div className="max-w-3xl mx-auto px-6">
          <div className="flex flex-col items-start relative -mt-16 z-10 text-left">
            {/* Avatar */}
            <div className="relative inline-block mb-4">
              <div className="w-32 h-32 rounded-full border-4 border-bg overflow-hidden bg-surface shadow-2xl">
                <img 
                  src={profileData.avatarUrl} 
                  alt={profileData.username} 
                  className="w-full h-full object-cover" 
                />
              </div>
            </div>

            {/* Info */}
            <h1 className="text-2xl font-bold flex items-center gap-2 mb-1 text-white">
              {profileData.gender === 'male' && <FaMars className="text-[#0984e3]" />}
              {profileData.gender === 'female' && <FaVenus className="text-[#e84393]" />}
              {profileData.username}
              <span className="px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] tracking-wider uppercase font-bold">
                LV {profileData.level || 1}
              </span>
              {isOwnProfile && (
                <button onClick={() => navigate('/edit-profile')} className="p-1.5 hover:text-primary text-white/40 transition-colors">
                  <FiEdit2 size={18} />
                </button>
              )}
            </h1>

            {profileData.country && (
              <div className="flex items-center gap-1.5 text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2">
                <FiMapPin className="text-primary" /> {profileData.country}
              </div>
            )}
            
            <div className="flex items-center gap-2 text-white/40 font-mono text-sm mb-4">
              UID: {profileData.uid}
              <button onClick={copyId} className="hover:text-white transition-colors p-1"><FiCopy size={14} /></button>
            </div>

            {/* Bio Section */}
            <div className="w-full mt-6 space-y-2">
              <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Bio</h3>
              <div className="bg-surfaceAlt/10 rounded-3xl p-5 border border-white/5 backdrop-blur-sm shadow-xl">
                <p className="text-white/70 text-sm leading-relaxed italic">
                  {profileData.bio || "A bit of a mystery... no bio shared yet."}
                </p>
              </div>
            </div>

            {/* Memories Section */}
            <div className="w-full mt-8 pb-10">
              <div 
                onClick={() => navigate(isOwnProfile ? '/memories' : `/memories/user/${profileData._id}`)}
                className="bg-surfaceAlt/30 rounded-[32px] p-5 flex items-center justify-between group cursor-pointer hover:bg-white/[0.05] border border-white/5 transition-all shadow-2xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-surfaceAlt rounded-[22px] overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/10 shadow-inner">
                    {latestMemory?.imageUrls?.length > 0 ? (
                      <img src={latestMemory.imageUrls[0]} className="w-full h-full object-cover" alt="Latest" />
                    ) : (
                      <FiImage className="text-white/10 text-3xl" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white tracking-tight uppercase tracking-widest">Memories</h3>
                    <p className="text-[10px] text-white/30 font-black tracking-[0.15em] uppercase truncate max-w-[150px]">
                      {latestMemory ? (latestMemory.content || 'Shared a vibe') : 'Nothing shared yet'}
                    </p>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary transition-all shadow-lg">
                  <FiChevronRight className="text-white/20 group-hover:text-white transition-colors text-2xl translate-x-0.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Actions - Floating above bottom nav - Only show if NOT own profile */}
      {!isOwnProfile && (
        <div className="fixed bottom-24 left-0 w-full px-6 z-40 flex justify-center pointer-events-none">
          <div className="w-full max-w-sm flex gap-3 pointer-events-auto shadow-2xl rounded-2xl">
            {friendStatus === 'friend' && (
              <button 
                onClick={() => navigate(`/chat/${profileData.uid}`)}
                className="flex-1 py-4 bg-gradient-to-r from-primary to-primaryHover text-white rounded-2xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/40 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
              >
                <FiMessageSquare className="text-lg" />
                Chat
              </button>
            )}
            
            {friendStatus === 'received' && (
              <button 
                onClick={handleAcceptRequest}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold shadow-lg shadow-green-500/30 hover:shadow-green-500/50 active:scale-[0.98] transition-all flex justify-center items-center gap-2 text-lg"
              >
                <FiUserPlus className="text-xl" />
                Accept Request
              </button>
            )}

            {friendStatus === 'sent' && (
              <button 
                disabled
                className="w-full py-4 bg-surfaceAlt text-white/50 border border-white/10 rounded-2xl font-bold transition-all flex justify-center items-center gap-2 text-lg cursor-not-allowed"
              >
                <FiUserPlus className="text-xl" />
                Request Sent
              </button>
            )}

            {friendStatus === 'none' && (
              <button 
                onClick={handleAddFriend}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 active:scale-[0.98] transition-all flex justify-center items-center gap-2 text-lg"
              >
                <FiUserPlus className="text-xl" />
                Add Friend
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;
