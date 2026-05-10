import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiMic, FiMessageSquare, FiCompass, FiUser } from 'react-icons/fi';

const BottomNav = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { name: 'Home', path: '/lobby', icon: FiHome },
    { name: 'Voice', path: '/voice', icon: FiMic },
    { name: 'Chat', path: '/chat', icon: FiMessageSquare },
    { name: 'Discover', path: '/discover', icon: FiCompass },
    { name: 'Profile', path: '/profile', icon: FiUser },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-border z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const isActive = currentPath === item.path || (item.path === '/lobby' && currentPath === '/');
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.name} 
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 ${
                isActive ? 'text-primary scale-110' : 'text-white/40 hover:text-white/80 hover:scale-105'
              }`}
            >
              <div className="relative">
                <Icon className={`text-xl transition-all duration-200 ${isActive ? 'fill-primary/20 drop-shadow-[0_0_8px_rgba(124,92,191,0.5)]' : ''}`} />
                {isActive && (
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
              <span className={`text-[10px] font-medium transition-all duration-200 ${isActive ? 'text-primary mt-1' : ''}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
