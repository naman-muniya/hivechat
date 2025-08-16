const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const userCount = document.getElementById('user-count');
const roomSelect = document.getElementById('room-select');
const sidebarToggle = document.getElementById('sidebar-toggle');
const chatSidebar = document.querySelector('.chat-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

// Room creation elements
const createRoomBtn = document.getElementById('create-room-btn');
const deleteRoomBtn = document.getElementById('delete-room-btn');
const createRoomModal = document.getElementById('create-room-modal');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const modalCreate = document.getElementById('modal-create');
const newRoomNameInput = document.getElementById('new-room-name');
const newRoomDescriptionInput = document.getElementById('new-room-description');

// Get username and room from URL
let { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

// Validate that both username and room are provided
if (!username || !room) {
  alert('Missing username or room. Please go back and fill in all required fields.');
  window.location.href = '../index.html';
}

// Basic client-side sanitization
username = username.toString().trim().substring(0, 20);
room = room.toString().trim().substring(0, 20);

const socket = io();

// Request available rooms when connecting
socket.emit('getRooms');

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  alert('Failed to connect to chat server. Please try again.');
});

// Handle server errors
socket.on('error', (error) => {
  console.error('Server error:', error);
  alert('Server error: ' + error);
  
  // If username is taken, redirect to index page
  if (error.includes('already taken')) {
    setTimeout(() => {
      window.location.href = '../index.html';
    }, 2000);
  }
});

// Join chatroom
socket.emit('joinRoom', { username, room });

// Set current room in dropdown
if (roomSelect) {
  roomSelect.value = room;
}

// Get room and users
socket.on('roomUsers', ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
  updateUserCount(users.length);
  
  // Update room select to show current room
  if (roomSelect) {
    roomSelect.value = room;
  }
});

// Handle message history when joining a room
socket.on('messageHistory', (messages) => {
  // Clear current messages first
  chatMessages.innerHTML = '';
  
  // Display all historical messages
  messages.forEach(message => {
    outputMessage(message);
  });
  
  // Scroll to bottom to show latest messages
  scrollToBottom();
});

// Message from server
socket.on('message', (message) => {
  console.log(message);
  outputMessage(message);

  // Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Message submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();

  // Get message text
  let msg = e.target.elements.msg.value;

  msg = msg.trim();

  if (!msg) {
    return false;
  }

  // Emit message to server
  socket.emit('chatMessage', msg);

  // Clear input
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});

// Room switching functionality
if (roomSelect) {
  roomSelect.addEventListener('change', () => {
    const newRoom = roomSelect.value;
    
    if (newRoom && newRoom !== room) {
      // Show switching message
      const switchingMessage = {
        username: 'HiveChat Bot',
        text: `Switching to room: ${newRoom}`,
        time: new Date().toLocaleTimeString()
      };
      outputMessage(switchingMessage);
      
      // Clear current messages
      chatMessages.innerHTML = '';
      
      // Use the new switchRoom event
      socket.emit('switchRoom', { username, newRoom });
      
      // Update URL without page reload
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('room', newRoom);
      window.history.pushState({}, '', newUrl);
      
      // Update current room variable
      room = newRoom;
      updateDeleteButtonVisibility();
    }
  });
}

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  
  // Add bot class for bot messages
  if (message.username === 'HiveChat Bot') {
    div.classList.add('bot');
  }
  
  // Add own class for user's own messages
  if (message.username === username) {
    div.classList.add('own');
  }

  const meta = document.createElement('div');
  meta.classList.add('meta');
  
  const usernameSpan = document.createElement('span');
  usernameSpan.classList.add('username');
  usernameSpan.innerText = message.username;
  
  const timeSpan = document.createElement('span');
  timeSpan.classList.add('time');
  timeSpan.innerText = message.time;
  
  meta.appendChild(usernameSpan);
  meta.appendChild(timeSpan);
  div.appendChild(meta);
  
  const text = document.createElement('div');
  text.classList.add('text');
  text.innerText = message.text;
  div.appendChild(text);
  
  chatMessages.appendChild(div);
}

// Add room name to DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
  userList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerText = user.username;
    userList.appendChild(li);
  });
}

