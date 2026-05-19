import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiChevronLeft } from 'react-icons/fi';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const GiftWallPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('giftWall'); // 'giftWall' or 'received'

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (userId === currentUser?._id || userId === currentUser?.uid) {
          const res = await api.get('/auth/me');
          setProfileData(res.data.user);
        } else if (userId) {
          const res = await api.get(`/users/${userId}`);
          setProfileData(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId, currentUser]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!profileData) return null;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-bg">
      {/* Header */}
      <div className="flex items-center px-4 h-16 border-b border-white/5 bg-surfaceAlt/30 backdrop-blur-md sticky top-0 z-20">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white transition-colors active:scale-95"
        >
          <FiChevronLeft className="text-3xl" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-white ml-2">Gift Wall</h1>
      </div>

      <main className="flex-1 overflow-y-auto pb-20">
        {/* User Info Section */}
        <div className="p-6 flex items-center gap-4 bg-surfaceAlt/10">
          <div className="w-20 h-20 rounded-full border-2 border-white/10 overflow-hidden bg-surface shadow-lg flex-shrink-0">
            <img 
              src={profileData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileData.username}`} 
              alt={profileData.username} 
              className="w-full h-full object-cover" 
            />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{profileData.username}</h2>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-2 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('giftWall')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'giftWall' ? 'text-primary' : 'text-white/40 hover:text-white/60'}`}
          >
            Gift Wall
            {activeTab === 'giftWall' && (
              <motion.div layoutId="giftTabIndicator" className="absolute bottom-0 left-10 right-10 h-1 bg-primary rounded-t-full" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('received')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'received' ? 'text-primary' : 'text-white/40 hover:text-white/60'}`}
          >
            Received
            {activeTab === 'received' && (
              <motion.div layoutId="giftTabIndicator" className="absolute bottom-0 left-10 right-10 h-1 bg-primary rounded-t-full" />
            )}
          </button>
        </div>

        {/* Content Placeholder */}
        <div className="p-6">
          <div className="bg-surfaceAlt/20 rounded-3xl p-8 flex flex-col items-center justify-center text-center border border-white/5 shadow-inner mt-4 min-h-[200px]">
            <p className="text-white/40 font-medium tracking-wide">
              No gifts for now
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GiftWallPage;
