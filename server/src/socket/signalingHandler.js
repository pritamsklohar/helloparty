const signalingHandler = (io, socket) => {
  // Relay WebRTC offer to target peer
  socket.on('peer:offer', ({ targetUserId, sdp }) => {
    io.to(targetUserId).emit('peer:offer', { sdp, fromUserId: socket.id });
  });

  // Relay WebRTC answer to target peer
  socket.on('peer:answer', ({ targetUserId, sdp }) => {
    io.to(targetUserId).emit('peer:answer', { sdp, fromUserId: socket.id });
  });

  // Relay WebRTC ICE candidate to target peer
  socket.on('peer:ice_candidate', ({ targetUserId, candidate }) => {
    io.to(targetUserId).emit('peer:ice_candidate', { candidate, fromUserId: socket.id });
  });
};

module.exports = signalingHandler;
