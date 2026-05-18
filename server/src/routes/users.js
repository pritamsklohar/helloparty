const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Get all recent conversations
router.get('/chat/conversations', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all private messages involving the current user
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
      groupId: { $exists: false }
    }).sort({ createdAt: -1 });

    const conversationsMap = new Map();

    messages.forEach(msg => {
      const otherUserId = msg.sender.toString() === userId.toString() 
        ? msg.receiver.toString() 
        : msg.sender.toString();

      if (!conversationsMap.has(otherUserId)) {
        conversationsMap.set(otherUserId, msg);
      }
    });

    const conversationUsers = await User.find({
      _id: { $in: Array.from(conversationsMap.keys()) }
    }).select('username avatarUrl uid');

    const privateConversations = await Promise.all(conversationUsers.map(async (user) => {
      const lastMsg = conversationsMap.get(user._id.toString());
      const unreadCount = await Message.countDocuments({
        sender: user._id,
        receiver: userId,
        isRead: false
      });

      return {
        _id: user._id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        uid: user.uid,
        lastMessage: lastMsg.text,
        lastMessageTime: lastMsg.createdAt,
        unreadCount,
        isGroup: false
      };
    }));

    // Fetch groups the user is part of
    const groups = await Group.find({ members: userId });
    const groupConversations = await Promise.all(groups.map(async (group) => {
      const lastGroupMsg = await Message.findOne({ groupId: group._id })
        .sort({ createdAt: -1 })
        .populate('sender', 'username');

      return {
        _id: group._id,
        username: group.name,
        avatarUrl: group.avatarUrl,
        lastMessage: lastGroupMsg ? `${lastGroupMsg.sender.username}: ${lastGroupMsg.text}` : 'Group created',
        lastMessageTime: lastGroupMsg ? lastGroupMsg.createdAt : group.createdAt,
        unreadCount: 0,
        isGroup: true
      };
    }));

    const result = [...privateConversations, ...groupConversations];
    result.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json({ conversations: result });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chat history with another user
router.get('/chat/history/:targetId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.targetId },
        { sender: req.params.targetId, receiver: req.user._id }
      ]
    }).sort({ createdAt: 1 });
    
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all friends
router.get('/friends/all', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'username avatarUrl uid level bio');
    res.json({ friends: user.friends });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { username, bio, avatarUrl, gender, country, dob, inRoom } = req.body;
    const userId = req.user._id;

    // Fetch current user for comparison
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = {};
    
    // Check if username is being changed and if it's already taken
    if (username && username !== currentUser.username) {
      const existingUser = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updateData.username = username;
    }

    // Add other fields if they are provided
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (gender !== undefined) updateData.gender = gender;
    if (country !== undefined) updateData.country = country;
    if (inRoom !== undefined) updateData.inRoom = inRoom;
    
    // Handle date specifically
    if (dob !== undefined) {
      updateData.dob = (dob === '' || dob === null) ? null : dob;
    }

    // Perform update
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash -refreshTokens');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(400).json({ 
      message: error.message || 'Failed to update profile' 
    });
  }
});

// Get user profile by UID
router.get('/:uid', protect, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid })
      .select('-passwordHash -refreshTokens -email');
      
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Determine friend status
    let friendStatus = 'none';
    if (req.user.friends.includes(user._id)) {
      friendStatus = 'friend';
    } else if (req.user.friendRequests.includes(user._id)) {
      friendStatus = 'received';
    } else if (user.friendRequests.includes(req.user._id)) {
      friendStatus = 'sent';
    }

    res.json({ user, friendStatus });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all pending friend requests
router.get('/requests/all', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests', 'username avatarUrl uid');
    res.json({ requests: user.friendRequests });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request
router.post('/send-request/:uid', protect, async (req, res) => {
  try {
    const targetUser = await User.findOne({ uid: req.params.uid });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });
    
    if (targetUser.friendRequests.includes(req.user._id)) {
      return res.status(400).json({ message: 'Request already sent' });
    }
    
    if (req.user.friends.includes(targetUser._id)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    targetUser.friendRequests.push(req.user._id);
    await targetUser.save();
    
    res.json({ message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept friend request
router.post('/accept-request/:id', protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    
    // Check if request exists
    if (!req.user.friendRequests.includes(targetId)) {
      return res.status(400).json({ message: 'No such request' });
    }

    // Add to friends for both
    await User.findByIdAndUpdate(req.user._id, {
      $push: { friends: targetId },
      $pull: { friendRequests: targetId }
    });
    
    await User.findByIdAndUpdate(targetId, {
      $push: { friends: req.user._id }
    });

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject friend request
router.post('/reject-request/:id', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friendRequests: req.params.id }
    });
    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove friend
router.post('/remove-friend/:id', protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friends: targetId }
    });
    
    await User.findByIdAndUpdate(targetId, {
      $pull: { friends: req.user._id }
    });

    res.json({ message: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