// Update user count
function updateUserCount(count) {
  userCount.innerText = count;
}

// Prompt the user before leave chat room
document.getElementById('leave-btn').addEventListener('click', () => {
  const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
  if (leaveRoom) {
    window.location = '../index.html';
  }
});

// Add typing indicator functionality
let typingTimer;
const doneTypingInterval = 1000;

// Listen for typing events
chatForm.querySelector('#msg').addEventListener('input', () => {
  clearTimeout(typingTimer);
  if (chatForm.querySelector('#msg').value) {
    socket.emit('typing', { username, room });
    typingTimer = setTimeout(() => {
      socket.emit('stopTyping', { username, room });
    }, doneTypingInterval);
  } else {
    socket.emit('stopTyping', { username, room });
  }
});

// Auto-scroll to bottom when new messages arrive
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Enhanced scroll behavior
chatMessages.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = chatMessages;
  const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
  
  if (isNearBottom) {
    chatMessages.classList.add('auto-scroll');
  } else {
    chatMessages.classList.remove('auto-scroll');
  }
});

// Add smooth scrolling for new messages
const observer = new MutationObserver(() => {
  if (chatMessages.classList.contains('auto-scroll')) {
    scrollToBottom();
  }
});

observer.observe(chatMessages, {
  childList: true,
  subtree: true
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter to send message
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    chatForm.dispatchEvent(new Event('submit'));
  }
  
  // Escape to clear input
  if (e.key === 'Escape') {
    chatForm.querySelector('#msg').value = '';
    chatForm.querySelector('#msg').focus();
  }
});

