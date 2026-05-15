const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');

// Create a new group
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, avatarUrl, members } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    const allMembers = [req.user._id, ...(members || [])];
    const group = await Group.create({
      name,
      description,
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`,
      creator: req.user._id,
      members: allMembers,
      admins: [req.user._id]
    });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create group' });
  }
});

// Transfer Ownership
router.put('/:id/owner', protect, async (req, res) => {
  try {
    const { newOwnerId } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owner can transfer ownership' });
    }

    group.creator = newOwnerId;
    // Ensure new owner is an admin
    if (!group.admins.includes(newOwnerId)) {
      group.admins.push(newOwnerId);
    }
    await group.save();
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Failed to transfer ownership' });
  }
});

// Remove a member
router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isOwner = group.creator.toString() === req.user._id.toString();
    const isAdmin = group.admins.includes(req.user._id);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    group.members = group.members.filter(m => m.toString() !== req.params.userId);
    group.admins = group.admins.filter(a => a.toString() !== req.params.userId);
    await group.save();
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove member' });
  }
});

// Leave Group
router.post('/:id/leave', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.creator.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Owner cannot leave without transferring ownership' });
    }

    group.members = group.members.filter(m => m.toString() !== req.user._id.toString());
    group.admins = group.admins.filter(a => a.toString() !== req.user._id.toString());
    await group.save();
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to leave group' });
  }
});

// Dismiss Group (Delete)
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only owner can dismiss group' });
    }

    await Group.findByIdAndDelete(req.params.id);
    await Message.deleteMany({ groupId: req.params.id });
    res.json({ message: 'Group dismissed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to dismiss group' });
  }
});

// Add members to group
router.post('/:id/members', protect, async (req, res) => {
  try {
    const { memberIds } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isAdmin = group.admins.includes(req.user._id) || group.creator.toString() === req.user._id.toString();
    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    memberIds.forEach(id => {
      if (!group.members.includes(id)) {
        group.members.push(id);
      }
    });

    await group.save();
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add members' });
  }
});

// Get a single group
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'username avatarUrl uid')
      .populate('creator', 'username avatarUrl uid');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch group' });
  }
});

// Get all groups
router.get('/', protect, async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('members', 'username avatarUrl')
      .populate('creator', 'username avatarUrl')
      .sort({ updatedAt: -1 });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

// Get groups I am a member of
router.get('/my', protect, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('members', 'username avatarUrl')
      .populate('lastMessage.sender', 'username')
      .sort({ updatedAt: -1 });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch your groups' });
  }
});

// Join a group
router.post('/:id/join', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    if (group.members.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already a member' });
    }

    group.members.push(req.user._id);
    await group.save();
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: 'Failed to join group' });
  }
});

// Send message to group
router.post('/:id/messages', protect, async (req, res) => {
  try {
    const { text } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const message = await Message.create({
      sender: req.user._id,
      groupId: req.params.id,
      text
    });

    group.lastMessage = {
      text,
      sender: req.user._id,
      createdAt: new Date()
    };
    await group.save();

    const populatedMessage = await Message.findById(message._id).populate('sender', 'username avatarUrl');
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// Get group messages
router.get('/:id/messages', protect, async (req, res) => {
  try {
    const messages = await Message.find({ groupId: req.params.id })
      .populate('sender', 'username avatarUrl')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

module.exports = router;
