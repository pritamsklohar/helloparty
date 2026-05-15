const signalingHandler = require('./signalingHandler');
const chatHandler = require('./chatHandler');

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Pass socket to specific feature handlers
    signalingHandler(io, socket);
    chatHandler(io, socket);

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = setupSocket;
