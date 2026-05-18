const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ['voice', 'video', 'game'],
    default: 'voice',
  },
  host: {
    type: String, // 9-digit unique user UID
    required: true,
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
  },
  maxMembers: {
    type: Number,
    default: 8,
  },
  seats: {
    seat1: { type: String, default: null },
    seat2: { type: String, default: null },
    seat3: { type: String, default: null },
    seat4: { type: String, default: null },
    seat5: { type: String, default: null },
    seat6: { type: String, default: null },
    seat7: { type: String, default: null },
    seat8: { type: String, default: null }
  },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  }
}, { timestamps: true });

// Auto-generate 6-digit Room ID
roomSchema.pre('save', async function (next) {
  if (this.isNew && !this.roomId) {
    let isUnique = false;
    while (!isUnique) {
      // Generates a random number between 100000 and 999999
      const generatedId = Math.floor(100000 + Math.random() * 900000).toString();
      const existingRoom = await mongoose.models.Room.findOne({ roomId: generatedId });
      if (!existingRoom) {
        this.roomId = generatedId;
        isUnique = true;
      }
    }
  }
  next();
});

module.exports = mongoose.model('Room', roomSchema);
