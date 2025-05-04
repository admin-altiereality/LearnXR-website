import { env } from "@/config/env";
import cors from "cors";
import express, { json } from "express";
import { router } from "@/routes";
import path from 'path';

const server = express();

server.use(json());

// Get the absolute path to the build directory
const buildPath = path.resolve(process.cwd(), 'client/dist');

// Serve static files from the React app build directory
server.use(express.static(buildPath, {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }
}));

const corsOptions = {
  origin: [
    'https://in3d.evoneural.ai',
    'http://localhost:3000',
    'http://localhost:5173',
    '${apiUrl}'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

server.use(cors(corsOptions));

server.use("/api", router);

// Handle React routing, return all requests to React app
server.get('*', function(req, res) {
  const indexPath = path.join(buildPath, 'index.html');
  
  // Log the path being accessed (helpful for debugging)
  console.log('Attempting to serve:', indexPath);
  
  res.sendFile(indexPath, function(err) {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send(err);
    }
  });
});

server.listen(env.SERVER_PORT, async () => {
  console.log(`Server is running at port ${env.SERVER_PORT}`);
  console.log('Build path:', buildPath);
});
