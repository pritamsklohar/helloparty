import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiEdit2, FiSettings, FiCheckCircle, FiCopy, FiUser, FiImage, FiBarChart2, FiEye, FiUserPlus, FiGlobe, FiHelpCircle, FiChevronRight } from 'react-icons/fi';
import { FaCoins, FaGamepad, FaTrophy, FaUsers, FaArrowRight } from 'react-icons/fa';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import Navbar from '../components/layout/Navbar';
import api from '../services/api';

const ProfilePage = () => {
  const { user } = useAuthStore();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We already have some user data from store, but let's fetch full profile
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me');
        setProfileData(res.data.user);
      } catch (err) {
        toast.error(`Error: ${err.response?.data?.message || err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const copyId = () => {
    if (profileData) {
      const idToCopy = profileData.uid || profileData._id;
      navigator.clipboard.writeText(idToCopy);
      toast.success('ID copied to clipboard');
    }
  };

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
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-20">
        {/* Cover */}
        <div className="w-full h-48 md:h-64 bg-gradient-to-r from-primary to-accent opacity-90 relative">
          <div className="absolute inset-0 bg-black/20"></div>
          
          {/* Top Right Icons */}
          <div className="absolute top-4 right-4 flex gap-2 z-20">
            <button className="w-9 h-9 bg-black/30 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors">
              <FiEdit2 size={18} />
            </button>
            <button className="w-9 h-9 bg-black/30 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors">
              <FiSettings size={18} />
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row gap-6 relative -mt-16 md:-mt-20 z-10">
            {/* Avatar Column */}
            <div className="flex-shrink-0">
              <div className="relative inline-block">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-bg overflow-hidden bg-surface shadow-2xl">
                  <img 
                    src={profileData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileData.username}`} 
                    alt={profileData.username} 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <button className="absolute bottom-2 right-2 w-8 h-8 md:w-10 md:h-10 bg-surfaceAlt border-2 border-bg rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-primary transition-colors">
                  <FiEdit2 size={14} />
                </button>
              </div>
            </div>

            {/* Info Column */}
            <div className="flex-1 sm:pt-20 pb-8">
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                    {profileData.username}
                    <span className="px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] tracking-wider uppercase">
                      LV {profileData.level || 1}
                    </span>
                  </h1>
                  <div className="flex items-center gap-2 text-white/40 mt-1 font-mono text-xs">
                    UID: {profileData.uid || profileData._id}
                    <button onClick={copyId} className="hover:text-white transition-colors"><FiCopy /></button>
                  </div>
                </div>
                
                
                <div className="flex gap-3 mt-2 md:mt-0">
                  {/* Buttons moved to top right */}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 mt-8 pb-10">
            {[
              { icon: <FiImage />, label: 'Moment', color: 'text-[#ff4757]' },
              { icon: <FiBarChart2 />, label: 'Stats', color: 'text-[#2e86de]' },
              { icon: <FiEye />, label: 'Viewers', color: 'text-[#8e44ad]' },
              { icon: <FiUserPlus />, label: 'Invite Friends', color: 'text-[#27ae60]' },
              { icon: <FiGlobe />, label: 'Language', color: 'text-[#f1c40f]' },
              { icon: <FiHelpCircle />, label: 'Help Center', color: 'text-[#e67e22]' },
              { icon: <FiSettings />, label: 'Setting', color: 'text-[#95a5a6]' },
            ].map((item, index) => (
              <motion.div 
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 bg-surfaceAlt/40 hover:bg-surfaceAlt/60 border border-white/5 rounded-2xl cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-surfaceAlt flex items-center justify-center text-xl ${item.color}`}>
                    {item.icon}
                  </div>
                  <span className="font-semibold text-white/90">{item.label}</span>
                </div>
                <FiChevronRight className="text-white/20 group-hover:text-white/50 transition-colors" />
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
