const express = require('express');
const Room = require('../models/Room');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({ status: 'active' }).sort('-createdAt');
    const populatedRooms = await Promise.all(rooms.map(async (room) => {
      const roomObj = room.toObject();
      const hostUser = await User.findOne({ uid: room.host }, 'username avatarUrl uid');
      if (hostUser) {
        roomObj.host = {
          _id: hostUser._id,
          id: hostUser._id,
          uid: hostUser.uid,
          username: hostUser.username,
          avatarUrl: hostUser.avatarUrl
        };
      } else {
        roomObj.host = null;
      }
      return roomObj;
    }));
    res.json(populatedRooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { name, category, isPrivate, password } = req.body;
    
    // Check if the user is already in a room session
    if (req.user.inRoom) {
      return res.status(400).json({ message: 'You are already in an active room session! Exit it first.' });
    }
    
    const room = new Room({
      name,
      category: category || 'voice',
      isPrivate: !!isPrivate,
      password: isPrivate ? password : '',
      host: req.user.uid,
      seats: {
        seat1: null,
        seat2: null,
        seat3: null,
        seat4: null,
        seat5: null,
        seat6: null,
        seat7: null,
        seat8: null
      }
    });
    
    await room.save();
    
    const roomObj = room.toObject();
    roomObj.host = {
      _id: req.user._id,
      id: req.user._id,
      uid: req.user.uid,
      username: req.user.username,
      avatarUrl: req.user.avatarUrl
    };
    
    // Broadcast room creation in real-time
    if (req.io) {
      req.io.emit('room_created', roomObj);
    }
    
    res.status(201).json(roomObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    const roomObj = room.toObject();
    const hostUser = await User.findOne({ uid: room.host }, 'username avatarUrl uid');
    if (hostUser) {
      roomObj.host = {
        _id: hostUser._id,
        id: hostUser._id,
        uid: hostUser.uid,
        username: hostUser.username,
        avatarUrl: hostUser.avatarUrl
      };
    } else {
      roomObj.host = null;
    }
    
    res.json(roomObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // Only host can close the room
    if (room.host !== req.user.uid) {
      return res.status(403).json({ message: 'Only the host can close this room' });
    }

    await Room.findByIdAndDelete(req.params.id);
    
    // Remove the inRoom field from any users currently registered in this room
    await User.updateMany({ inRoom: req.params.id }, { inRoom: null });
    
    // Broadcast room deletion in real-time
    if (req.io) {
      req.io.emit('room_deleted', req.params.id);
    }
    
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
