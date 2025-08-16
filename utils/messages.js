const moment = require("moment");
const { createClient } = require("redis");

// Redis client for message storage
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redisClient = createClient({ url: redisUrl });

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log("✅ Redis connected for message storage");
  } catch (error) {
    console.log("⚠️ Redis not available, using in-memory fallback");
  }
})();

function formatMessage(username, text) {
  return {
    username,
    text,
    time: moment().format("h:mm a"),
  };
}

// Message history storage with Redis fallback
const messageHistory = new Map(); // Fallback in-memory storage
const MAX_MESSAGES_PER_ROOM = 100; // Keep last 100 messages per room

// Add message to history
async function addMessageToHistory(room, message) {
  try {
    if (redisClient.isReady) {
      // Store in Redis
      const key = `room:${room}:messages`;
      await redisClient.lPush(key, JSON.stringify(message));
      await redisClient.lTrim(key, 0, MAX_MESSAGES_PER_ROOM - 1);
    } else {
      // Fallback to in-memory
      if (!messageHistory.has(room)) {
        messageHistory.set(room, []);
      }
      
      const roomMessages = messageHistory.get(room);
      roomMessages.push(message);
      
      // Keep only the last MAX_MESSAGES_PER_ROOM messages
      if (roomMessages.length > MAX_MESSAGES_PER_ROOM) {
        roomMessages.splice(0, roomMessages.length - MAX_MESSAGES_PER_ROOM);
      }
    }
  } catch (error) {
    console.error("Error storing message:", error);
    // Fallback to in-memory if Redis fails
    if (!messageHistory.has(room)) {
      messageHistory.set(room, []);
    }
    messageHistory.get(room).push(message);
  }
}

// Get message history for a room
async function getMessageHistory(room) {
  try {
    if (redisClient.isReady) {
      // Get from Redis
      const key = `room:${room}:messages`;
      const messages = await redisClient.lRange(key, 0, -1);
      return messages.map(msg => JSON.parse(msg)).reverse(); // Reverse to show oldest first
    } else {
      // Fallback to in-memory
      return messageHistory.get(room) || [];
    }
  } catch (error) {
    console.error("Error retrieving messages:", error);
    // Fallback to in-memory if Redis fails
    return messageHistory.get(room) || [];
  }
}

// Clear message history for a room
async function clearMessageHistory(room) {
  try {
    if (redisClient.isReady) {
      // Clear from Redis
      const key = `room:${room}:messages`;
      await redisClient.del(key);
    } else {
      // Fallback to in-memory
      messageHistory.delete(room);
    }
  } catch (error) {
    console.error("Error clearing messages:", error);
    messageHistory.delete(room);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await redisClient.quit();
    console.log("Redis connection closed");
  } catch (error) {
    console.error("Error closing Redis:", error);
  }
  process.exit(0);
});

module.exports = {
  formatMessage,
  addMessageToHistory,
  getMessageHistory,
  clearMessageHistory,
};
