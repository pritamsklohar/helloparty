import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiPlus, FiChevronRight, FiMic } from 'react-icons/fi';
import Navbar from '../components/layout/Navbar';

// Mock explore data
const mockExploreRooms = [
  { id: '1', host: 'Akshar...', avatar: '1', gender: 'female', desc: 'This is a very mysterio...', status: 'In Video Room', color: 'text-pink-400' },
  { id: '2', host: 'Ammu🐼', avatar: '2', gender: 'female', desc: 'This user is your age', status: 'In Voice Room', color: 'text-green-400' },
  { id: '3', host: 'AyEsHa💖', avatar: '3', gender: 'female', desc: 'This user is your age', status: 'In Voice Room', color: 'text-green-400' },
  { id: '4', host: 'ZARA', avatar: '4', gender: 'female', desc: 'Just me and no one ❤️...', status: 'In Voice Room', color: 'text-green-400' },
  { id: '5', host: 'ISHU🕊️', avatar: '5', gender: 'female', desc: '®➤ALLEN ❤️', status: 'In Voice Room', color: 'text-green-400' },
];

const games = [
  { id: 'trickster', title: "Trickster's Card", emoji: "🐊", from: "from-orange-800", to: "to-amber-600", border: "border-orange-500/30" },
  { id: 'hide', title: "Hide And Seek", emoji: "👻", from: "from-teal-500", to: "to-emerald-400", border: "border-teal-300/50" },
  { id: 'space', title: "Space Werewolf", emoji: "🐺", from: "from-indigo-600", to: "to-purple-500", border: "border-indigo-400/50" },
  { id: 'card', title: "Oh My Card", emoji: "🃏", from: "from-green-500", to: "to-lime-400", border: "border-green-300/50" },
  { id: 'ludo', title: "Ludo", emoji: "🎲", from: "from-purple-600", to: "to-fuchsia-500", border: "border-purple-400/50" },
  { id: 'draw', title: "Guess My Drawing", emoji: "✏️", from: "from-emerald-400", to: "to-green-300", border: "border-emerald-200/50" },
];

