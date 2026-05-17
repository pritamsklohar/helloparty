const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const router = express.Router();

const upload = require('../middleware/upload');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const cloudinary = require('../config/cloudinary');

router.post('/register', upload.single('avatar'), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    let avatarUrl;

    if (req.file) {
      avatarUrl = req.file.path;
    } else {
      // If no file, generate Dicebear and upload to Cloudinary for persistence
      const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${username}`;
      const uploadResponse = await cloudinary.uploader.upload(dicebearUrl, {
        folder: 'helloparty_avatars',
        transformation: [{ width: 200, height: 200, crop: 'limit' }]
      });
      avatarUrl = uploadResponse.secure_url;
    }
    
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    user = new User({ username, email, passwordHash, avatarUrl });
    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      accessToken,
      user: { id: user._id, uid: user.uid, username: user.username, email: user.email, avatarUrl: user.avatarUrl, coins: user.coins }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      user: { id: user._id, uid: user.uid, username: user.username, email: user.email, avatarUrl: user.avatarUrl, coins: user.coins }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', protect, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      req.user.refreshTokens = req.user.refreshTokens.filter(t => t !== refreshToken);
      await req.user.save();
    }
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const newAccessToken = jwt.sign({ id: user._id }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

module.exports = router;
