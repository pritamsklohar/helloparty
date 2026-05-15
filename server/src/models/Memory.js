const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  imageUrls: [{ type: String }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String },
    createdAt: { type: Date, default: Date.now },
    replies: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: { type: String },
      createdAt: { type: Date, default: Date.now }
    }]
  }]
}, { timestamps: true });

module.exports = mongoose.model('Memory', memorySchema);
