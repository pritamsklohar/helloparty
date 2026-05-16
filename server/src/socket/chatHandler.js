const Message = require('../models/Message');

const onlineUsers = new Map(); // userId -> socketId

const chatHandler = (io, socket) => {
  // Join personal room based on user ID
  socket.on('join_personal', (userId) => {
    if (!userId || userId === 'null' || userId === 'undefined') {
      console.warn(`Socket ${socket.id} tried to join as null user`);
      return;
    }

    socket.join(`user_${userId}`);
    socket.userId = userId;
    onlineUsers.set(userId, socket.id);
    
    // Broadcast that this user is online to everyone
    io.emit('user_status_change', { userId, status: 'online' });
    console.log(`User ${userId} is online`);
  });

  // Check if a user is online
  socket.on('check_online_status', (userId) => {
    if (!userId) return;
    const isOnline = onlineUsers.has(userId);
    socket.emit('user_status_res', { userId, isOnline });
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { senderId, receiverId } = data;
    if (!senderId || !receiverId) return;
    io.to(`user_${receiverId}`).emit('user_typing_status', { userId: senderId, isTyping: true });
  });

  socket.on('typing_stop', (data) => {
    const { senderId, receiverId } = data;
    if (!senderId || !receiverId) return;
    io.to(`user_${receiverId}`).emit('user_typing_status', { userId: senderId, isTyping: false });
  });

  // Handle private message
  socket.on('send_private_message', async (data) => {
    try {
      const { senderId, receiverId, text } = data;
      
      if (!senderId || !receiverId || !text) {
        return console.error('Invalid private message data:', data);
      }
      
      // Save message to DB
      const newMessage = new Message({
        sender: senderId,
        receiver: receiverId,
        text
      });
      await newMessage.save();

      const messageData = {
        _id: newMessage._id,
        sender: senderId,
        receiver: receiverId,
        text,
        createdAt: newMessage.createdAt,
        isRead: false
      };

      // Emit to receiver's personal room
      io.to(`user_${receiverId}`).emit('receive_private_message', messageData);
      
      // Emit back to sender as confirmation
      socket.emit('message_sent', messageData);
      
    } catch (error) {
      console.error('Error sending message:', error.message);
    }
  });

  // Handle marking messages as read
  socket.on('mark_as_read', async (data) => {
    try {
      const { senderId, receiverId } = data;
      if (!senderId || !receiverId) return;
      
      await Message.updateMany(
        { sender: senderId, receiver: receiverId, isRead: false },
        { isRead: true }
      );
      
      // Notify the original sender that their messages were seen
      io.to(`user_${senderId}`).emit('messages_seen', { seenBy: receiverId });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  });

  // Handle unsending a message
  socket.on('unsend_message', async (data) => {
    try {
      const { messageId, senderId, receiverId } = data;
      if (!messageId || !senderId) return;
      
      const message = await Message.findById(messageId);
      if (!message || message.sender.toString() !== senderId) return;

      await Message.findByIdAndDelete(messageId);

      // Notify both parties
      io.to(`user_${senderId}`).emit('message_deleted', { messageId });
      if (receiverId) io.to(`user_${receiverId}`).emit('message_deleted', { messageId });
    } catch (error) {
      console.error('Error unsending message:', error);
    }
  });

  // Group Chat Events
  socket.on('join_group', (groupId) => {
    if (!groupId) return;
    socket.join(`group_${groupId}`);
    console.log(`Socket ${socket.id} joined group_${groupId}`);
  });

  socket.on('leave_group', (groupId) => {
    if (!groupId) return;
    socket.leave(`group_${groupId}`);
    console.log(`Socket ${socket.id} left group_${groupId}`);
  });

  socket.on('send_group_message', async (data) => {
    try {
      const { groupId, senderId, text } = data;
      
      if (!groupId || !senderId || !text) {
        return console.error('Invalid group message data:', data);
      }
      
      const message = await Message.create({
        sender: senderId,
        groupId,
        text
      });

      const populatedMessage = await Message.findById(message._id).populate('sender', 'username avatarUrl');
      
      // Emit to everyone in the group room
      io.to(`group_${groupId}`).emit('receive_group_message', populatedMessage);
      
    } catch (error) {
      console.error('Error sending group message:', error.message);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('user_status_change', { userId: socket.userId, status: 'offline' });
      console.log(`User ${socket.userId} went offline`);
    }
  });
};

module.exports = chatHandler;
