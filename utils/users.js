const users = [];

// Available rooms (server-side tracking)
const availableRooms = [
  { name: 'general', description: 'General discussion room' }
];

// Check if username is taken across all rooms
function isUsernameTaken(username) {
  const taken = users.some(user => user.username === username);
  console.log(`Checking if username "${username}" is taken globally:`, taken);
  console.log('Current users:', users);
  return taken;
}

// Get all available rooms
function getAvailableRooms() {
  return availableRooms;
}

// Add a new room
function addRoom(roomName, description = '') {
  // Check if room already exists
  const existingRoom = availableRooms.find(room => 
    room.name.toLowerCase() === roomName.toLowerCase()
  );
  
  if (existingRoom) {
    return { success: false, message: 'Room already exists' };
  }
  
  // Add new room
  const newRoom = { name: roomName, description };
  availableRooms.push(newRoom);
  
  console.log(`Room "${roomName}" added successfully`);
  console.log('Available rooms:', availableRooms);
  
  return { success: true, room: newRoom };
}

// Delete a room
function deleteRoom(roomName) {
  // Prevent deletion of general room
  if (roomName.toLowerCase() === 'general') {
    return { success: false, message: 'Cannot delete the general room' };
  }
  
  // Find room index
  const roomIndex = availableRooms.findIndex(room => 
    room.name.toLowerCase() === roomName.toLowerCase()
  );
  
  if (roomIndex === -1) {
    return { success: false, message: 'Room not found' };
  }
  
  // Move all users from this room to general room
  users.forEach(user => {
    if (user.room.toLowerCase() === roomName.toLowerCase()) {
      user.room = 'general';
    }
  });
  
  // Remove room from array
  const deletedRoom = availableRooms.splice(roomIndex, 1)[0];
  
  console.log(`Room "${roomName}" deleted successfully`);
  console.log('Available rooms:', availableRooms);
  
  return { success: true, room: deletedRoom };
}

// Join user to chat
function userJoin(id, username, room) {
  console.log(`Attempting to join user "${username}" to room "${room}" with ID "${id}"`);
  
  // Check if username is already taken in this room
  if (isUsernameTaken(username)) {
    console.log(`Username "${username}" is already taken in room "${room}"`);
    return null; // Username already taken
  }
  
  console.log(`Username "${username}" is available, creating user`);
  const user = { id, username, room };
  users.push(user);
  console.log('User created successfully:', user);
  console.log('All users after join:', users);
  return user;
}

// Get current user
function getCurrentUser(id) {
  return users.find((user) => user.id === id);
}

// User leaves chat
function userLeave(id) {
  const index = users.findIndex((user) => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
}

// Update user room (for room switching)
function updateUserRoom(id, newRoom) {
  const user = users.find((user) => user.id === id);
  if (user) {
    user.room = newRoom;
    return user;
  }
  return null;
}

// Get room users
function getRoomUsers(room) {
  return users.filter((user) => user.room === room);
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave,
  updateUserRoom,
  getRoomUsers,
  isUsernameTaken,
  getAvailableRooms,
  addRoom,
  deleteRoom,
};
