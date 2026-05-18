import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
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
import { VoiceRoomProvider, useVoiceRoom } from './context/VoiceRoomContext';
import MinimizedRoom from './components/MinimizedRoom';
import api from './services/api';

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
  const navigate = useNavigate();
  
  const { joinRoom, minimizeRoom, closeRoom, socketRef } = useVoiceRoom();

  // Track last visited non-room page
  useEffect(() => {
    if (!location.pathname.startsWith('/room/')) {
      localStorage.setItem('lastPath', location.pathname);
    }
  }, [location]);
  
  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  
  // Restore and validate active room session in real-time
  useEffect(() => {
    if (isAuthenticated && user?.inRoom) {
      const restoreAndValidateRoom = async () => {
        try {
          const res = await api.get(`/rooms/${user.inRoom}`);
          const room = res.data;
          
          if (room) {
            // Room exists! Preload state and show minimized window
            const isFullPage = window.location.pathname === `/room/${user.inRoom}`;
            joinRoom(room);
            if (!isFullPage) {
              minimizeRoom();
              localStorage.setItem('roomMinimized', 'true');
            }
          }
        } catch (err) {
          console.warn("Active room session validation failed (room does not exist):", err.message);
          
          // Clear active session immediately in DB & local store (0ms)
          try {
            await api.put('/users/profile', { inRoom: null });
          } catch (updateErr) {
            console.error("Failed to clear inRoom in database:", updateErr.message);
          }
          closeRoom();
        }
      };
      
      restoreAndValidateRoom();
    } else if (isAuthenticated && !user?.inRoom) {
      // Clear local states if no active room is specified on the user in MongoDB
      const activeRoomId = localStorage.getItem('activeRoomId');
      if (activeRoomId) {
        closeRoom();
      }
    }
  }, [isAuthenticated, user?.inRoom]);

  // Handle global background socket events for minimized room
  useEffect(() => {
    const socketInstance = socketRef.current;
    if (!socketInstance) return;

    const handleKicked = (data) => {
      const min = data?.remainingMinutes ?? 10;
      const sec = data?.remainingSeconds ?? 0;
      toast.error(`You are kicked please rejoin again in ${min} min ${sec} sec`);
      closeRoom();
      navigate('/lobby');
    };

    const handleAdminStoodUp = () => {
      toast.error("You have been stood up from your seat by the owner.");
      if (socketRef.current && user?.inRoom) {
        socketRef.current.emit('peer:stand_up', { roomId: user.inRoom });
      }
    };

    socketInstance.on('peer:kicked_by_owner', handleKicked);
    socketInstance.on('peer:admin_stood_up', handleAdminStoodUp);

    return () => {
      socketInstance.off('peer:kicked_by_owner', handleKicked);
      socketInstance.off('peer:admin_stood_up', handleAdminStoodUp);
    };
  }, [socketRef.current, user?.inRoom]);

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
        
        // Dynamically check if currently viewing this direct chat
        const currentPath = window.location.pathname;
        const isChatRoute = currentPath.startsWith('/chat/') && currentPath !== '/chat';
        let isActive = false;

        if (isChatRoute) {
          const activeUid = currentPath.split('/').pop();
          const activeUser = useChatStore.getState().usersCache[activeUid];
          if (activeUser && activeUser._id === chatId) {
            isActive = true;
          }
        }

        addMessage(chatId, msg, isActive);

        // If looking at this chat, tell backend to mark as read immediately
        if (isActive) {
          socket.emit('mark_as_read', { senderId: chatId, receiverId: user._id });
        } else {
          // Toast notifications for unmuted private chats
          const isMuted = useChatStore.getState().mutedChatIds.includes(chatId);
          if (!isMuted) {
            const senderDetails = useChatStore.getState().usersCache[msg.sender];
            const senderName = senderDetails?.username || 'a friend';
            toast(`New message from ${senderName}`, {
              icon: '💬',
              style: {
                borderRadius: '16px',
                background: '#1a1a2e',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)'
              }
            });
          }
        }
      };

      const handleMessageSent = (msg) => {
        const chatId = msg.sender === user._id ? msg.receiver : msg.sender;
        addMessage(chatId, msg, false); // It is our own message, but remains 'sent' until the recipient reads it!
      };

      const handleReceiveGroupMessage = (msg) => {
        // Dynamically check if currently viewing this group chat
        const currentPath = window.location.pathname;
        const isGroupRoute = currentPath.startsWith('/groups/') && currentPath !== '/groups';
        let isActive = false;

        if (isGroupRoute) {
          const activeGroupId = currentPath.split('/').pop();
          if (activeGroupId === msg.groupId) {
            isActive = true;
          }
        }

        addMessage(msg.groupId, msg, isActive);

        // Toast notifications for unmuted groups
        if (!isActive) {
          const isMuted = useChatStore.getState().mutedChatIds.includes(msg.groupId);
          if (!isMuted) {
            const groupDetails = useChatStore.getState().groupsCache[msg.groupId];
            const groupName = groupDetails?.name || 'Group';
            toast(`New message in ${groupName}`, {
              icon: '👥',
              style: {
                borderRadius: '16px',
                background: '#1a1a2e',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)'
              }
            });
          }
        }
      };

      const handleMessageDeleted = (data) => {
        // Remove from all cached chats
        const cachedChats = useChatStore.getState().messagesCache;
        Object.keys(cachedChats).forEach((chatId) => {
          removeMessage(chatId, data.messageId);
        });
      };

      const handleFriendRequestReceived = (data) => {
        toast(`You have a new friend Request`, {
          icon: '👥',
          style: {
            borderRadius: '16px',
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        });
      };

      const handleFriendRequestAccepted = (data) => {
        const usernameVal = data?.acceptorUsername || 'A user';
        toast(`${usernameVal} accepted your request`, {
          icon: '🎉',
          style: {
            borderRadius: '16px',
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        });
      };

      socket.on('receive_private_message', handleReceivePrivateMessage);
      socket.on('message_sent', handleMessageSent);
      socket.on('receive_group_message', handleReceiveGroupMessage);
      socket.on('message_deleted', handleMessageDeleted);
      socket.on('friend_request_received', handleFriendRequestReceived);
      socket.on('friend_request_accepted', handleFriendRequestAccepted);

      return () => {
        socket.off('receive_private_message', handleReceivePrivateMessage);
        socket.off('message_sent', handleMessageSent);
        socket.off('receive_group_message', handleReceiveGroupMessage);
        socket.off('message_deleted', handleMessageDeleted);
        socket.off('friend_request_received', handleFriendRequestReceived);
        socket.off('friend_request_accepted', handleFriendRequestAccepted);
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
