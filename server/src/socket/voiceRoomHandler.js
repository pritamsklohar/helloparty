const crypto = require('crypto');

// In-memory Room State Map: roomId -> RoomObject
const voiceRooms = new Map();

// Helper to format timestamps as HH:MM:SS
const getFormattedTime = () => {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
};

// Helper to generate a new RoomObject log entry
const addRoomLog = (room, message) => {
  const time = getFormattedTime();
  const logEntry = `${time} — ${message}`;
  room.logs.push({ time, message });
  return logEntry;
};

// Helper to recalculate activeMembers
const updateActiveMembersCount = (room) => {
  let count = room.owner ? 1 : 0;
  count += room.seats.filter(s => s !== null).length;
  count += room.waitingList.length;
  room.activeMembers = count;
};

// Helper to construct a clean Error Response
const buildErrorResponse = (action, errorMsg, originalRoom) => {
  return {
    success: false,
    action,
    error: errorMsg,
    room: originalRoom || null,
    log: null
  };
};

const voiceRoomHandler = (io, socket) => {
  
  // ACTION 1 — OWNER CREATES ROOM
  socket.on('voice_room:create', ({ name, handle, avatar, roomName }) => {
    try {
      if (!name || !handle || !roomName) {
        return socket.emit('voice_room:response', buildErrorResponse('ROOM_CREATED', 'Missing required fields.'));
      }

      // Generate unique roomId: "VR-" + 6 random alphanumeric chars
      let roomId;
      do {
        roomId = 'VR-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      } while (voiceRooms.has(roomId));

      const ownerUser = {
        id: socket.id,
        name,
        handle,
        avatar: avatar || '🧑‍💻',
        role: 'owner',
        status: 'seated',
        seat: 0,
        muted: false,
        selfMuted: false,
        lifted: false,
        joinedAt: Date.now(),
        kickedUntil: null
      };

      const newRoom = {
        roomId,
        roomName,
        owner: ownerUser,
        seats: Array(8).fill(null), // Seats 1-8
        waitingList: [],
        activeMembers: 1,
        createdAt: Date.now(),
        kickBans: {},
        logs: []
      };

      const logMsg = addRoomLog(newRoom, `${name} created the room as owner.`);
      voiceRooms.set(roomId, newRoom);
      socket.join(roomId);
      socket.voiceRoomId = roomId;
      socket.voiceUserHandle = handle;

      socket.emit('voice_room:response', {
        success: true,
        action: 'ROOM_CREATED',
        error: null,
        room: newRoom,
        log: logMsg
      });

      console.log(`Voice room created: ${roomId} by ${handle}`);
    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('ROOM_CREATED', err.message));
    }
  });

  // ACTION 2 — USER ENTERS ROOM
  socket.on('voice_room:enter', ({ name, handle, avatar, roomId }) => {
    try {
      if (!name || !handle || !roomId) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_ENTERED', 'Missing required fields.'));
      }

      const room = voiceRooms.get(roomId);
      if (!room) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_ENTERED', 'Room not found.'));
      }

      // Check kickBans
      const bannedUntil = room.kickBans[handle];
      if (bannedUntil && bannedUntil > Date.now()) {
        const remainingMs = bannedUntil - Date.now();
        const min = Math.floor(remainingMs / 60000);
        const sec = Math.ceil((remainingMs % 60000) / 1000);
        return socket.emit('voice_room:response', buildErrorResponse('USER_ENTERED', `You are kicked from this room. Rejoin in ${min} min ${sec} sec.`, room));
      }

      // Prepare newUser object
      const newUser = {
        id: socket.id,
        name,
        handle,
        avatar: avatar || '👤',
        role: 'user',
        status: 'waiting',
        seat: null,
        muted: false,
        selfMuted: false,
        lifted: false,
        joinedAt: Date.now(),
        kickedUntil: null
      };

      let placedIn = 'waitingList';
      let seatNum = null;
      let logMsg = '';

      // Find the lowest-numbered empty seat among seats 1–8 (array indices 0-7)
      const emptySeatIndex = room.seats.indexOf(null);
      if (emptySeatIndex !== -1) {
        placedIn = 'seat';
        seatNum = emptySeatIndex + 1; // 1-8
        newUser.status = 'seated';
        newUser.seat = seatNum;
        room.seats[emptySeatIndex] = newUser;
        logMsg = addRoomLog(room, `${name} entered and took seat ${seatNum}.`);
      } else {
        room.waitingList.push(newUser);
        logMsg = addRoomLog(room, `${name} entered the room and joined the waiting list.`);
      }

      updateActiveMembersCount(room);
      socket.join(roomId);
      socket.voiceRoomId = roomId;
      socket.voiceUserHandle = handle;

      // Notify the entering user
      socket.emit('voice_room:response', {
        success: true,
        action: 'USER_ENTERED',
        user: newUser,
        placedIn,
        seat: seatNum,
        room,
        log: logMsg
      });

      // Broadcast updated room state to everyone else
      socket.to(roomId).emit('voice_room:update', {
        action: 'USER_ENTERED',
        room,
        log: logMsg
      });

    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('USER_ENTERED', err.message));
    }
  });

  // ACTION 3 — USER SITS (waiting list -> takes an empty seat)
  socket.on('voice_room:sit', ({ roomId, handle, seat }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return socket.emit('voice_room:response', buildErrorResponse('USER_SAT', 'Room not found.'));

      if (seat < 1 || seat > 8) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_SAT', 'Invalid seat number. Seat must be between 1 and 8.', room));
      }

      // Check if target seat is already occupied
      if (room.seats[seat - 1] !== null) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_SAT', 'Target seat is occupied.', room));
      }

      // Find user in waitingList
      const waitingIndex = room.waitingList.findIndex(u => u.handle === handle);
      if (waitingIndex === -1) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_SAT', 'User is not in the waiting list.', room));
      }

      const user = room.waitingList[waitingIndex];
      room.waitingList.splice(waitingIndex, 1);

      // Seat the user
      user.status = 'seated';
      user.seat = seat;
      room.seats[seat - 1] = user;

      const logMsg = addRoomLog(room, `${user.name} moved from waiting list to seat ${seat}.`);
      updateActiveMembersCount(room);

      io.in(roomId).emit('voice_room:update', {
        action: 'USER_SAT',
        room,
        log: logMsg
      });
    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('USER_SAT', err.message));
    }
  });

  // ACTION 4 — USER STANDS UP
  socket.on('voice_room:stand_up', ({ roomId, handle }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return socket.emit('voice_room:response', buildErrorResponse('USER_STOOD_UP', 'Room not found.'));

      // Find seated user
      let seatIndex = -1;
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].handle === handle) {
          seatIndex = i;
          break;
        }
      }

      if (seatIndex === -1) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_STOOD_UP', 'User is not seated in a regular seat.', room));
      }

      const user = room.seats[seatIndex];
      const seatNum = seatIndex + 1;

      // Free the seat
      room.seats[seatIndex] = null;

      // Add to FIFO waiting list
      user.status = 'waiting';
      user.seat = null;
      room.waitingList.push(user);

      const logMsg = addRoomLog(room, `${user.name} stood up from seat ${seatNum} and joined the waiting list.`);
      updateActiveMembersCount(room);

      io.in(roomId).emit('voice_room:update', {
        action: 'USER_STOOD_UP',
        room,
        log: logMsg
      });
    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('USER_STOOD_UP', err.message));
    }
  });

  // ACTION 5 — USER EXITS ROOM (full exit)
  socket.on('voice_room:exit', ({ roomId, handle }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return socket.emit('voice_room:response', buildErrorResponse('USER_EXITED', 'Room not found.'));

      // Ensure it is not the owner (owner must use ACTION 6)
      if (room.owner && room.owner.handle === handle) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_EXITED', 'Owner must use owner exit.', room));
      }

      let exitedUser = null;

      // Check if seated
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].handle === handle) {
          exitedUser = room.seats[i];
          room.seats[i] = null;
          break;
        }
      }

      // Check if waiting list
      if (!exitedUser) {
        const waitingIndex = room.waitingList.findIndex(u => u.handle === handle);
        if (waitingIndex !== -1) {
          exitedUser = room.waitingList[waitingIndex];
          room.waitingList.splice(waitingIndex, 1);
        }
      }

      if (!exitedUser) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_EXITED', 'User not found in room.', room));
      }

      exitedUser.status = 'exited';

      const logMsg = addRoomLog(room, `${exitedUser.name} exited the room.`);
      updateActiveMembersCount(room);

      socket.leave(roomId);
      socket.voiceRoomId = null;
      socket.voiceUserHandle = null;

      io.in(roomId).emit('voice_room:update', {
        action: 'USER_EXITED',
        room,
        log: logMsg
      });

      socket.emit('voice_room:response', {
        success: true,
        action: 'USER_EXITED',
        exitedUser: { id: exitedUser.id, name: exitedUser.name, handle: exitedUser.handle },
        room,
        log: logMsg
      });
    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('USER_EXITED', err.message));
    }
  });

  // ACTION 6 — OWNER EXITS ROOM (with Promotion)
  socket.on('voice_room:owner_exit', ({ roomId }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return socket.emit('voice_room:response', buildErrorResponse('OWNER_EXITED', 'Room not found.'));

      // Verify that this socket is indeed the owner
      if (room.owner.id !== socket.id) {
        return socket.emit('voice_room:response', buildErrorResponse('OWNER_EXITED', 'Only the current owner can perform owner exit.', room));
      }

      const oldOwnerName = room.owner.name;

      // Promotion priority:
      // 1st -> Lowest-numbered occupied seat 1-8
      let newOwnerCandidate = null;
      let promotedFrom = null;
      let originalSeatNum = null;

      for (let i = 0; i < 8; i++) {
        if (room.seats[i] !== null) {
          newOwnerCandidate = room.seats[i];
          promotedFrom = 'seat';
          originalSeatNum = i + 1;
          room.seats[i] = null; // Clear the seat
          break;
        }
      }

      // 2nd -> First user in waitingList
      if (!newOwnerCandidate && room.waitingList.length > 0) {
        newOwnerCandidate = room.waitingList[0];
        promotedFrom = 'waitingList';
        room.waitingList.splice(0, 1); // Remove from waiting list
      }

      let logMsg = '';
      let roomClosed = false;

      if (newOwnerCandidate) {
        // Promote candidate to owner
        newOwnerCandidate.role = 'owner';
        newOwnerCandidate.status = 'seated';
        newOwnerCandidate.seat = 0;
        
        room.owner = newOwnerCandidate;

        if (promotedFrom === 'seat') {
          logMsg = addRoomLog(room, `${oldOwnerName} exited. ${newOwnerCandidate.name} promoted from seat ${originalSeatNum} to owner.`);
        } else {
          logMsg = addRoomLog(room, `${oldOwnerName} exited. ${newOwnerCandidate.name} promoted from waiting list to owner.`);
        }
      } else {
        // 3rd -> Close the room
        roomClosed = true;
        room.owner = null;
        logMsg = addRoomLog(room, `${oldOwnerName} exited. No members remaining — room closed.`);
        voiceRooms.delete(roomId);
      }

      updateActiveMembersCount(room);

      socket.leave(roomId);
      socket.voiceRoomId = null;
      socket.voiceUserHandle = null;

      // Notify room members
      io.in(roomId).emit('voice_room:update', {
        action: 'OWNER_EXITED',
        newOwner: room.owner,
        promotedFrom,
        roomClosed,
        room,
        log: logMsg
      });

      socket.emit('voice_room:response', {
        success: true,
        action: 'OWNER_EXITED',
        newOwner: room.owner,
        promotedFrom,
        roomClosed,
        room,
        log: logMsg
      });

    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('OWNER_EXITED', err.message));
    }
  });

  // ACTION 7 — OWNER LIFTS A USER
  socket.on('voice_room:lift', ({ roomId, handle }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return socket.emit('voice_room:response', buildErrorResponse('USER_LIFTED', 'Room not found.'));

      if (room.owner.id !== socket.id) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_LIFTED', 'Unauthorized. Only the owner can lift/lower users.', room));
      }

      // Find the seated user in seats 1-8
      let targetUser = null;
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].handle === handle) {
          targetUser = room.seats[i];
          break;
        }
      }

      if (!targetUser) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_LIFTED', 'Target user is not seated.', room));
      }

      // Toggle lift
      targetUser.lifted = !targetUser.lifted;
      const currentAction = targetUser.lifted ? 'USER_LIFTED' : 'USER_LOWERED';
      const logMsg = targetUser.lifted
        ? addRoomLog(room, `${room.owner.name} lifted ${targetUser.name}.`)
        : addRoomLog(room, `${room.owner.name} lowered ${targetUser.name}.`);

      io.in(roomId).emit('voice_room:update', {
        action: currentAction,
        room,
        log: logMsg
      });
    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('USER_LIFTED', err.message));
    }
  });

  // ACTIONS 8 & 9 — OWNER MUTES / UNMUTES A USER
  socket.on('voice_room:mute_toggle', ({ roomId, handle, muteState }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return socket.emit('voice_room:response', buildErrorResponse('USER_MUTED', 'Room not found.'));

      if (room.owner.id !== socket.id) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_MUTED', 'Unauthorized. Only the owner can mute/unmute users.', room));
      }

      if (room.owner.handle === handle) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_MUTED', 'Owner cannot mute/unmute themselves.', room));
      }

      // Find user
      let targetUser = null;
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].handle === handle) {
          targetUser = room.seats[i];
          break;
        }
      }
      if (!targetUser) {
        const waitingIdx = room.waitingList.findIndex(u => u.handle === handle);
        if (waitingIdx !== -1) {
          targetUser = room.waitingList[waitingIdx];
        }
      }

      if (!targetUser) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_MUTED', 'User not found in room.', room));
      }

      let logMsg = '';
      let actionType = '';

      if (muteState === true) {
        // Owner Mute
        targetUser.muted = true;
        if (targetUser.selfMuted) targetUser.selfMuted = false; // Owner mute overrides self-mute
        actionType = 'USER_MUTED';
        logMsg = addRoomLog(room, `${room.owner.name} muted ${targetUser.name}.`);
      } else {
        // Owner Unmute
        targetUser.muted = false;
        actionType = 'USER_UNMUTED';
        logMsg = addRoomLog(room, `${room.owner.name} unmuted ${targetUser.name}.`);
      }

      io.in(roomId).emit('voice_room:update', {
        action: actionType,
        targetUser,
        room,
        log: logMsg
      });
    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('USER_MUTED', err.message));
    }
  });

  // ACTIONS 10 & 11 — USER SELF-MUTES / SELF-UNMUTES
  socket.on('voice_room:self_mute_toggle', ({ roomId, handle, muteState }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return socket.emit('voice_room:response', buildErrorResponse('SELF_MUTED', 'Room not found.'));

      // Find user
      let targetUser = null;
      if (room.owner.handle === handle) {
        targetUser = room.owner;
      }
      if (!targetUser) {
        for (let i = 0; i < 8; i++) {
          if (room.seats[i] && room.seats[i].handle === handle) {
            targetUser = room.seats[i];
            break;
          }
        }
      }
      if (!targetUser) {
        const waitingIdx = room.waitingList.findIndex(u => u.handle === handle);
        if (waitingIdx !== -1) {
          targetUser = room.waitingList[waitingIdx];
        }
      }

      if (!targetUser) {
        return socket.emit('voice_room:response', buildErrorResponse('SELF_MUTED', 'User not found in room.', room));
      }

      // Check if muted BY OWNER
      if (targetUser.muted === true) {
        return socket.emit('voice_room:response', {
          success: false,
          action: 'SELF_UNMUTE_BLOCKED',
          error: 'You are muted by the owner. You cannot change your mute state.',
          room,
          log: null
        });
      }

      let logMsg = '';
      let actionType = '';

      if (muteState === true) {
        targetUser.selfMuted = true;
        actionType = 'SELF_MUTED';
        logMsg = addRoomLog(room, `${targetUser.name} muted themselves.`);
      } else {
        targetUser.selfMuted = false;
        actionType = 'SELF_UNMUTED';
        logMsg = addRoomLog(room, `${targetUser.name} unmuted themselves.`);
      }

      io.in(roomId).emit('voice_room:update', {
        action: actionType,
        room,
        log: logMsg
      });

      socket.emit('voice_room:response', {
        success: true,
        action: actionType,
        user: targetUser,
        error: null,
        log: logMsg
      });
    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('SELF_MUTED', err.message));
    }
  });

  // ACTION 12 — OWNER KICKS A USER
  socket.on('voice_room:kick', ({ roomId, handle }) => {
    try {
      const room = voiceRooms.get(roomId);
      if (!room) return socket.emit('voice_room:response', buildErrorResponse('USER_KICKED', 'Room not found.'));

      if (room.owner.id !== socket.id) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_KICKED', 'Unauthorized. Only the owner can kick users.', room));
      }

      if (room.owner.handle === handle) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_KICKED', 'Owner cannot kick themselves.', room));
      }

      let kickedUser = null;
      let vacatedSeat = null;

      // Find and remove from seat
      for (let i = 0; i < 8; i++) {
        if (room.seats[i] && room.seats[i].handle === handle) {
          kickedUser = room.seats[i];
          vacatedSeat = i + 1;
          room.seats[i] = null;
          break;
        }
      }

      // Find and remove from waiting list
      if (!kickedUser) {
        const waitingIdx = room.waitingList.findIndex(u => u.handle === handle);
        if (waitingIdx !== -1) {
          kickedUser = room.waitingList[waitingIdx];
          room.waitingList.splice(waitingIdx, 1);
        }
      }

      if (!kickedUser) {
        return socket.emit('voice_room:response', buildErrorResponse('USER_KICKED', 'User not found in room.', room));
      }

      kickedUser.status = 'exited';

      // Record kick ban for 10 minutes
      const bannedUntil = Date.now() + 10 * 60 * 1000;
      room.kickBans[handle] = bannedUntil;

      const logMsg = addRoomLog(room, `${room.owner.name} kicked ${kickedUser.name}. They cannot rejoin for 10 minutes.`);
      updateActiveMembersCount(room);

      // Force-leave the kicked user's socket
      const targetSocket = io.sockets.sockets.get(kickedUser.id);
      if (targetSocket) {
        targetSocket.leave(roomId);
        targetSocket.voiceRoomId = null;
        targetSocket.voiceUserHandle = null;
        targetSocket.emit('voice_room:kicked_notification', {
          roomId,
          message: 'You were kicked from this room by the owner.'
        });
      }

      io.in(roomId).emit('voice_room:update', {
        action: 'USER_KICKED',
        room,
        log: logMsg
      });

      socket.emit('voice_room:response', {
        success: true,
        action: 'USER_KICKED',
        kickedUser: { id: kickedUser.id, name: kickedUser.name, handle: kickedUser.handle },
        bannedUntil,
        vacatedSeat,
        room,
        log: logMsg
      });
    } catch (err) {
      socket.emit('voice_room:response', buildErrorResponse('USER_KICKED', err.message));
    }
  });

  // Handle sudden physical socket disconnections safely
  socket.on('disconnect', () => {
    try {
      const roomId = socket.voiceRoomId;
      const handle = socket.voiceUserHandle;
      if (!roomId || !handle) return;

      const room = voiceRooms.get(roomId);
      if (!room) return;

      // If it was the owner
      if (room.owner && room.owner.id === socket.id) {
        const oldOwnerName = room.owner.name;
        
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

        let logMsg = '';
        let roomClosed = false;

        if (newOwnerCandidate) {
          newOwnerCandidate.role = 'owner';
          newOwnerCandidate.status = 'seated';
          newOwnerCandidate.seat = 0;
          room.owner = newOwnerCandidate;

          if (promotedFrom === 'seat') {
            logMsg = addRoomLog(room, `${oldOwnerName} disconnected. ${newOwnerCandidate.name} promoted from seat ${originalSeatNum} to owner.`);
          } else {
            logMsg = addRoomLog(room, `${oldOwnerName} disconnected. ${newOwnerCandidate.name} promoted from waiting list to owner.`);
          }
        } else {
          roomClosed = true;
          room.owner = null;
          logMsg = addRoomLog(room, `${oldOwnerName} disconnected. No members remaining — room closed.`);
          voiceRooms.delete(roomId);
        }

        updateActiveMembersCount(room);

        io.in(roomId).emit('voice_room:update', {
          action: 'OWNER_EXITED',
          newOwner: room.owner,
          promotedFrom,
          roomClosed,
          room,
          log: logMsg
        });
      } else {
        // If it was a normal seated or waiting user
        let exitedUser = null;

        for (let i = 0; i < 8; i++) {
          if (room.seats[i] && room.seats[i].handle === handle) {
            exitedUser = room.seats[i];
            room.seats[i] = null;
            break;
          }
        }

        if (!exitedUser) {
          const waitingIndex = room.waitingList.findIndex(u => u.handle === handle);
          if (waitingIndex !== -1) {
            exitedUser = room.waitingList[waitingIndex];
            room.waitingList.splice(waitingIndex, 1);
          }
        }

        if (exitedUser) {
          const logMsg = addRoomLog(room, `${exitedUser.name} disconnected.`);
          updateActiveMembersCount(room);

          io.in(roomId).emit('voice_room:update', {
            action: 'USER_EXITED',
            room,
            log: logMsg
          });
        }
      }
    } catch (err) {
      console.error('Error handling socket disconnect in voice rooms:', err.message);
    }
  });
};

module.exports = voiceRoomHandler;