// Add message timestamp formatting
function formatTime(timestamp) {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
  
  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ago`;
  } else {
    return messageTime.toLocaleDateString();
  }
}

// Add loading state for form submission
chatForm.addEventListener('submit', () => {
  const submitBtn = chatForm.querySelector('.send-btn');
  submitBtn.classList.add('loading');
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  
  setTimeout(() => {
    submitBtn.classList.remove('loading');
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
  }, 500);
});

// Mobile sidebar toggle functionality
if (sidebarToggle && chatSidebar && sidebarBackdrop) {
  sidebarToggle.addEventListener('click', () => {
    chatSidebar.classList.toggle('active');
    sidebarBackdrop.classList.toggle('active');
    sidebarToggle.classList.toggle('active');
    
    // Change icon based on state
    const icon = sidebarToggle.querySelector('i');
    if (chatSidebar.classList.contains('active')) {
      icon.className = 'fas fa-times';
    } else {
      icon.className = 'fas fa-users';
    }
  });
  
  // Close sidebar when clicking backdrop
  sidebarBackdrop.addEventListener('click', () => {
    chatSidebar.classList.remove('active');
    sidebarBackdrop.classList.remove('active');
    sidebarToggle.classList.remove('active');
    
    const icon = sidebarToggle.querySelector('i');
    icon.className = 'fas fa-users';
  });
  
  // Close sidebar on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatSidebar.classList.contains('active')) {
      chatSidebar.classList.remove('active');
      sidebarBackdrop.classList.remove('active');
      sidebarToggle.classList.remove('active');
      
      const icon = sidebarToggle.querySelector('i');
      icon.className = 'fas fa-users';
    }
  });
}

// Modal functionality for room creation
function openModal() {
  createRoomModal.classList.add('active');
  newRoomNameInput.focus();
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  createRoomModal.classList.remove('active');
  newRoomNameInput.value = '';
  newRoomDescriptionInput.value = '';
  document.body.style.overflow = '';
}

// Event listeners for modal
if (createRoomBtn) {
  createRoomBtn.addEventListener('click', openModal);
}

if (modalClose) {
  modalClose.addEventListener('click', closeModal);
}

if (modalCancel) {
  modalCancel.addEventListener('click', closeModal);
}

// Close modal when clicking outside
if (createRoomModal) {
  createRoomModal.addEventListener('click', (e) => {
    if (e.target === createRoomModal) {
      closeModal();
    }
  });
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && createRoomModal && createRoomModal.classList.contains('active')) {
    closeModal();
  }
});

// Create room functionality
if (modalCreate) {
  modalCreate.addEventListener('click', () => {
    const roomName = newRoomNameInput.value.trim();
    const roomDescription = newRoomDescriptionInput.value.trim();
    
    // Validation
    if (roomName.length < 3) {
      alert('Room name must be at least 3 characters long.');
      newRoomNameInput.focus();
      return;
    }
    
    if (roomName.length > 20) {
      alert('Room name must be 20 characters or less.');
      newRoomNameInput.focus();
      return;
    }
    
    // Send room creation request to server
    socket.emit('createRoom', { roomName, description: roomDescription });
  });
}

// Delete room functionality
if (deleteRoomBtn) {
  deleteRoomBtn.addEventListener('click', () => {
    const currentRoom = room;
    
    // Don't allow deletion of general room
    if (currentRoom.toLowerCase() === 'general') {
      alert('Cannot delete the general room.');
      return;
    }
    
    // Confirmation dialog
    const confirmDelete = confirm(`Are you sure you want to delete the room "${currentRoom}"? This action cannot be undone.`);
    
    if (confirmDelete) {
      socket.emit('deleteRoom', { roomName: currentRoom });
    }
  });
}

// Handle room creation result
socket.on('roomCreationResult', (result) => {
  if (result.success) {
    // Room was created successfully
    closeModal();
    alert(`Room "${result.room.name}" created successfully! You can now switch to it.`);
  } else {
    // Room creation failed
    alert(result.message || 'Failed to create room. Please try again.');
  }
});

// Handle room deletion result
socket.on('roomDeletionResult', (result) => {
  if (result.success) {
    // Room was deleted successfully
    alert(`Room "${result.room.name}" deleted successfully!`);
    
    // If the deleted room was the current room, switch to general
    if (room === result.room.name) {
      room = 'general';
      roomSelect.value = 'general';
      socket.emit('switchRoom', { username, newRoom: 'general' });
      updateDeleteButtonVisibility();
    }
  } else {
    // Room deletion failed
    alert(result.message || 'Failed to delete room. Please try again.');
  }
});

// Handle new room created (from other users)
socket.on('roomCreated', (newRoom) => {
  // Add new room to dropdown
  const newOption = document.createElement('option');
  newOption.value = newRoom.name;
  newOption.textContent = `# ${newRoom.name}`;
  if (newRoom.description) {
    newOption.title = newRoom.description;
  }
  
  // Add to select dropdown
  roomSelect.appendChild(newOption);
});

// Handle room deleted (from other users)
socket.on('roomDeleted', (deletedRoom) => {
  // Remove room from dropdown
  const roomOption = roomSelect.querySelector(`option[value="${deletedRoom.name}"]`);
  if (roomOption) {
    roomOption.remove();
  }
  
  // If the deleted room was the current room, switch to general
  if (room === deletedRoom.name) {
    room = 'general';
    roomSelect.value = 'general';
    socket.emit('switchRoom', { username, newRoom: 'general' });
    updateDeleteButtonVisibility();
  }
});

// Handle available rooms update
socket.on('availableRooms', (rooms) => {
  // Clear existing options except the first one
  while (roomSelect.options.length > 1) {
    roomSelect.remove(1);
  }
  
  // Add rooms from server
  rooms.forEach(roomItem => {
    if (roomItem.name !== 'general') { // Skip general as it's already there
      const option = document.createElement('option');
      option.value = roomItem.name;
      option.textContent = `# ${roomItem.name}`;
      if (roomItem.description) {
        option.title = roomItem.description;
      }
      roomSelect.appendChild(option);
    }
  });
  
  // Update delete button visibility
  updateDeleteButtonVisibility();
});

// Function to update delete button visibility
function updateDeleteButtonVisibility() {
  if (deleteRoomBtn) {
    if (room && room.toLowerCase() !== 'general') {
      deleteRoomBtn.style.display = 'flex';
    } else {
      deleteRoomBtn.style.display = 'none';
    }
  }
}

       // Initial validation
       validateForm();
       
       // Initial delete button visibility
       updateDeleteButtonVisibility();
