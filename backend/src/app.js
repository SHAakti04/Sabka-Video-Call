import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import userRoutes from './routes/usersRoute.js';
dotenv.config();
import { connectToSocket } from "./controllers/socketManager.js";


// Debugging output for environment variables



const MongoUrl = process.env.MONGO_URL;
const app = express();
const server = createServer(app); // It takes the express app instance (app) and creates a HTTP server.This HTTP server is capable of handling incoming HTTP request
const io = connectToSocket(server); // /By attaching Socket.IO to the HTTP server, Socket.IO can listen for WebSocket connections and manage real-time events while sharing the same port as the Express app.
// Middleware setup
app.set('port', process.env.PORT || 8000);
app.use(cors());
app.use(express.json({ limit: '40kb' }));
app.use(express.urlencoded({ limit: '40kb', extended: true }));
app.use('/api/v1/users', userRoutes);

// Start function to connect to MongoDB and start the server
const start = async () => {
  try {
    if (!MongoUrl) {
      throw new Error('MONGO_URL is not defined in the environment variables');
    }

    // Connect to MongoDB
    const connectionDb = await mongoose.connect(MongoUrl);
    console.log('Database connected on host: ' + connectionDb.connection.host);

    // Start the server
    server.listen(app.get('port'), () => {
      console.log('Listening on port ' + app.get('port'));
    });
  } catch (error) {
    console.error('Error starting the server:', error.message);
    process.exit(1);
  }
};

start();
