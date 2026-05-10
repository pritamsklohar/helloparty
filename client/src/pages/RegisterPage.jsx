import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiCamera } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, isLoading, isAuthenticated } = useAuthStore();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/lobby');
    }
  }, [isAuthenticated, navigate]);

  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      // In a real app, we would upload to Cloudinary and get URL
      // For now, we'll just mock it or leave it empty in the actual DB
      setAvatar(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const success = await register({ username, email, password });
    if (success) {
      toast.success('Account created successfully!');
      navigate('/lobby');
    } else {
      toast.error(useAuthStore.getState().error || 'Registration failed');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-secondary/10 via-bg to-bg"></div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-surface/80 backdrop-blur-xl border border-border rounded-3xl p-8 z-10 shadow-2xl mt-10 mb-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Account</h1>
          <p className="text-white/60">Join the party today</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="flex justify-center mb-6">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-surfaceAlt border-2 border-dashed border-border overflow-hidden flex items-center justify-center transition-colors group-hover:border-primary">
                {avatar ? (
                  <img src={avatar} alt="Avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <FiCamera className="text-3xl text-white/40 group-hover:text-primary transition-colors" />
                )}
              </div>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleAvatarChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full border-2 border-surface shadow-lg">
                <FiCamera className="text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiUser className="text-white/40 text-lg" />
              </div>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surfaceAlt border border-border text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/30"
                placeholder="AwesomeUser"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiMail className="text-white/40 text-lg" />
              </div>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surfaceAlt border border-border text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/30"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiLock className="text-white/40 text-lg" />
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surfaceAlt border border-border text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/30"
                placeholder="••••••••"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group mt-4">
            <input type="checkbox" required className="mt-1 rounded border-border bg-surfaceAlt text-primary focus:ring-primary focus:ring-offset-bg accent-primary w-4 h-4 cursor-pointer shrink-0" />
            <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
              I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>
            </span>
          </label>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary to-primaryHover text-white font-bold rounded-xl py-4 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-white/60">
          Already have an account? <Link to="/login" className="text-primary hover:text-primaryHover font-medium ml-1 transition-colors">Log in</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
