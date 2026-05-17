const Room = require('../models/Room');

// In-memory unified state: roomId -> RoomObject
const voiceRooms = new Map();

const updateActiveMembersCount = (room) => {
  let count = room.owner ? 1 : 0;
  count += room.seats.filter(s => s !== null).length;
  count += room.waitingList.length;
  room.activeMembers = count;
};

const getFormattedTime = () => {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
};

const addRoomLog = (room, message) => {
  const time = getFormattedTime();
  room.logs.push({ time, message });
  return `${time} — ${message}`;
};

const voiceRoomHandler = (io, socket) => {

  // 1. Join Room & Initialize Unified State
  socket.on('peer:join_room', async ({ roomId, user }) => {
    try {
      if (!roomId || !user) return;

      socket.join(roomId);
      socket.voiceRoomId = roomId;
      socket.voiceUserHandle = user.username;
      socket.voiceUserObj = user;

      let room = voiceRooms.get(roomId);
      if (!room) {
        // Look up room in DB to resolve actual host
        let dbRoom = null;
        try {
          dbRoom = await Room.findById(roomId).populate('host');
        } catch (dbErr) {
          console.warn("DB Room look up failed:", dbErr.message);
        }

        room = {
          roomId,
          roomName: dbRoom ? dbRoom.name : "Voice Room",
          owner: null,
          seats: Array(8).fill(null), // Seats 1-8
          waitingList: [],
          activeMembers: 0,
          createdAt: Date.now(),
          kickBans: {},
          logs: []
        };
        voiceRooms.set(roomId, room);
      }

      // Check kickBans
      const bannedUntil = room.kickBans[user.username];
      if (bannedUntil && bannedUntil > Date.now()) {
        const remainingMs = bannedUntil - Date.now();
        const min = Math.floor(remainingMs / 60000);
        const sec = Math.ceil((remainingMs % 60000) / 1000);
        socket.emit('voice_room:error', {
          message: `You are kicked from this room. Rejoin in ${min} min ${sec} sec.`
        });
        socket.leave(roomId);
        return;
      }

      // Check if user is already registered in the room map
      let existingUser = null;
      if (room.owner && room.owner.handle === user.username) {
        existingUser = room.owner;
        existingUser.id = socket.id; // update socket.id
      } else {
        for (let i = 0; i < 8; i++) {
          if (room.seats[i] && room.seats[i].handle === user.username) {
            existingUser = room.seats[i];
            existingUser.id = socket.id;
            break;
          }
        }
      }
      if (!existingUser) {
        const waitingIdx = room.waitingList.findIndex(u => u.handle === user.username);
        if (waitingIdx !== -1) {
          existingUser = room.waitingList[waitingIdx];
          existingUser.id = socket.id;
        }
      }

      if (!existingUser) {
        // Determine role: if owner is not yet assigned, first to join (or matching dbRoom host) is owner
        const dbRoom = await Room.findById(roomId).catch(() => null);
        const isDbHost = dbRoom && dbRoom.host && dbRoom.host.toString() === user.userId;
        const isOwnerUser = room.owner === null && (isDbHost || room.activeMembers === 0);

        const newUser = {
          id: socket.id,
          name: user.username,
          handle: user.username,
          avatar: user.avatarUrl || '👤',
          role: isOwnerUser ? 'owner' : 'user',
          status: 'waiting',
          seat: null,
          muted: false,
          selfMuted: false,
          lifted: false,
          joinedAt: Date.now()
        };

        if (isOwnerUser) {
          newUser.status = 'seated';
          newUser.seat = 0;
          room.owner = newUser;
          addRoomLog(room, `${user.username} created/entered the room as owner.`);
        } else {
          // ALWAYS place non-owners on the waiting list upon room entry
          room.waitingList.push(newUser);
          addRoomLog(room, `${user.username} entered the room and joined the waiting list.`);
        }
        updateActiveMembersCount(room);
      }

      // Gather other users in the room (socketId, user details)
      const otherUsers = [];
      if (room.owner && room.owner.id !== socket.id) {
        otherUsers.push({
          socketId: room.owner.id,
          user: {
            userId: room.owner.handle,
            username: room.owner.name,
            avatarUrl: room.owner.avatar
          }
        });
      }
      room.seats.forEach(u => {
        if (u && u.id !== socket.id) {
          otherUsers.push({
            socketId: u.id,
            user: {
              userId: u.handle,
              username: u.name,
              avatarUrl: u.avatar
            }
          });
        }
      });
      room.waitingList.forEach(u => {
        if (u && u.id !== socket.id) {
          otherUsers.push({
            socketId: u.id,
            user: {
              userId: u.handle,
              username: u.name,
              avatarUrl: u.avatar
            }
          });
        }
      });

      // Respond to the joining peer with other users and seats
      socket.emit('peer:existing_users', {
        users: otherUsers,
        seats: room.seats.map(u => u ? u.id : null)
      });

      // Broadcast to other users in room
      socket.to(roomId).emit('peer:new_user_joined', {
        socketId: socket.id,
        user: {
          userId: user.username,
          username: user.username,
          avatarUrl: user.avatarUrl
        }
      });

      // Broadcast seats updated to everyone
      io.in(roomId).emit('peer:seats_updated', {
        seats: room.seats.map(u => u ? u.id : null)
      });

    } catch (err) {
      console.error("Error in peer:join_room:", err.message);
    }
  });

  // 2. Sit Down handler
  socket.on('peer:sit_down', ({ roomId, seatIndex }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return;

      // If already sitting somewhere, clear that first
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].id === socket.id) {
          room.seats[i] = null;
        }
      }

      // Find user in waitingList
      const waitingIdx = room.waitingList.findIndex(u => u.id === socket.id);
      let user = null;
      if (waitingIdx !== -1) {
        user = room.waitingList[waitingIdx];
        room.waitingList.splice(waitingIdx, 1);
      } else {
        // Fallback user if not in waiting list
        user = {
          id: socket.id,
          name: socket.voiceUserHandle || "Guest",
          handle: socket.voiceUserHandle || "Guest",
          avatar: socket.voiceUserObj?.avatarUrl || '👤',
          role: 'user',
          status: 'seated',
          seat: seatIndex + 1,
          muted: false,
          selfMuted: false,
          lifted: false,
          joinedAt: Date.now()
        };
      }

      user.status = 'seated';
      user.seat = seatIndex + 1;
      room.seats[seatIndex] = user;

      addRoomLog(room, `${user.name} sat down in seat ${seatIndex + 1}.`);
      updateActiveMembersCount(room);

      // Broadcast updated seats to all participants in real-time
      io.in(roomId).emit('peer:seats_updated', {
        seats: room.seats.map(u => u ? u.id : null)
      });
    } catch (err) {
      console.error("Error in peer:sit_down:", err.message);
    }
  });

  // 3. Stand Up handler
  socket.on('peer:stand_up', ({ roomId }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return;

      let user = null;
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].id === socket.id) {
          user = room.seats[i];
          room.seats[i] = null;
          break;
        }
      }

      if (user) {
        user.status = 'waiting';
        user.seat = null;
        room.waitingList.push(user);

        addRoomLog(room, `${user.name} stood up from seat.`);
        updateActiveMembersCount(room);

        // Broadcast updated seats in real-time
        io.in(roomId).emit('peer:seats_updated', {
          seats: room.seats.map(u => u ? u.id : null)
        });
      }
    } catch (err) {
      console.error("Error in peer:stand_up:", err.message);
    }
  });

  // 4. Send Message handler
  socket.on('peer:send_message', ({ roomId, message }) => {
    try {
      socket.to(roomId).emit('peer:receive_message', {
        id: Date.now().toString(),
        type: 'TEXT',
        sender: {
          username: socket.voiceUserHandle || "Guest"
        },
        content: message
      });
    } catch (err) {
      console.error("Error in send message:", err.message);
    }
  });

  // 5. Clean exit or sudden disconnect
  const exitUser = (roomId, socketId) => {
    const room = voiceRooms.get(roomId);
    if (!room) return;

    let exitedUser = null;
    let oldOwnerName = room.owner ? room.owner.name : null;

    // Check if owner disconnected
    if (room.owner && room.owner.id === socketId) {
      exitedUser = room.owner;
      room.owner = null;

      // Promotion Priority:
      // 1st -> Seated user (lowest occupied seat 1-8)
      let newOwnerCandidate = null;
      let promotedFrom = null;
      let originalSeatNum = null;

      for (let i = 0; i < 8; i++) {
        if (room.seats[i] !== null) {
          newOwnerCandidate = room.seats[i];
          promotedFrom = 'seat';
          originalSeatNum = i + 1;
          room.seats[i] = null;
          break;
        }
      }

      // 2nd -> First in waiting list
      if (!newOwnerCandidate && room.waitingList.length > 0) {
        newOwnerCandidate = room.waitingList[0];
        promotedFrom = 'waitingList';
        room.waitingList.splice(0, 1);
      }

      if (newOwnerCandidate) {
        newOwnerCandidate.role = 'owner';
        newOwnerCandidate.status = 'seated';
        newOwnerCandidate.seat = 0;
        room.owner = newOwnerCandidate;

        if (promotedFrom === 'seat') {
          addRoomLog(room, `${oldOwnerName} left. ${newOwnerCandidate.name} promoted from seat ${originalSeatNum} to owner.`);
        } else {
          addRoomLog(room, `${oldOwnerName} left. ${newOwnerCandidate.name} promoted from waiting list to owner.`);
        }
      } else {
        // Close Room
        addRoomLog(room, `Owner left. No members remaining — room closed.`);
        voiceRooms.delete(roomId);
      }
    } else {
      // Check seated users
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].id === socketId) {
          exitedUser = room.seats[i];
          room.seats[i] = null;
          break;
        }
      }

      // Check waiting list
      if (!exitedUser) {
        const waitingIdx = room.waitingList.findIndex(u => u.id === socketId);
        if (waitingIdx !== -1) {
          exitedUser = room.waitingList[waitingIdx];
          room.waitingList.splice(waitingIdx, 1);
        }
      }

      if (exitedUser) {
        addRoomLog(room, `${exitedUser.name} left the room.`);
      }
    }

    updateActiveMembersCount(room);

    // Broadcast seats updated
    io.in(roomId).emit('peer:seats_updated', {
      seats: room.seats.map(u => u ? u.id : null)
    });

    // Notify user left
    io.in(roomId).emit('peer:user_left', { userId: socketId });
  };

  socket.on('peer:leave_room', ({ roomId }) => {
    try {
      exitUser(roomId, socket.id);
      socket.leave(roomId);
      socket.voiceRoomId = null;
      socket.voiceUserHandle = null;
    } catch (err) {
      console.error("Error in peer:leave_room:", err.message);
    }
  });

  socket.on('disconnecting', () => {
    try {
      Array.from(socket.rooms).forEach(roomId => {
        if (roomId !== socket.id) {
          exitUser(roomId, socket.id);
        }
      });
    } catch (err) {
      console.error("Error in disconnect cleaner:", err.message);
    }
  });
};

module.exports = voiceRoomHandler;
