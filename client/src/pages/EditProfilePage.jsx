import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiChevronLeft, FiCamera, FiUser, FiFileText, FiSave, FiMapPin, FiCalendar, FiUsers } from 'react-icons/fi';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';
import { socket } from '../services/socket';

import { useRef } from 'react';

const EditProfilePage = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    username: user?.username || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || '',
    gender: user?.gender || '',
    country: user?.country || '',
    dob: user?.dob ? new Date(user.dob).toISOString().split('T')[0] : ''
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Basic validation
    if (file.size > 5 * 1024 * 1024) {
      return toast.error('File size must be less than 5MB');
    }

    const formDataUpload = new FormData();
    formDataUpload.append('avatar', file);

    setUploading(true);
    try {
      const res = await api.post('/upload/avatar', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, avatarUrl: res.data.url }));
      toast.success('Avatar uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put('/users/profile', formData);
      setUser(res.data.user);

      // Emit real-time socket update for active room members
      socket.emit('peer:update_profile', {
        userId: res.data.user._id,
        username: res.data.user.username,
        avatarUrl: res.data.user.avatarUrl
      });

      toast.success('Profile updated successfully!');
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-6 bg-transparent border-b border-white/5">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-white bg-surfaceAlt/80 rounded-full hover:bg-white/10 transition-colors">
          <FiChevronLeft className="text-2xl" />
        </button>
        <h1 className="text-lg font-bold text-white tracking-tight">Edit Profile</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-8">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*"
            />
            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-2xl bg-surfaceAlt flex items-center justify-center">
                {uploading ? (
                  <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <img 
                    src={formData.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.username}`} 
                    alt="Avatar Preview" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center border-4 border-bg text-white shadow-xl hover:scale-110 transition-transform active:scale-95">
                <FiCamera className="text-lg" />
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-[10px] font-bold uppercase tracking-widest">{uploading ? 'Uploading...' : 'Change Photo'}</span>
              </div>
            </div>
            <p className="mt-4 text-white/40 text-[10px] uppercase font-bold tracking-widest">Profile Identity</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 pb-10">
            {/* Username Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                <FiUser className="text-primary" /> Username
              </label>
              <input
                type="text"
                placeholder="Pick a unique name"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-surfaceAlt/50 border border-white/10 text-white rounded-2xl py-3.5 px-4 focus:outline-none focus:border-primary transition-all placeholder:text-white/20"
                required
              />
            </div>

            {/* Gender Input */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                <FiUsers className="text-primary" /> Gender
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['male', 'female', 'other'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: option })}
                    className={`py-3 rounded-2xl border font-bold capitalize transition-all active:scale-95 ${
                      formData.gender === option 
                        ? 'bg-primary/20 border-primary text-primary shadow-lg' 
                        : 'bg-surfaceAlt/50 border-white/5 text-white/40 hover:bg-white/5'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Country Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                <FiMapPin className="text-primary" /> Country
              </label>
              <input
                type="text"
                placeholder="Where are you from?"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full bg-surfaceAlt/50 border border-white/10 text-white rounded-2xl py-3.5 px-4 focus:outline-none focus:border-primary transition-all placeholder:text-white/20"
              />
            </div>

            {/* DoB Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                <FiCalendar className="text-primary" /> Date of Birth
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full bg-surfaceAlt/50 border border-white/10 text-white rounded-2xl py-3.5 px-4 focus:outline-none focus:border-primary transition-all [color-scheme:dark]"
              />
            </div>

            {/* Bio Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                  <FiFileText className="text-primary" /> Bio
                </label>
                <span className={`text-[10px] font-bold tracking-widest uppercase transition-colors ${
                  formData.bio.trim().split(/\s+/).filter(w => w.length > 0).length > 50 
                    ? 'text-red-500' 
                    : 'text-white/30'
                }`}>
                  {formData.bio.trim().split(/\s+/).filter(w => w.length > 0).length}/50 Words
                </span>
              </div>
              <textarea
                placeholder="Tell the world about yourself..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows="3"
                className={`w-full bg-surfaceAlt/50 border text-white rounded-2xl py-3.5 px-4 focus:outline-none transition-all placeholder:text-white/20 resize-none ${
                  formData.bio.trim().split(/\s+/).filter(w => w.length > 0).length > 50 
                    ? 'border-red-500/50 focus:border-red-500' 
                    : 'border-white/10 focus:border-primary'
                }`}
              />
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FiSave className="text-xl" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default EditProfilePage;
