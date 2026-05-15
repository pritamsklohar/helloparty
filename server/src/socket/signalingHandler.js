const roomSeats = new Map(); // roomId -> Array(8).fill(null)
const socketToUser = new Map(); // socket.id -> { userId, username, avatarUrl }

const signalingHandler = (io, socket) => {
  // Join a room for signaling
  socket.on('peer:join_room', ({ roomId, user }) => {
    socket.join(roomId);
    socketToUser.set(socket.id, user);
    
    // Get seats for this room
    if (!roomSeats.has(roomId)) {
      roomSeats.set(roomId, Array(8).fill(null));
    }
    const currentSeats = roomSeats.get(roomId);
    
    // Get users in room (excluding self)
    const room = io.sockets.adapter.rooms.get(roomId);
    const users = [];
    if (room) {
      room.forEach(socketId => {
        if (socketId !== socket.id) {
          users.push({ socketId, user: socketToUser.get(socketId) });
        }
      });
    }
    
    // Send existing users and current seats to the joining user
    socket.emit('peer:existing_users', { users, seats: currentSeats });
    
    // Notify others that a new user joined
    socket.to(roomId).emit('peer:new_user_joined', { socketId: socket.id, user });
  });

  // Seat Management
  socket.on('peer:sit_down', ({ roomId, seatIndex }) => {
    const currentSeats = roomSeats.get(roomId) || Array(8).fill(null);
    
    // Clear user from any other seat first
    for (let i = 0; i < 8; i++) {
      if (currentSeats[i] === socket.id) currentSeats[i] = null;
    }
    
    // Set new seat if empty
    if (currentSeats[seatIndex] === null) {
      currentSeats[seatIndex] = socket.id;
      roomSeats.set(roomId, currentSeats);
      io.in(roomId).emit('peer:seats_updated', { seats: currentSeats });
    }
  });

  socket.on('peer:stand_up', ({ roomId }) => {
    const currentSeats = roomSeats.get(roomId) || Array(8).fill(null);
    for (let i = 0; i < 8; i++) {
      if (currentSeats[i] === socket.id) currentSeats[i] = null;
    }
    roomSeats.set(roomId, currentSeats);
    io.in(roomId).emit('peer:seats_updated', { seats: currentSeats });
  });

  // Mute state
  socket.on('peer:mute_state', ({ roomId, isMuted }) => {
    socket.to(roomId).emit('peer:mute_updated', { socketId: socket.id, isMuted });
  });

  // Room Messaging
  socket.on('peer:send_message', ({ roomId, message }) => {
    socket.to(roomId).emit('peer:receive_message', {
      id: Date.now().toString(),
      type: 'TEXT',
      sender: socketToUser.get(socket.id),
      content: message
    });
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
    
    // Clear seat
    const currentSeats = roomSeats.get(roomId);
    if (currentSeats) {
      for (let i = 0; i < 8; i++) {
        if (currentSeats[i] === socket.id) currentSeats[i] = null;
      }
      io.in(roomId).emit('peer:seats_updated', { seats: currentSeats });
    }
    
    socket.to(roomId).emit('peer:user_left', { userId: socket.id });
    socketToUser.delete(socket.id);
  });

  // On disconnect, notify all rooms the user was in
  socket.on('disconnecting', () => {
    Array.from(socket.rooms).forEach(roomId => {
      if (roomId !== socket.id) {
        const currentSeats = roomSeats.get(roomId);
        if (currentSeats) {
          for (let i = 0; i < 8; i++) {
            if (currentSeats[i] === socket.id) currentSeats[i] = null;
          }
          io.in(roomId).emit('peer:seats_updated', { seats: currentSeats });
        }
        socket.to(roomId).emit('peer:user_left', { userId: socket.id });
      }
    });
    socketToUser.delete(socket.id);
  });
};

module.exports = signalingHandler;
