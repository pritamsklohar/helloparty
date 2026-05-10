import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiBell, FiChevronDown, FiUser, FiLogOut } from 'react-icons/fi';
import { FaCoins } from 'react-icons/fa';
import useAuthStore from '../../store/authStore';

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="w-full h-16 bg-surface/80 backdrop-blur-md border-b border-border sticky top-0 z-50 flex items-center px-4 md:px-6 justify-between">
      
      {/* LEFT: Profile & Coins */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:bg-surfaceAlt p-1 pr-2 md:pr-3 rounded-full transition-colors border border-transparent hover:border-border"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary/30 flex items-center justify-center overflow-hidden border border-primary/50">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || 'user'}`} alt="avatar" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-medium leading-none">{user?.username || 'User'}</span>
              <span className="text-[10px] text-primary font-bold">Lvl {user?.level || 1}</span>
            </div>
            <FiChevronDown className="text-white/40 hidden sm:block" />
          </div>

          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-48 bg-surfaceAlt border border-border rounded-xl shadow-xl overflow-hidden z-50">
              <div className="py-1">
                <Link 
                  to="/profile" 
                  className="flex items-center gap-2 px-4 py-2 text-sm text-white/80 hover:bg-surface hover:text-primary transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  <FiUser /> Profile
                </Link>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white/80 hover:bg-surface hover:text-red-400 transition-colors text-left"
                >
                  <FiLogOut /> Log out
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex bg-surfaceAlt px-3 py-1.5 rounded-full items-center gap-2 border border-border">
          <FaCoins className="text-accent text-sm" />
          <span className="text-sm font-bold">{user?.coins || 0}</span>
        </div>
      </div>

      {/* CENTER: Search */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-white/40 group-focus-within:text-primary transition-colors" />
          </div>
          <input 
            type="text" 
            className="w-full bg-surfaceAlt border border-border text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-white/30 text-sm"
            placeholder="Search rooms, games, or players..."
          />
        </div>
      </div>

      {/* RIGHT: Notifications */}
      <div className="flex items-center gap-2">
        <button className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-surfaceAlt transition-colors">
          <FiBell className="text-xl text-white/80" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full"></span>
        </button>
      </div>

    </nav>
  );
};

export default Navbar;
