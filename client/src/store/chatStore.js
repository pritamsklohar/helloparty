import { create } from 'zustand';
import api from '../services/api';
import useAuthStore from './authStore';

const useChatStore = create((set, get) => ({
  conversations: [],
  // Map of chatId (either userId for direct chat or groupId for group chat) -> array of messages
  messagesCache: {},
  // Caching user profiles and group metadata
  usersCache: {},
  groupsCache: {},
  loadingConversations: false,
  loadingMessages: {},
  loadingUsers: {},
  loadingGroups: {},

  // Fetch individual user detail with cache support
  fetchUserDetail: async (uid, silent = false) => {
    if (!silent) {
      set((state) => ({
        loadingUsers: { ...state.loadingUsers, [uid]: true }
      }));
    }
    try {
      const res = await api.get(`/users/${uid}`);
      const userProfile = {
        ...res.data.user,
        friendStatus: res.data.friendStatus
      };
      set((state) => ({
        usersCache: {
          ...state.usersCache,
          [uid]: userProfile,
          [userProfile._id]: userProfile
        },
        loadingUsers: { ...state.loadingUsers, [uid]: false }
      }));
      return userProfile;
    } catch (err) {
      console.error(`Error fetching user profile ${uid}:`, err);
      set((state) => ({
        loadingUsers: { ...state.loadingUsers, [uid]: false }
      }));
      throw err;
    }
  },

  // Fetch group detail with cache support
  fetchGroupDetail: async (groupId, silent = false) => {
    if (!silent) {
      set((state) => ({
        loadingGroups: { ...state.loadingGroups, [groupId]: true }
      }));
    }
    try {
      const res = await api.get(`/groups/${groupId}`);
      const groupData = res.data;
      set((state) => ({
        groupsCache: { ...state.groupsCache, [groupId]: groupData },
        loadingGroups: { ...state.loadingGroups, [groupId]: false }
      }));
      return groupData;
    } catch (err) {
      console.error(`Error fetching group metadata ${groupId}:`, err);
      set((state) => ({
        loadingGroups: { ...state.loadingGroups, [groupId]: false }
      }));
      throw err;
    }
  },

  // Fetch all conversations in the background
  fetchConversations: async (silent = false) => {
    if (!silent) set({ loadingConversations: true });
    try {
      const res = await api.get('/users/chat/conversations');
      const conversations = res.data.conversations;
      
      set((state) => {
        const newUsers = { ...state.usersCache };
        const newGroups = { ...state.groupsCache };
        
        conversations.forEach((conv) => {
          if (conv.isGroup) {
            newGroups[conv._id] = conv;
          } else if (conv.uid) {
            // Prepopulate user cache with existing conversation details to make transitions 0ms!
            const userProfile = {
              _id: conv._id,
              uid: conv.uid,
              username: conv.username,
              avatarUrl: conv.avatarUrl
            };
            newUsers[conv.uid] = userProfile;
            newUsers[conv._id] = userProfile;
          }
        });
        
        return {
          conversations,
          usersCache: newUsers,
          groupsCache: newGroups,
          loadingConversations: false
        };
      });
    } catch (err) {
      console.error('Error fetching conversations:', err);
      set({ loadingConversations: false });
    }
  },

  // Fetch private chat history for a user
  fetchPrivateHistory: async (userId, silent = false) => {
    if (!silent) {
      set((state) => ({
        loadingMessages: { ...state.loadingMessages, [userId]: true }
      }));
    }
    try {
      const res = await api.get(`/users/chat/history/${userId}`);
      const messages = res.data.messages;
      set((state) => ({
        messagesCache: { ...state.messagesCache, [userId]: messages },
        loadingMessages: { ...state.loadingMessages, [userId]: false }
      }));
    } catch (err) {
      console.error(`Error fetching history for user ${userId}:`, err);
      set((state) => ({
        loadingMessages: { ...state.loadingMessages, [userId]: false }
      }));
    }
  },

  // Fetch group chat history
  fetchGroupHistory: async (groupId, silent = false) => {
    if (!silent) {
      set((state) => ({
        loadingMessages: { ...state.loadingMessages, [groupId]: true }
      }));
    }
    try {
      const res = await api.get(`/groups/${groupId}/messages`);
      const messages = res.data;
      set((state) => ({
        messagesCache: { ...state.messagesCache, [groupId]: messages },
        loadingMessages: { ...state.loadingMessages, [groupId]: false }
      }));
    } catch (err) {
      console.error(`Error fetching history for group ${groupId}:`, err);
      set((state) => ({
        loadingMessages: { ...state.loadingMessages, [groupId]: false }
      }));
    }
  },

  // Add a new incoming/outgoing message to the cache
  addMessage: (chatId, message, isActive = false) => {
    set((state) => {
      const currentMessages = state.messagesCache[chatId] || [];
      // Prevent duplicates
      if (currentMessages.some((m) => (m._id && m._id === message._id) || (m.id && m.id === message.id))) {
        return state;
      }
      
      const finalMessage = isActive ? { ...message, isRead: true } : message;
      
      return {
        messagesCache: {
          ...state.messagesCache,
          [chatId]: [...currentMessages, finalMessage]
        }
      };
    });

    // Also trigger update to the conversations list in local state to keep it real-time
    get().updateConversationLastMessage(chatId, message, isActive);
  },

  // Locally delete/unsend a message from the cache
  removeMessage: (chatId, messageId) => {
    set((state) => {
      const currentMessages = state.messagesCache[chatId] || [];
      return {
        messagesCache: {
          ...state.messagesCache,
          [chatId]: currentMessages.filter((m) => (m._id || m.id) !== messageId)
        }
      };
    });
  },

  // Helper to dynamically update the last message & unread status in the local conversation list
  updateConversationLastMessage: (chatId, message, isActive = false) => {
    // If the conversation is new and does not exist in the local array, fetch in the background to add it
    const exists = get().conversations.some((conv) => conv._id === chatId || conv.uid === chatId || conv.id === chatId);
    if (!exists) {
      setTimeout(() => {
        get().fetchConversations(true);
      }, 300);
      return;
    }

    set((state) => {
      const conversations = state.conversations.map((conv) => {
        // Match either direct chat (using uid or _id) or group chat
        const isMatch = conv._id === chatId || conv.uid === chatId || conv.id === chatId;
        if (isMatch) {
          return {
            ...conv,
            lastMessage: message.text || message.content || '',
            lastMessageTime: message.createdAt || new Date().toISOString(),
            unreadCount: (
              isActive || 
              message.isOwn || 
              message.sender === useAuthStore.getState().user?._id ||
              message.sender === useAuthStore.getState().user?.id ||
              message.sender === get().conversations.find(c => c._id === chatId)?.uid
            ) ? 0 : (conv.unreadCount || 0) + 1
          };
        }
        return conv;
      });

      // Sort conversations so the one with the newest message rises to the top
      const sortedConversations = [...conversations].sort(
        (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      );

      return { conversations: sortedConversations };
    });
  },

  // Clear unread count for a conversation locally
  clearUnreadCount: (chatId) => {
    set((state) => ({
      conversations: state.conversations.map((conv) => {
        const isMatch = conv._id === chatId || conv.uid === chatId || conv.id === chatId;
        if (isMatch) {
          return { ...conv, unreadCount: 0 };
        }
        return conv;
      })
    }));
  }
}));

export default useChatStore;
