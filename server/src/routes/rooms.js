const express = require('express');
const Room = require('../models/Room');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({ status: 'active' })
      .populate('host', 'username avatarUrl')
      .sort('-createdAt');
    res.json(rooms);
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
      host: req.user._id,
      members: [req.user._id]
    });
    
    await room.save();
    
    // Populate host info before returning so frontend has it immediately
    await room.populate('host', 'username avatarUrl');
    
    // Broadcast room creation in real-time
    if (req.io) {
      req.io.emit('room_created', room);
    }
    
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('host', 'username avatarUrl')
      .populate('members', 'username avatarUrl level');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // Only host can close the room
    if (room.host.toString() !== req.user._id.toString()) {
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
