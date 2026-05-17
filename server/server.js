require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const connectDB = require('./src/config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Expose socket server to REST routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Database connection
connectDB();

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/rooms', require('./src/routes/rooms'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/upload', require('./src/routes/upload'));
app.use('/api/memories', require('./src/routes/memories'));
app.use('/api/groups', require('./src/routes/groups'));

// Socket.io handlers
const setupSocket = require('./src/socket');
setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
