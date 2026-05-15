const express = require('express');
const router = express.Router();
const Memory = require('../models/Memory');
const { protect } = require('../middleware/auth');

// Get memories for a specific user
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.json([]); // Return empty if ID is not an ObjectId (like a UID)
    }
    const memories = await Memory.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('user', 'username avatarUrl uid')
      .populate('comments.user', 'username avatarUrl')
      .populate('comments.replies.user', 'username avatarUrl');
    res.json(memories);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user memories' });
  }
});

// Create memory
router.post('/', protect, async (req, res) => {
  try {
    const { content, imageUrls } = req.body;
    if (!content && (!imageUrls || imageUrls.length === 0)) {
      return res.status(400).json({ message: 'Content or image is required' });
    }

    const memory = await Memory.create({
      user: req.user._id,
      content: content || '',
      imageUrls: imageUrls || []
    });

    res.status(201).json(memory);
  } catch (error) {
    console.error('Create memory error:', error);
    res.status(500).json({ message: 'Failed to create memory' });
  }
});

// Get all memories for current user
router.get('/me', protect, async (req, res) => {
  try {
    const memories = await Memory.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('user', 'username avatarUrl uid')
      .populate('comments.user', 'username avatarUrl')
      .populate('comments.replies.user', 'username avatarUrl');
    res.json(memories);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch memories' });
  }
});

// Delete a memory
router.delete('/:id', protect, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    if (!memory) return res.status(404).json({ message: 'Memory not found' });

    // Check ownership
    if (memory.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await memory.deleteOne();
    res.json({ message: 'Memory removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete memory' });
  }
});

// Toggle like on a memory
router.post('/:id/like', protect, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    if (!memory) return res.status(404).json({ message: 'Memory not found' });

    const likeIndex = memory.likes.indexOf(req.user._id);
    if (likeIndex === -1) {
      memory.likes.push(req.user._id);
    } else {
      memory.likes.splice(likeIndex, 1);
    }

    await memory.save();
    res.json(memory);
  } catch (error) {
    res.status(500).json({ message: 'Failed to like memory' });
  }
});

// Comment on a memory
router.post('/:id/comment', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Comment text is required' });

    const memory = await Memory.findById(req.params.id);
    if (!memory) return res.status(404).json({ message: 'Memory not found' });

    memory.comments.push({
      user: req.user._id,
      text
    });

    await memory.save();
    
    // Return populated memory
    const updatedMemory = await Memory.findById(req.params.id)
      .populate('comments.user', 'username avatarUrl')
      .populate('comments.replies.user', 'username avatarUrl');
    res.json(updatedMemory);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// Reply to a comment
router.post('/:id/comment/:commentId/reply', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Reply text is required' });

    const memory = await Memory.findById(req.params.id);
    if (!memory) return res.status(404).json({ message: 'Memory not found' });

    const comment = memory.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    comment.replies.push({
      user: req.user._id,
      text
    });

    await memory.save();
    
    const updatedMemory = await Memory.findById(req.params.id)
      .populate('comments.user', 'username avatarUrl')
      .populate('comments.replies.user', 'username avatarUrl');
    res.json(updatedMemory);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add reply' });
  }
});

module.exports = router;
