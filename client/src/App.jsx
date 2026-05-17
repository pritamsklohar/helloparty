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
import UserProfilePage from './pages/UserProfilePage';
import FriendRequestsPage from './pages/FriendRequestsPage';
import VoicePage from './pages/VoicePage';
import ChatsPage from './pages/ChatsPage';
import ChatRoomPage from './pages/ChatRoomPage';
import DiscoverPage from './pages/DiscoverPage';
import EditProfilePage from './pages/EditProfilePage';
import AllFriendsPage from './pages/AllFriendsPage';
import MemoriesPage from './pages/MemoriesPage';
import CreateMemoryPage from './pages/CreateMemoryPage';
import CreateGroupPage from './pages/CreateGroupPage';
import GroupChatPage from './pages/GroupChatPage';
import GroupInfoPage from './pages/GroupInfoPage';
import BottomNav from './components/layout/BottomNav';
import { VoiceRoomProvider } from './context/VoiceRoomContext';
import MinimizedRoom from './components/MinimizedRoom';

import useChatStore from './store/chatStore';
import { socket, connectSocket, disconnectSocket } from './services/socket';

// Simple protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
};

const AppContent = () => {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const { isAuthenticated, user } = useAuthStore();
  const { fetchConversations, addMessage, removeMessage, conversations } = useChatStore();
  const location = useLocation();
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Global Socket Connection & Background Sync
  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect to Socket server immediately
      connectSocket(user._id);

      // Fetch latest conversations in background silently
      fetchConversations(true);

      // Setup global message listeners
      const handleReceivePrivateMessage = (msg) => {
        const chatId = msg.sender === user._id ? msg.receiver : msg.sender;
        addMessage(chatId, msg);
      };

      const handleMessageSent = (msg) => {
        const chatId = msg.sender === user._id ? msg.receiver : msg.sender;
        addMessage(chatId, msg);
      };

      const handleReceiveGroupMessage = (msg) => {
        addMessage(msg.groupId, msg);
      };

      const handleMessageDeleted = (data) => {
        // Remove from all cached chats
        const cachedChats = useChatStore.getState().messagesCache;
        Object.keys(cachedChats).forEach((chatId) => {
          removeMessage(chatId, data.messageId);
        });
      };

      socket.on('receive_private_message', handleReceivePrivateMessage);
      socket.on('message_sent', handleMessageSent);
      socket.on('receive_group_message', handleReceiveGroupMessage);
      socket.on('message_deleted', handleMessageDeleted);

      return () => {
        socket.off('receive_private_message', handleReceivePrivateMessage);
        socket.off('message_sent', handleMessageSent);
        socket.off('receive_group_message', handleReceiveGroupMessage);
        socket.off('message_deleted', handleMessageDeleted);
        disconnectSocket();
      };
    }
  }, [isAuthenticated, user, fetchConversations, addMessage, removeMessage]);

  // Automatically join all groups in the socket background
  useEffect(() => {
    if (isAuthenticated && conversations.length > 0) {
      conversations.forEach((conv) => {
        if (conv.isGroup) {
          socket.emit('join_group', conv._id);
        }
      });
    }
  }, [isAuthenticated, conversations]);

  const isRoomPage = location.pathname.startsWith('/room/');
  const isChatRoom = location.pathname.startsWith('/chat/') && location.pathname !== '/chat';
  const isCreateMemory = location.pathname === '/memories/create';
  const isGroupRoute = location.pathname.startsWith('/groups/');
  const isAuthPage = ['/', '/login', '/register'].includes(location.pathname);
  const showBottomNav = isAuthenticated && !isRoomPage && !isAuthPage && !isChatRoom && !isCreateMemory && !isGroupRoute;

  return (
    <div className="min-h-screen bg-bg text-white font-sans selection:bg-primary selection:text-white flex flex-col">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/room/:id" element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/user/:id" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><AllFriendsPage /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute><FriendRequestsPage /></ProtectedRoute>} />
        {/* Placeholder routes for the bottom nav items */}
        <Route path="/voice" element={<ProtectedRoute><VoicePage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatsPage /></ProtectedRoute>} />
        <Route path="/chat/:uid" element={<ProtectedRoute><ChatRoomPage /></ProtectedRoute>} />
        <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
        <Route path="/edit-profile" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
        <Route path="/memories" element={<ProtectedRoute><MemoriesPage /></ProtectedRoute>} />
        <Route path="/memories/user/:userId" element={<ProtectedRoute><MemoriesPage /></ProtectedRoute>} />
        <Route path="/memories/create" element={<ProtectedRoute><CreateMemoryPage /></ProtectedRoute>} />
        <Route path="/groups/create" element={<ProtectedRoute><CreateGroupPage /></ProtectedRoute>} />
        <Route path="/groups/:id" element={<ProtectedRoute><GroupChatPage /></ProtectedRoute>} />
        <Route path="/groups/:id/info" element={<ProtectedRoute><GroupInfoPage /></ProtectedRoute>} />
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
