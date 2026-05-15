const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, unique: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  bio: { 
    type: String, 
    default: '',
    validate: {
      validator: function(v) {
        if (!v) return true;
        return v.trim().split(/\s+/).filter(word => word.length > 0).length <= 50;
      },
      message: 'Bio cannot exceed 50 words!'
    }
  },
  gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
  country: { type: String, default: '' },
  dob: { type: Date },
  coins: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    roomsJoined: { type: Number, default: 0 }
  },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  refreshTokens: [{ type: String }]
}, { timestamps: true });

// Auto-generate 9-digit UID for new users
userSchema.pre('save', async function (next) {
  if (this.isNew && !this.uid) {
    let isUnique = false;
    while (!isUnique) {
      // Generates a random number between 100000000 and 999999999
      const generatedUid = Math.floor(100000000 + Math.random() * 900000000).toString();
      const existingUser = await mongoose.models.User.findOne({ uid: generatedUid });
      if (!existingUser) {
        this.uid = generatedUid;
        isUnique = true;
      }
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
