import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LobbyPage from './pages/LobbyPage';
import RoomPage from './pages/RoomPage';
import ProfilePage from './pages/ProfilePage';
import VoicePage from './pages/VoicePage';
import BottomNav from './components/layout/BottomNav';
import { VoiceRoomProvider } from './context/VoiceRoomContext';
import MinimizedRoom from './components/MinimizedRoom';

// Simple protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
};

const AppContent = () => {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const isRoomPage = location.pathname.startsWith('/room/');
  const isAuthPage = ['/', '/login', '/register'].includes(location.pathname);
  const showBottomNav = isAuthenticated && !isRoomPage && !isAuthPage;

  return (
    <div className="min-h-screen bg-bg text-white font-sans selection:bg-primary selection:text-white flex flex-col">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/room/:id" element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        {/* Placeholder routes for the bottom nav items */}
        <Route path="/voice" element={<ProtectedRoute><VoicePage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/discover" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
      </Routes>
      
      {showBottomNav && <BottomNav />}
      <MinimizedRoom />
      
      <Toaster position="top-center" toastOptions={{
        style: {
          background: '#1A1A2E',
          color: '#fff',
          borderRadius: '10px',
          border: '1px solid #2A2A3E'
        }
      }} />
    </div>
  );
};

function App() {
  return (
    <VoiceRoomProvider>
      <Router>
        <AppContent />
      </Router>
    </VoiceRoomProvider>
  );
}

export default App;
