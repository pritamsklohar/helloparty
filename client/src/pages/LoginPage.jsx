import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  
  const { login, isLoading, isAuthenticated, error } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/lobby');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      toast.success('Welcome back!');
      navigate('/lobby');
    } else {
      toast.error(useAuthStore.getState().error || 'Login failed');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-bg to-bg"></div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-surface/80 backdrop-blur-xl border border-border rounded-3xl p-8 z-10 shadow-2xl"
      >
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold inline-block mb-2">
            <span className="text-white">Hello </span>
            <span className="text-primary">Party</span>
          </Link>
          <p className="text-white/60">Log in to continue the party</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
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
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surfaceAlt border border-border text-white rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/30"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white/80"
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary to-primaryHover text-white font-bold rounded-xl py-4 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Log In'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-white/60">
          Don't have an account? <Link to="/register" className="text-primary hover:text-primaryHover font-medium ml-1 transition-colors">Sign up</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
