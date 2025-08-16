const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const userCount = document.getElementById('user-count');
const roomSelect = document.getElementById('room-select');
const sidebarToggle = document.getElementById('sidebar-toggle');
const chatSidebar = document.querySelector('.chat-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

// Get username and room from URL
let { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

// Validate that both username and room are provided
if (!username || !room) {
  alert('Missing username or room. Please go back and fill in all required fields.');
  window.location.href = '../index.html';
}

const socket = io();

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
  roomSelect.addEventListener('change', (e) => {
    const newRoom = e.target.value;
    
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
