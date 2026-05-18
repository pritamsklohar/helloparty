const Room = require('../models/Room');
const User = require('../models/User');

// In-memory unified state: roomId -> RoomObject
const voiceRooms = new Map();
const ownerDisconnectTimeouts = new Map(); // roomId -> TimeoutObject

const updateActiveMembersCount = (room, roomId = null, io = null) => {
  let count = room.owner ? 1 : 0;
  count += room.seats.filter(s => s !== null).length;
  count += room.waitingList.length;
  room.activeMembers = count;
  if (io && roomId) {
    io.emit('room_count_updated', { roomId, activeMembersCount: count });
  }
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

const broadcastSeatsUpdated = (io, roomId, room) => {
  const seatsUsers = room.seats.filter(u => u !== null).map(u => ({
    socketId: u.id,
    user: {
      userId: u.userId,
      uid: u.uid,
      username: u.name,
      avatarUrl: u.avatar
    }
  }));
  
  const ownerData = room.owner ? {
    userId: room.owner.userId,
    username: room.owner.name,
    avatarUrl: room.owner.avatar
  } : null;
  
  io.in(roomId).emit('peer:seats_updated', {
    seats: room.seats.map(u => u ? u.id : null),
    seatsUsers,
    owner: ownerData,
    activeMembersCount: room.activeMembers
  });
};

const syncSeatsToDb = async (roomId, room) => {
  try {
    const dbSeats = {
      seat1: room.seats[0] ? room.seats[0].uid : null,
      seat2: room.seats[1] ? room.seats[1].uid : null,
      seat3: room.seats[2] ? room.seats[2].uid : null,
      seat4: room.seats[3] ? room.seats[3].uid : null,
      seat5: room.seats[4] ? room.seats[4].uid : null,
      seat6: room.seats[5] ? room.seats[5].uid : null,
      seat7: room.seats[6] ? room.seats[6].uid : null,
      seat8: room.seats[7] ? room.seats[7].uid : null
    };
    await Room.findByIdAndUpdate(roomId, { seats: dbSeats });
    console.log(`Synced seats for room ${roomId} to DB`);
  } catch (err) {
    console.error(`Failed to sync seats for room ${roomId} to DB:`, err.message);
  }
};

const voiceRoomHandler = (io, socket) => {

  // 1. Join Room & Initialize Unified State
  socket.on('peer:join_room', async ({ roomId, user }) => {
    try {
      if (!roomId || !user) return;

      // Check if user is already in another room in the DB
      if (user.userId) {
        const dbUser = await User.findById(user.userId);
        if (dbUser && dbUser.inRoom && dbUser.inRoom.toString() !== roomId.toString()) {
          socket.emit('voice_room:error', {
            message: 'You are already in an active room session! Exit it first.'
          });
          return;
        }
      }

      socket.join(roomId);
      socket.voiceRoomId = roomId;
      socket.voiceUserHandle = user.username;
      socket.voiceUserObj = user;

      let room = voiceRooms.get(roomId);
      if (!room) {
        // Look up room in DB to resolve actual host
        let dbRoom = null;
        try {
          dbRoom = await Room.findById(roomId);
        } catch (dbErr) {
          console.warn("DB Room look up failed:", dbErr.message);
        }

        const seats = Array(8).fill(null);
        if (dbRoom && dbRoom.seats) {
          const uidsToFetch = [];
          for (let i = 1; i <= 8; i++) {
            const uidVal = dbRoom.seats[`seat${i}`];
            if (uidVal) uidsToFetch.push(uidVal);
          }
          if (uidsToFetch.length > 0) {
            try {
              const dbUsers = await User.find({ uid: { $in: uidsToFetch } });
              const seatedUsersMap = new Map(dbUsers.map(u => [u.uid, u]));
              for (let i = 0; i < 8; i++) {
                const uidVal = dbRoom.seats[`seat${i + 1}`];
                if (uidVal && seatedUsersMap.has(uidVal)) {
                  const dbU = seatedUsersMap.get(uidVal);
                  seats[i] = {
                    id: dbU.uid, // Use their uid as fallback socket ID until they join
                    userId: dbU._id.toString(),
                    uid: dbU.uid,
                    name: dbU.username,
                    handle: dbU.username,
                    avatar: dbU.avatarUrl || '👤',
                    role: 'user',
                    status: 'seated',
                    seat: i + 1,
                    muted: false,
                    selfMuted: false,
                    lifted: false,
                    joinedAt: Date.now()
                  };
                }
              }
            } catch (fetchErr) {
              console.error("Failed to populate seated users from DB:", fetchErr.message);
            }
          }
        }

        room = {
          roomId,
          roomName: dbRoom ? dbRoom.name : "Voice Room",
          owner: null,
          seats, // Pre-populated seats 1-8
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
        
        // If owner reconnected, clear any pending timeouts!
        if (existingUser.disconnected) {
          existingUser.disconnected = false;
          if (ownerDisconnectTimeouts.has(roomId)) {
            clearTimeout(ownerDisconnectTimeouts.get(roomId));
            ownerDisconnectTimeouts.delete(roomId);
            addRoomLog(room, `Owner ${existingUser.name} reconnected. Reconnection timeout cleared.`);
          }
        }
      } else {
        for (let i = 0; i < 8; i++) {
          if (room.seats[i] && room.seats[i].handle === user.username) {
            existingUser = room.seats[i];
            existingUser.id = socket.id;
            existingUser.status = 'seated';
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

      if (existingUser) {
        // Enforce valid UID on rejoin as well
        if ((!existingUser.uid || existingUser.uid === socket.id) && user.userId) {
          const dbUser = await User.findById(user.userId).catch(() => null);
          if (dbUser) {
            existingUser.uid = dbUser.uid;
          }
        }
      }

      if (!existingUser) {
        // Fetch actual UID from Mongo if frontend failed to provide it
        let actualUid = user.uid;
        if ((!actualUid || actualUid === socket.id) && user.userId) {
          const dbUser = await User.findById(user.userId).catch(() => null);
          if (dbUser) {
            actualUid = dbUser.uid;
          }
        }

        // Determine role: if owner is not yet assigned, first to join (or matching dbRoom host) is owner
        const dbRoom = await Room.findById(roomId).catch(() => null);
        const isDbHost = dbRoom && dbRoom.host && dbRoom.host.toString() === actualUid;
        const isOwnerUser = room.owner === null && (isDbHost || room.activeMembers === 0);

        const newUser = {
          id: socket.id,
          userId: user.userId,
          uid: actualUid,
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
          
          // Remove owner's uid from any seats
          for (let i = 0; i < 8; i++) {
            if (room.seats[i] && room.seats[i].uid === actualUid) {
              room.seats[i] = null;
            }
          }
          await syncSeatsToDb(roomId, room);
          
          addRoomLog(room, `${user.username} created/entered the room as owner.`);
        } else {
          // ALWAYS place non-owners on the waiting list upon room entry
          room.waitingList.push(newUser);
          addRoomLog(room, `${user.username} entered the room and joined the waiting list.`);
        }
        updateActiveMembersCount(room, roomId, io);
      }

      // Gather other users in the room (socketId, user details)
      const otherUsers = [];
      if (room.owner && room.owner.id !== socket.id) {
        otherUsers.push({
          socketId: room.owner.id,
          user: {
            userId: room.owner.userId,
            uid: room.owner.uid,
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
              userId: u.userId,
              uid: u.uid,
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
              userId: u.userId,
              uid: u.uid,
              username: u.name,
              avatarUrl: u.avatar
            }
          });
        }
      });

      // Respond to the joining peer with other users and seats
      socket.emit('peer:existing_users', {
        users: otherUsers,
        seats: room.seats.map(u => u ? u.id : null),
        activeMembersCount: room.activeMembers
      });

      // Broadcast to other users in room
      socket.to(roomId).emit('peer:new_user_joined', {
        socketId: socket.id,
        user: {
          userId: user.userId,
          uid: user.uid,
          username: user.username,
          avatarUrl: user.avatarUrl
        }
      });

      // Broadcast seats updated to everyone
      broadcastSeatsUpdated(io, roomId, room);

      // Persist inRoom to user document in Mongo
      if (user.userId) {
        await User.findByIdAndUpdate(user.userId, { inRoom: roomId }).catch(() => null);
      }

    } catch (err) {
      console.error("Error in peer:join_room:", err.message);
    }
  });

  // 2. Sit Down handler
  socket.on('peer:sit_down', async ({ roomId, seatIndex }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return;

      // Disallow room owner/host from taking user seats 1-8!
      if (room.owner && room.owner.id === socket.id) {
        return;
      }

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
          userId: socket.voiceUserObj?.userId,
          uid: socket.voiceUserObj?.uid,
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

      // Remove this user from any other seats
      for (let i = 0; i < 8; i++) {
        if (i !== seatIndex && room.seats[i] && room.seats[i].uid === user.uid) {
          room.seats[i] = null;
        }
      }

      await syncSeatsToDb(roomId, room);

      addRoomLog(room, `${user.name} sat down in seat ${seatIndex + 1}.`);
      updateActiveMembersCount(room, roomId, io);

      // Broadcast updated seats to all participants in real-time
      broadcastSeatsUpdated(io, roomId, room);
    } catch (err) {
      console.error("Error in peer:sit_down:", err.message);
    }
  });

  // 3. Stand Up handler
  socket.on('peer:stand_up', async ({ roomId }) => {
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

        await syncSeatsToDb(roomId, room);

        addRoomLog(room, `${user.name} stood up from seat.`);
        updateActiveMembersCount(room, roomId, io);

        // Broadcast updated seats in real-time
        broadcastSeatsUpdated(io, roomId, room);
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

  // 4a. Mute state handler
  socket.on('peer:mute_state', ({ roomId, isMuted }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return;

      // Find user
      let userObj = null;
      if (room.owner && room.owner.id === socket.id) {
        userObj = room.owner;
      } else {
        for (let i = 0; i < 8; i++) {
          if (room.seats[i] && room.seats[i].id === socket.id) {
            userObj = room.seats[i];
            break;
          }
        }
      }
      if (!userObj) {
        userObj = room.waitingList.find(u => u.id === socket.id);
      }

      if (userObj) {
        userObj.selfMuted = isMuted;
      }

      const isOverallMuted = userObj ? (userObj.selfMuted || !!userObj.adminMuted) : isMuted;
      const isAdminMuted = userObj ? !!userObj.adminMuted : false;

      io.in(roomId).emit('peer:mute_updated', {
        socketId: socket.id,
        isMuted: isOverallMuted,
        selfMuted: userObj ? userObj.selfMuted : isMuted,
        adminMuted: isAdminMuted
      });
    } catch (err) {
      console.error("Error in peer:mute_state:", err.message);
    }
  });

  // 4b. Admin Lift Up handler (Stand up user from seat to waiting list)
  socket.on('peer:admin_lift_up', async ({ roomId, targetSocketId }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return;

      // Validate owner
      if (!room.owner || room.owner.id !== socket.id) return;

      let targetUser = null;
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].id === targetSocketId) {
          targetUser = room.seats[i];
          room.seats[i] = null;
          break;
        }
      }

      if (targetUser) {
        targetUser.status = 'waiting';
        targetUser.seat = null;
        room.waitingList.push(targetUser);

        await syncSeatsToDb(roomId, room);

        addRoomLog(room, `${room.owner.name} stood up ${targetUser.name} from seat.`);
        updateActiveMembersCount(room, roomId, io);

        // Broadcast updated seats in real-time
        broadcastSeatsUpdated(io, roomId, room);

        // Notify target client to stand up
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('peer:admin_stood_up');
        }
      }
    } catch (err) {
      console.error("Error in peer:admin_lift_up:", err.message);
    }
  });

  // 4c. Admin Kick handler (Kick user and ban for 10 minutes)
  socket.on('peer:admin_kick', ({ roomId, targetSocketId }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return;

      // Validate owner
      if (!room.owner || room.owner.id !== socket.id) return;

      let targetUser = null;
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].id === targetSocketId) {
          targetUser = room.seats[i];
          break;
        }
      }
      if (!targetUser) {
        targetUser = room.waitingList.find(u => u.id === targetSocketId);
      }

      if (targetUser) {
        // Kick & ban for 10 minutes (600,000 milliseconds)
        room.kickBans[targetUser.handle] = Date.now() + 10 * 60 * 1000;

        addRoomLog(room, `${room.owner.name} kicked ${targetUser.name} from room.`);
        
        // Remove user
        exitUser(roomId, targetSocketId);

        // Notify target client
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('peer:kicked_by_owner', { remainingMinutes: 10, remainingSeconds: 0 });
          targetSocket.leave(roomId);
        }
      }
    } catch (err) {
      console.error("Error in peer:admin_kick:", err.message);
    }
  });

  // 4d. Admin Mute Toggle handler
  socket.on('peer:admin_mute_toggle', ({ roomId, targetSocketId }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return;

      // Validate owner
      if (!room.owner || room.owner.id !== socket.id) return;

      let targetUser = null;
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].id === targetSocketId) {
          targetUser = room.seats[i];
          break;
        }
      }
      if (!targetUser) {
        targetUser = room.waitingList.find(u => u.id === targetSocketId);
      }

      if (targetUser) {
        targetUser.adminMuted = !targetUser.adminMuted;
        
        const isOverallMuted = targetUser.selfMuted || targetUser.adminMuted;
        io.in(roomId).emit('peer:mute_updated', {
          socketId: targetSocketId,
          isMuted: isOverallMuted,
          selfMuted: targetUser.selfMuted,
          adminMuted: targetUser.adminMuted
        });

        addRoomLog(room, `${room.owner.name} ${targetUser.adminMuted ? 'muted' : 'unmuted'} ${targetUser.name}.`);
      }
    } catch (err) {
      console.error("Error in peer:admin_mute_toggle:", err.message);
    }
  });

  // 5. Clean exit or sudden disconnect
  const exitUser = async (roomId, socketId, isSuddenDisconnect = false) => {
    const room = voiceRooms.get(roomId);
    if (!room) return;

    let exitedUser = null;
    let oldOwnerName = room.owner ? room.owner.name : null;

    // Check if owner disconnected
    if (room.owner && room.owner.id === socketId) {
      if (isSuddenDisconnect) {
        // Mark owner as disconnected
        room.owner.disconnected = true;
        room.owner.disconnectedAt = Date.now();
        addRoomLog(room, `Owner ${room.owner.name} disconnected. Waiting 2 minutes for reconnection.`);

        // Clear any existing timeout for this room
        if (ownerDisconnectTimeouts.has(roomId)) {
          clearTimeout(ownerDisconnectTimeouts.get(roomId));
        }

        const timeout = setTimeout(async () => {
          ownerDisconnectTimeouts.delete(roomId);
          const currentRoom = voiceRooms.get(roomId);
          if (!currentRoom || !currentRoom.owner || !currentRoom.owner.disconnected) return;

          // Timeout fired and owner is still disconnected! Promote or close!
          const oldOwnerName = currentRoom.owner.name;
          const oldOwnerUserId = currentRoom.owner.userId;
          currentRoom.owner = null;

          if (oldOwnerUserId) {
            await User.findByIdAndUpdate(oldOwnerUserId, { inRoom: null }).catch(() => null);
          }

          let newOwnerCandidate = null;
          let promotedFrom = null;
          let originalSeatNum = null;

          for (let i = 0; i < 8; i++) {
            if (currentRoom.seats[i] !== null) {
              newOwnerCandidate = currentRoom.seats[i];
              promotedFrom = 'seat';
              originalSeatNum = i + 1;
              currentRoom.seats[i] = null;
              break;
            }
          }

          if (!newOwnerCandidate && currentRoom.waitingList.length > 0) {
            newOwnerCandidate = currentRoom.waitingList[0];
            promotedFrom = 'waitingList';
            currentRoom.waitingList.splice(0, 1);
          }

          if (newOwnerCandidate) {
            newOwnerCandidate.role = 'owner';
            newOwnerCandidate.status = 'seated';
            newOwnerCandidate.seat = 0;
            currentRoom.owner = newOwnerCandidate;

            if (promotedFrom === 'seat') {
              addRoomLog(currentRoom, `${oldOwnerName} left permanently. ${newOwnerCandidate.name} promoted from seat ${originalSeatNum} to owner.`);
            } else {
              addRoomLog(currentRoom, `${oldOwnerName} left permanently. ${newOwnerCandidate.name} promoted from waiting list to owner.`);
            }

            // Promote to owner in DB!
            try {
              const Room = require('../models/Room');
              await Room.findByIdAndUpdate(roomId, { host: newOwnerCandidate.uid });
              await syncSeatsToDb(roomId, currentRoom);
              console.log(`Updated room ${roomId} host to ${newOwnerCandidate.name} in DB (delayed)`);
            } catch (err) {
              console.error("Failed to update room host in DB after promotion (delayed):", err.message);
            }
            
            // Broadcast seats updated
            broadcastSeatsUpdated(io, roomId, currentRoom);
          } else {
            // Close Room and remove from database!
            addRoomLog(currentRoom, `Owner left permanently. No members remaining — room closed.`);
            voiceRooms.delete(roomId);
            try {
              await Room.findByIdAndDelete(roomId);
              await User.updateMany({ inRoom: roomId }, { inRoom: null }).catch(() => null);
              console.log(`Deleted empty room ${roomId} from DB after owner 2m timeout`);
              // Emit room deletion in real-time
              io.emit('room_deleted', roomId);
            } catch (err) {
              console.error("Failed to delete room from DB after timeout:", err.message);
            }
          }

          updateActiveMembersCount(currentRoom, roomId, io);
          io.in(roomId).emit('peer:seats_updated', {
            seats: currentRoom.seats.map(u => u ? u.id : null),
            seatsUsers: currentRoom.seats.filter(u => u !== null).map(u => ({
              socketId: u.id,
              user: {
                userId: u.userId,
                uid: u.uid,
                username: u.name,
                avatarUrl: u.avatar
              }
            }))
          });
          io.in(roomId).emit('peer:user_left', { userId: socketId });

        }, 120000); // 2 minutes (120000ms)

        ownerDisconnectTimeouts.set(roomId, timeout);
        return; // Don't run the standard immediate exit logic!
      } else {
        // Explicit clean exit: immediately exit and remove from DB if empty!
        exitedUser = room.owner;
        room.owner = null;

        // Promoted priority
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

          // Promote to owner in DB!
          try {
            const Room = require('../models/Room');
            await Room.findByIdAndUpdate(roomId, { host: newOwnerCandidate.uid });
            await syncSeatsToDb(roomId, room);
            console.log(`Updated room ${roomId} host to ${newOwnerCandidate.name} in DB (immediate)`);
          } catch (err) {
            console.error("Failed to update room host in DB after promotion (immediate):", err.message);
          }
        } else {
          // Close Room and delete from DB!
          addRoomLog(room, `Owner left. No members remaining — room closed.`);
          voiceRooms.delete(roomId);
          try {
            await Room.findByIdAndDelete(roomId);
            await User.updateMany({ inRoom: roomId }, { inRoom: null }).catch(() => null);
            console.log(`Deleted empty room ${roomId} from DB immediately after owner left`);
            // Emit room deletion in real-time
            io.emit('room_deleted', roomId);
          } catch (err) {
            console.error("Failed to delete room from DB immediately:", err.message);
          }
        }
      }
    } else {
      // Check seated users
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].id === socketId) {
          exitedUser = room.seats[i];
          room.seats[i] = null;
          await syncSeatsToDb(roomId, room);
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

    updateActiveMembersCount(room, roomId, io);

    // Clear inRoom inside user document in MongoDB
    if (exitedUser && exitedUser.userId) {
      try {
        await User.findByIdAndUpdate(exitedUser.userId, { inRoom: null });
        console.log(`Cleared inRoom in DB for user ${exitedUser.name}`);
      } catch (err) {
        console.error("Failed to clear inRoom in DB:", err.message);
      }
    }

    // Broadcast seats updated
    broadcastSeatsUpdated(io, roomId, room);

    // Notify user left
    io.in(roomId).emit('peer:user_left', { userId: socketId });
  };

  socket.on('peer:update_profile', async ({ userId, username, avatarUrl }) => {
    try {
      if (!userId) return;

      // Find if the user is currently inside any room in our in-memory map
      for (const [roomId, room] of voiceRooms.entries()) {
        let updated = false;

        // 1. Check Owner
        if (room.owner && room.owner.userId === userId) {
          room.owner.name = username;
          room.owner.handle = username;
          room.owner.avatar = avatarUrl;
          updated = true;
        }

        // 2. Check Seats
        for (let i = 0; i < 8; i++) {
          if (room.seats[i] && room.seats[i].userId === userId) {
            room.seats[i].name = username;
            room.seats[i].handle = username;
            room.seats[i].avatar = avatarUrl;
            updated = true;
          }
        }

        // 3. Check Waiting List
        const waitingUser = room.waitingList.find(u => u.userId === userId);
        if (waitingUser) {
          waitingUser.name = username;
          waitingUser.handle = username;
          waitingUser.avatar = avatarUrl;
          updated = true;
        }

        if (updated) {
          console.log(`Real-time profile updated in room ${roomId} for user: ${username}`);
          
          // Broadcast seat updates to all peers in the room so their UI refreshes in 0ms
          broadcastSeatsUpdated(io, roomId, room);
          
          // Also broadcast a dedicated profile updated event
          io.in(roomId).emit('peer:profile_updated', {
            userId,
            username,
            avatarUrl
          });
        }
      }
    } catch (err) {
      console.error("Error in peer:update_profile handler:", err.message);
    }
  });

  socket.on('peer:leave_room', async ({ roomId }, callback) => {
    try {
      await exitUser(roomId, socket.id, false); // isSuddenDisconnect = false
      socket.leave(roomId);
      socket.voiceRoomId = null;
      socket.voiceUserHandle = null;
    } catch (err) {
      console.error("Error in peer:leave_room:", err.message);
    }
    if (typeof callback === 'function') {
      callback();
    }
  });

  socket.on('disconnecting', async () => {
    try {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          await exitUser(roomId, socket.id, true); // isSuddenDisconnect = true
        }
      }
    } catch (err) {
      console.error("Error in disconnect cleaner:", err.message);
    }
  });
};

module.exports = voiceRoomHandler;
