/* eslint-disable prettier/prettier */
import { createServer } from "http";
import express from "express";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000; // Choose a port for the socket server
const userSocketMap = new Map();

const app = express();
const httpServer = createServer(app);

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL || "http://localhost:3000"
        : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket.IO connection handler
io.on("connection", (socket) => {

  // Register user to socket ID mapping
  socket.on("registerUser", (userId) => {
    userSocketMap.set(userId, socket.id);
  });

  // Handle feedback submissionc
  socket.on("sendFeedback", async (data) => {
    try {
      if (data.feedbackMessage && data.feedbackMessage.trim() !== "") {
        // Save feedback to the database
        const feedback = await prisma.feedback.create({
          data: {
            feedbackMessage: data.feedbackMessage,
            sender: data.sender,
          },
        });

        const senderSocketId = userSocketMap.get(data.sender);

        // Send acknowledgment back to the sender
        if (senderSocketId) {
          io.to(senderSocketId).emit("feedbackAck", {
            message: "Feedback Sent Successfully",
          });
        } else {
          console.warn(`Sender socket ID not found for user: ${data.sender}`);
        }
      } else {
        console.warn("Feedback message is empty. Feedback not saved.");
      }
    } catch (error) {
      console.error("Error saving feedback:", error);
    }
  });

  // Handle disconnection and cleanup
  socket.on("disconnect", () => {
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        break;
      }
    }
  });
});

// Start the Socket.IO server
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});
