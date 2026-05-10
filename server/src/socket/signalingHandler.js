const signalingHandler = (io, socket) => {
  // Join a room for signaling
  socket.on('peer:join_room', ({ roomId }) => {
    socket.join(roomId);
    
    // Get users in room (excluding self)
    const room = io.sockets.adapter.rooms.get(roomId);
    const users = room ? Array.from(room).filter(id => id !== socket.id) : [];
    
    // Send existing users to the joining user
    socket.emit('peer:existing_users', { users });
    
    // Notify others that a new user joined
    socket.to(roomId).emit('peer:new_user_joined', { userId: socket.id });
  });

  // Relay offer
  socket.on('peer:offer', ({ targetUserId, sdp }) => {
    io.to(targetUserId).emit('peer:offer', { sdp, fromUserId: socket.id });
  });

  // Relay answer
  socket.on('peer:answer', ({ targetUserId, sdp }) => {
    io.to(targetUserId).emit('peer:answer', { sdp, fromUserId: socket.id });
  });

  // Relay ICE candidate
  socket.on('peer:ice_candidate', ({ targetUserId, candidate }) => {
    io.to(targetUserId).emit('peer:ice_candidate', { candidate, fromUserId: socket.id });
  });

  // Leave room manually
  socket.on('peer:leave_room', ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit('peer:user_left', { userId: socket.id });
  });

  // Mute state
  socket.on('peer:mute_state', ({ roomId, isMuted }) => {
    socket.to(roomId).emit('peer:mute_updated', { userId: socket.id, isMuted });
  });

  // On disconnect, notify all rooms the user was in
  socket.on('disconnecting', () => {
    Array.from(socket.rooms).forEach(roomId => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit('peer:user_left', { userId: socket.id });
      }
    });
  });
};

module.exports = signalingHandler;