const LobbyPage = () => {
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setLoading(false);
    }, 400);
  }, []);

  const showHeader = location.pathname === '/lobby' || location.pathname === '/';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {showHeader && <Navbar />}
      
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-24 scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 md:px-6 pt-4">
            
            {/* Quick Actions */}
            <div className="flex justify-around items-center mb-8">
              {[
                { name: 'Ranking', emoji: '👑', color: 'from-purple-500 to-indigo-500' },
                { name: 'Tasks', emoji: '📋', color: 'from-blue-400 to-cyan-400' },
                { name: 'Friends', emoji: '👥', color: 'from-emerald-400 to-teal-500' },
              ].map(action => (
                <div key={action.name} className="flex flex-col items-center gap-2 cursor-pointer hover:scale-105 transition-transform">
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center p-1 border-[3px] border-surfaceAlt shadow-lg`}>
                    <span className="text-2xl md:text-3xl drop-shadow-md">{action.emoji}</span>
                  </div>
                  <span className="text-xs md:text-sm font-medium text-white/80">{action.name}</span>
                </div>
              ))}
            </div>

            {/* Games Section */}
            <div className="mb-10">
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-3xl font-black tracking-tight text-white">Games</h2>
                <button className="flex items-center gap-2 bg-surfaceAlt px-3 py-1.5 rounded-xl text-sm font-medium border border-border hover:bg-white/10 transition-colors">
                  <span className="text-lg">🚪</span> Game Room
                </button>
              </div>
              
              <div className="flex items-center gap-2 mb-4 text-xs text-white/60">
                <span>Recently played :</span>
                <span className="bg-surfaceAlt px-2 py-1 rounded-md flex items-center gap-1 border border-border"><span className="text-sm">🃏</span> Jackaroo</span>
                <span className="bg-surfaceAlt px-2 py-1 rounded-md flex items-center gap-1 border border-border"><span className="text-sm">🎱</span> Bingo</span>
              </div>

              {/* Game Banners */}
              <div className="space-y-3">
                {/* Large Banner: Who's the Spy */}
                <div className="w-full h-28 md:h-32 rounded-2xl bg-gradient-to-r from-[#2196F3] to-[#00BCD4] relative overflow-hidden border-2 border-[#81D4FA]/30 shadow-lg cursor-pointer hover:scale-[1.02] transition-transform">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0,transparent_100%)]"></div>
                  <div className="absolute -right-4 -bottom-8 opacity-40 text-[150px] leading-none">🕵️‍♂️</div>
                  <div className="relative h-full flex items-center px-6">
                    <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md z-10">Who's the Spy</h3>
                    <div className="absolute right-4 bottom-2 text-7xl md:text-8xl drop-shadow-2xl z-10">🕵️‍♂️</div>
                  </div>
                </div>

                {/* Small Banners Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {games.map((game, i) => (
                    <motion.div 
                      key={game.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`h-20 md:h-24 rounded-xl bg-gradient-to-br ${game.from} ${game.to} relative overflow-hidden border-2 ${game.border} shadow-md flex items-center px-4 cursor-pointer hover:scale-[1.03] transition-transform`}
                    >
                      <h4 className="text-base md:text-lg font-bold text-white leading-tight drop-shadow-md w-[60%] z-10">{game.title}</h4>
                      <div className="absolute right-1 -bottom-2 text-[60px] md:text-[70px] drop-shadow-xl opacity-90">{game.emoji}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Explore Section */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black tracking-tight text-white">Explore</h2>
                <button className="text-xs md:text-sm text-white/50 flex items-center gap-1 hover:text-white transition-colors">
                  Enable GPS to explore more <FiChevronRight />
                </button>
              </div>

              <div className="space-y-2">
                {mockExploreRooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-surfaceAlt/50 transition-colors cursor-pointer group border border-transparent hover:border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full border-2 border-primary/50 overflow-hidden relative">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${room.avatar}`} alt={room.host} className="w-full h-full object-cover bg-surface" />
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-bg"></div>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-base md:text-lg group-hover:text-primary transition-colors">{room.host}</span>
                          {room.gender === 'female' ? (
                            <span className="text-pink-400 text-xs">♀️</span>
                          ) : (
                            <span className="text-blue-400 text-xs">♂️</span>
                          )}
                        </div>
                        <span className="text-xs md:text-sm text-white/50 truncate w-40 md:w-64">{room.desc}</span>
                      </div>
                    </div>
                    
                    <button className="flex items-center gap-2 bg-success/10 border border-success/20 px-3 py-1.5 rounded-full hover:bg-success/20 transition-colors">
                      <span className="flex items-center gap-0.5">
                        <span className="w-1 h-3 bg-success rounded-full animate-pulse"></span>
                        <span className="w-1 h-4 bg-success rounded-full animate-pulse delay-75"></span>
                        <span className="w-1 h-2 bg-success rounded-full animate-pulse delay-150"></span>
                      </span>
                      <span className="text-success text-xs font-bold whitespace-nowrap">{room.status}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>

        {/* Right Sidebar (Desktop only) */}
        <aside className="w-80 bg-surface/50 border-l border-border hidden xl:flex flex-col h-full overflow-y-auto">
          <div className="p-6 pb-4">
            <button className="w-full py-4 bg-gradient-to-r from-primary to-primaryHover text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <FiPlus className="text-2xl" />
              Create Room
            </button>
          </div>
          
          <div className="flex-1 px-6 pt-4">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">Friends Online (3)</h3>
            <div className="space-y-4">
              {['Emma', 'David', 'Chris', 'Sophia'].map((name, i) => (
                <div key={name} className="flex items-center justify-between group cursor-pointer p-2 -mx-2 rounded-lg hover:bg-surfaceAlt transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-surface border border-border overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} alt={name} className="w-full h-full object-cover" />
                      </div>
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface ${i < 3 ? 'bg-success' : 'bg-white/20'}`}></div>
                    </div>
                    <div>
                      <div className="text-sm font-medium group-hover:text-primary transition-colors">{name}</div>
                      <div className="text-xs text-white/40">{i < 2 ? 'In a Voice Room' : i === 2 ? 'In Lobby' : 'Offline'}</div>
                    </div>
                  </div>
                  {i < 3 && (
                    <button className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-surfaceAlt hover:bg-white/10 text-xs font-medium rounded-md transition-all border border-border">
                      Invite
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default LobbyPage;
