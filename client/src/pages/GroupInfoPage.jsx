import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiMoreVertical, FiUser, FiLogOut, FiTrash2, FiUserCheck, FiShield, FiPlus, FiCheck, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const GroupInfoPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [activeMemberMenu, setActiveMemberMenu] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableFriends, setAvailableFriends] = useState([]);
  const [selectedToInvite, setSelectedToInvite] = useState([]);

  const fetchGroup = async () => {
    try {
      const res = await api.get(`/groups/${id}`);
      setGroup(res.data);
    } catch (err) {
      toast.error('Failed to load group info');
      navigate('/chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [id]);

  const openAddModal = async () => {
    try {
      const res = await api.get('/users/friends/all');
      const currentMemberIds = group.members.map(m => m._id.toString());
      const filtered = res.data.friends.filter(f => !currentMemberIds.includes(f._id.toString()));
      setAvailableFriends(filtered);
      setShowAddModal(true);
    } catch (err) {
      toast.error('Failed to load friends');
    }
  };

  const toggleInvite = (friendId) => {
    setSelectedToInvite(prev => 
      prev.includes(friendId) ? prev.filter(f => f !== friendId) : [...prev, friendId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedToInvite.length === 0) return;
    try {
      await api.post(`/groups/${id}/members`, { memberIds: selectedToInvite });
      toast.success('Members added!');
      setShowAddModal(false);
      setSelectedToInvite([]);
      fetchGroup();
    } catch (err) {
      toast.error('Failed to add members');
    }
  };

  const isOwner = group?.creator?._id === user?._id || group?.creator === user?._id;

  const handleLeaveGroup = async () => {
    if (isOwner) {
       toast.error("Owner can't leave without transferring ownership");
       setShowTopMenu(false);
       return;
    }
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    
    try {
      await api.post(`/groups/${id}/leave`);
      toast.success('Left group');
      navigate('/chat');
    } catch (err) {
      toast.error('Failed to leave group');
    }
  };

  const handleDismissGroup = async () => {
    if (!isOwner) return;
    if (!window.confirm('PERMANENTLY DELETE THIS GROUP? This cannot be undone.')) return;

    try {
      await api.delete(`/groups/${id}`);
      toast.success('Group dismissed');
      navigate('/chat');
    } catch (err) {
      toast.error('Failed to dismiss group');
    }
  };

  const handleRemoveMember = async (memberId) => {
     try {
       await api.delete(`/groups/${id}/members/${memberId}`);
       toast.success('Member removed');
       setActiveMemberMenu(null);
       fetchGroup();
     } catch (err) {
       toast.error('Failed to remove member');
     }
  };

  const handleTransferOwnership = async (newOwnerId) => {
     if (!window.confirm('Transfer full ownership of this squad? You will no longer be the owner.')) return;
     try {
       await api.put(`/groups/${id}/owner`, { newOwnerId });
       toast.success('Ownership transferred');
       setActiveMemberMenu(null);
       fetchGroup();
     } catch (err) {
       toast.error('Failed to transfer ownership');
     }
  };

  if (loading) return (
    <div className="flex h-screen bg-bg items-center justify-center">
       <div className="w-10 h-10 border-4 border-white/10 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-bg text-white">
      {/* Header */}
      <header className="px-4 py-6 flex items-center justify-between border-b border-white/5 relative z-50">
         <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-surfaceAlt/80 rounded-full hover:bg-white/10 transition-colors">
            <FiChevronLeft size={24} />
         </button>
         <h1 className="text-lg font-black uppercase tracking-tight">Squad Info</h1>
         <div className="relative">
            <button onClick={() => setShowTopMenu(!showTopMenu)} className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
               <FiMoreVertical size={20} />
            </button>
            <AnimatePresence>
               {showTopMenu && (
                 <>
                   <div className="fixed inset-0 z-[60]" onClick={() => setShowTopMenu(false)} />
                   <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-2 z-[70]"
                   >
                      <button 
                        onClick={handleLeaveGroup}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/5 rounded-xl transition-colors text-left"
                      >
                        <FiLogOut size={18} /> Leave Group
                      </button>
                      {isOwner && (
                        <button 
                          onClick={handleDismissGroup}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-500/10 rounded-xl transition-colors text-left"
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

      <main className="flex-1 overflow-y-auto pb-10">
         {/* Profile Card */}
         <div className="flex flex-col items-center py-10 px-6 space-y-4">
            <div className="w-32 h-32 rounded-[40px] overflow-hidden border-4 border-surfaceAlt shadow-2xl relative">
               <img src={group?.avatarUrl} className="w-full h-full object-cover" alt="" />
               <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[40px]" />
            </div>
            <div className="text-center space-y-1">
               <h2 className="text-2xl font-black tracking-tight">{group?.name}</h2>
               <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{group?.members?.length} Members</p>
            </div>
            {group?.description && (
              <div className="bg-surfaceAlt/10 p-5 rounded-[24px] border border-white/5 w-full max-w-sm mt-4 backdrop-blur-sm">
                 <h4 className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-2">About Squad</h4>
                 <p className="text-sm text-white/60 leading-relaxed italic">{group?.description}</p>
              </div>
            )}
         </div>

         {/* Members List */}
         <div className="px-6 space-y-4">
            <div className="flex items-center justify-between px-1">
               <h3 className="text-[10px] font-black text-white/20 uppercase tracking-widest">Members List</h3>
               {(isOwner || group?.admins?.includes(user?._id)) && (
                 <button 
                  onClick={openAddModal}
                  className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-all active:scale-90"
                 >
                    <FiPlus size={18} />
                 </button>
               )}
            </div>
            <div className="space-y-2">
               {group?.members?.map(member => {
                 const isMemberOwner = group.creator?._id === member._id || group.creator === member._id;
                 const isSelf = member._id === user?._id;
                 
                 return (
                   <div key={member._id} className="bg-surfaceAlt/5 p-3 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="w-11 h-11 rounded-xl overflow-hidden bg-surface border border-white/5">
                            <img src={member.avatarUrl} className="w-full h-full object-cover" alt="" />
                         </div>
                         <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                               <span className="font-bold text-sm">{member.username}</span>
                               {isMemberOwner && <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[8px] font-black rounded uppercase tracking-wider">Owner</span>}
                            </div>
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">UID: {member.uid}</span>
                         </div>
                      </div>

                      {isOwner && !isSelf && (
                        <div className="relative">
                          <button onClick={() => setActiveMemberMenu(activeMemberMenu === member._id ? null : member._id)} className="w-9 h-9 flex items-center justify-center text-white/20 hover:text-white transition-colors">
                            <FiMoreVertical size={18} />
                          </button>
                          <AnimatePresence>
                             {activeMemberMenu === member._id && (
                               <>
                                 <div className="fixed inset-0 z-[60]" onClick={() => setActiveMemberMenu(null)} />
                                 <motion.div 
                                  initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                  className="absolute right-0 top-0 mt-8 w-48 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl z-[70] p-2"
                                 >
                                    <button 
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/40 hover:bg-white/5 rounded-xl transition-colors cursor-not-allowed text-left"
                                      onClick={() => toast('Admin feature coming soon!')}
                                    >
                                      <FiShield size={16} /> Set as Admin
                                    </button>
                                    <button 
                                      onClick={() => handleTransferOwnership(member._id)}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-primary hover:bg-primary/10 rounded-xl transition-colors text-left"
                                    >
                                      <FiUserCheck size={16} /> Transfer Owner
                                    </button>
                                    <div className="h-[1px] bg-white/5 my-1" />
                                    <button 
                                      onClick={() => handleRemoveMember(member._id)}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 rounded-xl transition-colors text-left"
                                    >
                                      <FiTrash2 size={16} /> Remove from Group
                                    </button>
                                 </motion.div>
                               </>
                             )}
                          </AnimatePresence>
                        </div>
                      )}
                   </div>
                 );
               })}
            </div>
         </div>
      </main>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setShowAddModal(false)}
               className="absolute inset-0 bg-black/80 backdrop-blur-md"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }} 
               animate={{ opacity: 1, scale: 1, y: 0 }} 
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-sm bg-surface rounded-[40px] overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[80vh]"
             >
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                   <h2 className="text-xl font-black uppercase tracking-tight">Add to Squad</h2>
                   <button onClick={() => setShowAddModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 text-white/40"><FiX size={20} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                   {availableFriends.length === 0 ? (
                     <div className="py-20 text-center space-y-2">
                        <FiUser className="text-4xl text-white/5 mx-auto" />
                        <p className="text-xs text-white/20">All your friends are already in this squad!</p>
                     </div>
                   ) : (
                     availableFriends.map(friend => {
                       const isSelected = selectedToInvite.includes(friend._id);
                       return (
                         <div 
                          key={friend._id}
                          onClick={() => toggleInvite(friend._id)}
                          className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
                            isSelected ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-transparent hover:bg-white/[0.08]'
                          }`}
                         >
                            <div className="flex items-center gap-3">
                               <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/5">
                                  <img src={friend.avatarUrl} className="w-full h-full object-cover" />
                               </div>
                               <div>
                                  <p className="text-sm font-bold">{friend.username}</p>
                                  <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">LV {friend.level || 1}</p>
                               </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'bg-primary border-primary' : 'border-white/10'
                            }`}>
                               {isSelected && <FiCheck size={14} className="text-white" />}
                            </div>
                         </div>
                       )
                     })
                   )}
                </div>

                <div className="p-4 bg-white/5 border-t border-white/5">
                   <button 
                    disabled={selectedToInvite.length === 0}
                    onClick={handleAddMembers}
                    className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 disabled:opacity-30 disabled:grayscale hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-xs"
                   >
                      Add {selectedToInvite.length > 0 ? `${selectedToInvite.length} ` : ''}to Squad
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroupInfoPage;
