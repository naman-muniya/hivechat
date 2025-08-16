const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const { formatMessage, addMessageToHistory, getMessageHistory } = require("./utils/messages");
const createAdapter = require("@socket.io/redis-adapter").createAdapter;
const redis = require("redis");
require("dotenv").config();
const { createClient } = redis;
const {
  userJoin,
  getCurrentUser,
  userLeave,
  updateUserRoom,
  getRoomUsers,
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

const botName = "HiveChat Bot";

(async () => {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  pubClient = createClient({ url: redisUrl });
  await pubClient.connect();
  subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
})();

// Run when client connects
io.on("connection", (socket) => {
  console.log(io.of("/").adapter);
  
  socket.on("joinRoom", async ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    socket.join(user.room);

    // Send message history to the joining user
    const messageHistory = await getMessageHistory(user.room);
    if (messageHistory.length > 0) {
      socket.emit("messageHistory", messageHistory);
    }

    // Welcome current user
    const welcomeMessage = formatMessage(botName, `Welcome to server: ${user.room}`);
    socket.emit("message", welcomeMessage);
    await addMessageToHistory(user.room, welcomeMessage);

    // Broadcast when a user connects
    const joinMessage = formatMessage(botName, `${user.username} has joined the chat`);
    socket.broadcast
      .to(user.room)
      .emit("message", joinMessage);
    await addMessageToHistory(user.room, joinMessage);

    // Send users and room info
    io.to(user.room).emit("roomUsers", {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  // Handle room switching
  socket.on("leaveRoom", async ({ username, room }) => {
    const user = getCurrentUser(socket.id);
    
    if (user) {
      // Leave the current room
      socket.leave(user.room);
      
      // Broadcast when a user leaves
      const leaveMessage = formatMessage(botName, `${user.username} has left the chat`);
      socket.broadcast
        .to(user.room)
        .emit("message", leaveMessage);
      await addMessageToHistory(user.room, leaveMessage);

      // Send users and room info for the room they left
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });

  // Handle room switching (new event)
  socket.on("switchRoom", async ({ username, newRoom }) => {
    const user = getCurrentUser(socket.id);
    
    if (user) {
      const oldRoom = user.room;
      
      // Update user's room
      updateUserRoom(socket.id, newRoom);
      
      // Leave old room
      socket.leave(oldRoom);
      
      // Join new room
      socket.join(newRoom);
      
      // Notify old room that user left
      const leaveMessage = formatMessage(botName, `${user.username} has left the chat`);
      socket.broadcast
        .to(oldRoom)
        .emit("message", leaveMessage);
      await addMessageToHistory(oldRoom, leaveMessage);

      // Send message history to the user for the new room
      const messageHistory = await getMessageHistory(newRoom);
      if (messageHistory.length > 0) {
        socket.emit("messageHistory", messageHistory);
      }

      // Notify new room that user joined
      const joinMessage = formatMessage(botName, `${user.username} has joined the chat`);
      socket.broadcast
        .to(newRoom)
        .emit("message", joinMessage);
      await addMessageToHistory(newRoom, joinMessage);

      // Send users and room info for both rooms
      io.to(oldRoom).emit("roomUsers", {
        room: oldRoom,
        users: getRoomUsers(oldRoom),
      });
      
      io.to(newRoom).emit("roomUsers", {
        room: newRoom,
        users: getRoomUsers(newRoom),
      });
    }
  });

  // Listen for chatMessage
  socket.on("chatMessage", async (msg) => {
    const user = getCurrentUser(socket.id);

    if (user) {
      const message = formatMessage(user.username, msg);
      io.to(user.room).emit("message", message);
      await addMessageToHistory(user.room, message);
    }
  });

  // Runs when client disconnects
  socket.on("disconnect", async () => {
    const user = userLeave(socket.id);

    if (user) {
      const leaveMessage = formatMessage(botName, `${user.username} has left the chat`);
      io.to(user.room).emit("message", leaveMessage);
      await addMessageToHistory(user.room, leaveMessage);

      // Send users and room info
      io.to(user.room).emit("roomUsers", {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));