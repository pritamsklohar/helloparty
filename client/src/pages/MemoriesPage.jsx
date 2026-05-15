import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiChevronLeft, FiPlus, FiImage, FiHeart, FiMessageCircle, FiTrash2, FiX, FiChevronRight, FiRotateCcw } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

const MemoriesPage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user: currentUser } = useAuthStore();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState({ isOpen: false, images: [], index: 0 });

  const isOwnMemories = !userId || userId === currentUser?._id;

  useEffect(() => {
    const fetchMemories = async () => {
      try {
        setLoading(true);
        const endpoint = isOwnMemories ? '/memories/me' : `/memories/user/${userId}`;
        const res = await api.get(endpoint);
        setMemories(res.data);
      } catch (err) {
        console.error('Fetch memories error:', err);
        toast.error('Failed to load memories');
      } finally {
        setLoading(false);
      }
    };
    fetchMemories();
  }, [userId, isOwnMemories]);

  const handleDelete = async (id) => {
    if (!isOwnMemories) return;
    if (window.confirm('Are you sure you want to delete this memory?')) {
      try {
        await api.delete(`/memories/${id}`);
        setMemories(prev => prev.filter(m => m._id !== id));
        toast.success('Memory deleted');
      } catch (err) {
        toast.error('Failed to delete memory');
      }
    }
  };

  const handleLike = async (id) => {
    try {
      const res = await api.post(`/memories/${id}/like`);
      setMemories(prev => prev.map(m => m._id === id ? { ...m, likes: res.data.likes } : m));
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const handleComment = async (id) => {
    const text = prompt('Add a comment:');
    if (!text?.trim()) return;

    try {
      const res = await api.post(`/memories/${id}/comment`, { text });
      setMemories(prev => prev.map(m => m._id === id ? { ...m, comments: res.data.comments } : m));
      toast.success('Comment added');
    } catch (err) {
      toast.error('Failed to comment');
    }
  };

  const handleReply = async (memoryId, commentId) => {
    const text = prompt('Reply to comment:');
    if (!text?.trim()) return;

    try {
      const res = await api.post(`/memories/${memoryId}/comment/${commentId}/reply`, { text });
      setMemories(prev => prev.map(m => m._id === memoryId ? { ...m, comments: res.data.comments } : m));
      toast.success('Reply added');
    } catch (err) {
      toast.error('Failed to reply');
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleString('en-US', { 
      hour: 'numeric', 
      minute: 'numeric', 
      hour12: true,
      day: 'numeric',
      month: 'short'
    });
  };

  const ImageGrid = ({ images }) => {
    if (!images || images.length === 0) return null;
    const count = images.length;
    const isSingle = count === 1;

    return (
      <div className={`grid gap-0.5 bg-black/20 ${isSingle ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {images.slice(0, isSingle ? 1 : 2).map((url, i) => (
          <div 
            key={i} 
            onClick={() => setLightbox({ isOpen: true, images, index: i })}
            className={`relative cursor-pointer overflow-hidden group/img ${isSingle ? 'aspect-video' : 'aspect-square'}`}
          >
            <img src={url} alt="" className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" />
            {i === 1 && count > 2 && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-[2px]">
                <span className="text-2xl font-black text-white">+{count - 1}</span>
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/60">More</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const pageTitle = isOwnMemories ? 'My Memories' : `${memories[0]?.user?.username || 'User'}'s Memories`;

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-bg text-white">
        <header className="flex items-center justify-between px-4 py-6 bg-transparent border-b border-white/5">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white bg-surfaceAlt/80 rounded-full">
            <FiChevronLeft className="text-2xl" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{isOwnMemories ? 'My Memories' : 'Memories'}</h1>
          <div className="w-10" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-white/10 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg text-white selection:bg-primary relative">
      {/* Lightbox */}
      <AnimatePresence>
        {lightbox.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <header className="p-4 flex justify-between items-center text-white z-10">
               <span className="text-xs font-black tracking-widest uppercase bg-white/10 px-3 py-1.5 rounded-full">{lightbox.index + 1} / {lightbox.images.length}</span>
               <button onClick={() => setLightbox({ ...lightbox, isOpen: false })} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full hover:bg-red-500 transition-colors">
                 <FiX size={24} />
               </button>
            </header>
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
               <button 
                onClick={(e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index - 1 + p.images.length) % p.images.length })) }}
                className="absolute left-4 z-10 w-12 h-12 flex items-center justify-center bg-black/50 border border-white/5 rounded-full hover:bg-primary transition-colors"
               >
                 <FiChevronLeft size={32} />
               </button>
               <motion.img 
                key={lightbox.index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src={lightbox.images[lightbox.index]} 
                className="max-w-full max-h-full object-contain shadow-2xl" 
               />
               <button 
                onClick={(e) => { e.stopPropagation(); setLightbox(p => ({ ...p, index: (p.index + 1) % p.images.length })) }}
                className="absolute right-4 z-10 w-12 h-12 flex items-center justify-center bg-black/50 border border-white/5 rounded-full hover:bg-primary transition-colors"
               >
                 <FiChevronRight size={32} />
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-6 bg-transparent border-b border-white/5">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 flex items-center justify-center text-white bg-surfaceAlt/80 rounded-full hover:bg-white/10 transition-colors active:scale-95"
        >
          <FiChevronLeft className="text-2xl" />
        </button>
        <h1 className="text-lg font-bold tracking-tight">{pageTitle}</h1>
        {isOwnMemories ? (
          <button 
            onClick={() => navigate('/memories/create')}
            className="w-10 h-10 flex items-center justify-center text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors active:scale-95"
          >
            <FiPlus className="text-xl" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {memories.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col items-center justify-center text-center space-y-4"
          >
            <div className="w-24 h-24 bg-surfaceAlt/50 rounded-full flex items-center justify-center mb-6 relative">
               <FiImage className="text-4xl text-white/10" />
               {isOwnMemories && (
                 <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white border-4 border-bg">
                   <FiPlus size={14} />
                 </div>
               )}
            </div>
            <h2 className="text-xl font-bold">No Memories</h2>
            <p className="text-white/40 text-sm max-w-xs mt-2">
              {isOwnMemories ? 'Start by sharing your first vibe!' : 'This user hasn\'t shared any memories yet.'}
            </p>
            {isOwnMemories && (
              <button 
                onClick={() => navigate('/memories/create')}
                className="mt-8 px-10 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Create Memory
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-10 pb-20">
            {memories.map((memory, index) => {
              const isLiked = memory.likes?.includes(currentUser?._id);
              return (
                <motion.div 
                  key={memory._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-3"
                >
                  {/* Timestamp outside and above */}
                  <div className="flex items-center gap-3 px-2">
                     <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                       {formatTime(memory.createdAt)}
                     </span>
                  </div>

                  <div className="bg-surfaceAlt/20 rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative group/card">
                    {/* Delete icon - Only if owner */}
                    {isOwnMemories && (
                      <button 
                        onClick={() => handleDelete(memory._id)}
                        className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white/40 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
                      >
                        <FiTrash2 className="text-lg" />
                      </button>
                    )}

                    <ImageGrid images={memory.imageUrls} />
                    
                    <div className="p-6 space-y-6">
                      <p className="text-white/90 text-sm leading-relaxed font-medium">
                        {memory.content}
                      </p>
                      
                      {/* Interaction Buttons */}
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => handleLike(memory._id)}
                          className={`flex items-center gap-2 transition-all active:scale-90 ${isLiked ? 'text-red-500' : 'text-white/40 hover:text-red-500'}`}
                        >
                           <FiHeart className={`text-xl ${isLiked ? 'fill-red-500' : ''}`} />
                           <span className="text-xs font-black">{memory.likes?.length || 0}</span>
                        </button>
                        <button 
                          onClick={() => handleComment(memory._id)}
                          className="flex items-center gap-2 text-white/40 hover:text-primary transition-all active:scale-90"
                        >
                           <FiMessageCircle className="text-xl" />
                           <span className="text-xs font-black">{memory.comments?.length || 0}</span>
                        </button>
                      </div>

                      {/* Real-time Comments Display */}
                      {memory.comments?.length > 0 && (
                        <div className="mt-4 pt-6 border-t border-white/5 space-y-6">
                           {memory.comments.map((comment, i) => (
                             <div key={i} className="space-y-4">
                               <div className="flex gap-3 items-start group/comment">
                                  <div className="w-8 h-8 rounded-full bg-surfaceAlt/50 border border-white/10 overflow-hidden flex-shrink-0">
                                     {comment.user?.avatarUrl ? (
                                       <img src={comment.user.avatarUrl} className="w-full h-full object-cover" />
                                     ) : (
                                       <div className="w-full h-full flex items-center justify-center text-[8px] font-black bg-primary/20 text-primary uppercase">HP</div>
                                     )}
                                  </div>
                                  <div className="flex-1">
                                     <div className="bg-white/[0.03] rounded-2xl p-3 mb-2">
                                        <div className="flex items-center justify-between mb-1">
                                           <span className="text-[10px] font-black text-white/60 uppercase tracking-wider">{comment.user?.username || 'User'}</span>
                                           <span className="text-[8px] text-white/20 uppercase font-bold">
                                             {new Date(comment.createdAt).toLocaleDateString()}
                                           </span>
                                        </div>
                                        <p className="text-xs text-white/80 leading-relaxed">{comment.text}</p>
                                     </div>
                                     {/* Reply Button */}
                                     <button 
                                      onClick={() => handleReply(memory._id, comment._id)}
                                      className="flex items-center gap-1.5 text-[9px] font-black text-white/20 hover:text-primary uppercase tracking-widest transition-colors ml-2"
                                     >
                                       <FiRotateCcw size={10} /> Reply
                                     </button>
                                  </div>
                               </div>

                               {/* Replies */}
                               {comment.replies?.length > 0 && (
                                 <div className="ml-11 space-y-4 border-l border-white/5 pl-4">
                                   {comment.replies.map((reply, ri) => (
                                      <div key={ri} className="flex gap-2 items-start">
                                        <div className="w-6 h-6 rounded-full bg-surfaceAlt/50 overflow-hidden flex-shrink-0 border border-white/5">
                                           {reply.user?.avatarUrl ? (
                                             <img src={reply.user.avatarUrl} className="w-full h-full object-cover" />
                                           ) : (
                                             <div className="w-full h-full flex items-center justify-center text-[6px] font-black bg-primary/10 text-primary uppercase">HP</div>
                                           )}
                                        </div>
                                        <div className="flex-1 bg-white/[0.01] rounded-xl p-2.5">
                                           <div className="flex items-center justify-between mb-0.5">
                                              <span className="text-[9px] font-black text-white/40 uppercase">{reply.user?.username || 'User'}</span>
                                           </div>
                                           <p className="text-[11px] text-white/70 leading-relaxed">{reply.text}</p>
                                        </div>
                                      </div>
                                   ))}
                                 </div>
                               )}
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MemoriesPage;
