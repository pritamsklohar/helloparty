import React from 'react';
import { motion } from 'framer-motion';
import { FiCompass } from 'react-icons/fi';

const DiscoverPage = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg text-center px-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-24 h-24 rounded-full bg-surfaceAlt/50 flex items-center justify-center mb-6 border border-white/5 shadow-2xl"
      >
        <FiCompass className="text-5xl text-primary opacity-50" />
      </motion.div>
      <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Nothing to discover</h2>
      <p className="text-white/40 text-sm max-w-[240px]">We're currently preparing new content for you. Check back later!</p>
    </div>
  );
};

export default DiscoverPage;
