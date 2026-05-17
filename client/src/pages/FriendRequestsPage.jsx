import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiChevronLeft, FiCheck, FiX, FiUserPlus } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const FriendRequestsPage = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const res = await api.get('/users/requests/all');
        setRequests(res.data.requests);
      } catch (err) {
        toast.error('Failed to load requests');
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const handleAccept = async (id) => {
    try {
      await api.post(`/users/accept-request/${id}`);
      setRequests(requests.filter(r => r._id !== id));
      toast.success('Friend request accepted!');
    } catch (err) {
      toast.error('Failed to accept request');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/users/reject-request/${id}`);
      setRequests(requests.filter(r => r._id !== id));
      toast.success('Friend request rejected');
    } catch (err) {
      toast.error('Failed to reject request');
    }
  };

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
        <h1 className="text-xl font-bold text-white tracking-wide">Friend Requests</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="flex justify-center items-center h-[50vh]">
              <div className="w-8 h-8 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : requests.length > 0 ? (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req._id} className="flex items-center gap-4 p-3 rounded-2xl bg-surfaceAlt/30 border border-white/5 group">
                  <div 
                    onClick={() => navigate(`/user/${req.uid}`)}
                    className="w-14 h-14 rounded-full overflow-hidden bg-surface flex-shrink-0 cursor-pointer border-2 border-transparent hover:border-primary/50 transition-colors"
                  >
                    <img 
                      src={req.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.username}`} 
                      alt={req.username} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div 
                    onClick={() => navigate(`/user/${req.uid}`)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <h3 className="text-white font-bold truncate text-base group-hover:text-primary transition-colors">{req.username}</h3>
                    <p className="text-sm text-white/40 truncate mt-0.5">UID: {req.uid}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAccept(req._id)}
                      className="w-10 h-10 flex items-center justify-center bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-full transition-colors"
                    >
                      <FiCheck className="text-xl" />
                    </button>
                    <button 
                      onClick={() => handleReject(req._id)}
                      className="w-10 h-10 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full transition-colors"
                    >
                      <FiX className="text-xl" />
                    </button>
                  </div>
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
                <FiUserPlus className="text-4xl text-primary opacity-80" />
              </motion.div>
              <h2 className="text-2xl font-black text-white mb-2">No Requests</h2>
              <p className="text-white/50 text-sm">You have no pending friend requests right now.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FriendRequestsPage;
