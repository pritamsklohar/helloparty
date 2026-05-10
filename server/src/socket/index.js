const signalingHandler = require('./signalingHandler');

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Pass socket to specific feature handlers
    signalingHandler(io, socket);

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = setupSocket;
