import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaMicrophone, FaGamepad, FaGlobeAmericas } from 'react-icons/fa';

const LandingPage = () => {
  return (
    <div className="flex-1 flex flex-col w-full h-full">
      {/* Navbar */}
      <nav className="w-full px-6 py-4 flex justify-between items-center bg-transparent relative z-10">
        <div className="text-2xl font-bold tracking-tight">
          <span className="text-white">Hello </span>
          <span className="text-primary">Party</span>
        </div>
        <div className="flex gap-4 items-center">
          <Link to="/login" className="text-white/80 hover:text-white transition-colors">Log In</Link>
          <Link to="/register" className="px-5 py-2 bg-primary hover:bg-primaryHover text-white rounded-full font-medium transition-colors shadow-lg shadow-primary/20">Sign Up</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-4">
        {/* Abstract Background Shapes */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] -z-10 mix-blend-screen animate-pulse-ring"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] -z-10 mix-blend-screen animate-pulse-ring" style={{ animationDelay: '1s' }}></div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-4xl mx-auto"
        >
          <h1 className="text-6xl md:text-8xl font-bold mb-6 leading-tight">
            Talk. Play. <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Connect.</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/70 mb-10 max-w-2xl mx-auto">
            The ultimate party game platform. Jump into live voice rooms, play casual games, and meet people around the world without downloading a thing.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
            <Link to="/register" className="px-8 py-4 bg-gradient-to-r from-primary to-primaryHover rounded-full text-lg font-bold text-white shadow-xl shadow-primary/30 hover:scale-105 transition-transform flex items-center gap-2">
              Get Started Free
            </Link>
            <Link to="/lobby" className="px-8 py-4 bg-surfaceAlt border border-border rounded-full text-lg font-bold text-white hover:bg-surface transition-colors flex items-center gap-2">
              Explore Rooms
            </Link>
          </div>
        </motion.div>

        {/* Feature Cards */}
        <div className="mt-32 w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
          <FeatureCard 
            icon={<FaMicrophone className="text-4xl text-primary" />}
            title="Live Voice Rooms"
            description="Crystal clear, ultra-low latency voice chat powered by pure WebRTC. Just join and talk."
            delay={0.2}
          />
          <FeatureCard 
            icon={<FaGamepad className="text-4xl text-accent" />}
            title="Casual Party Games"
            description="Play Draw & Guess, Who is the Spy, and Space Werewolf directly in the room."
            delay={0.4}
          />
          <FeatureCard 
            icon={<FaGlobeAmericas className="text-4xl text-success" />}
            title="Global Community"
            description="Meet awesome people, send virtual gifts, and build your friend network worldwide."
            delay={0.6}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-white/40 border-t border-border">
        <p>&copy; {new Date().getFullYear()} Hello Party. All rights reserved.</p>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay }}
    className="bg-surface/50 backdrop-blur-md border border-border p-8 rounded-3xl hover:border-primary/50 transition-colors group"
  >
    <div className="bg-surfaceAlt w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-2xl font-bold mb-3">{title}</h3>
    <p className="text-white/60 leading-relaxed">{description}</p>
  </motion.div>
);

export default LandingPage;
