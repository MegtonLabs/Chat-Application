// server.js
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');       // File System module to read index.html
const path = require('path');     // Path module to correctly locate index.html
const open = require('open');     // To automatically open the browser

const PORT = process.env.PORT || 8080;

// --- 1. HTTP Server Setup ---
// Handles HTTP requests (serving index.html) and WebSocket upgrades.
const server = http.createServer((req, res) => {
    // Serve index.html for the root URL request
    if (req.url === '/' && req.method === 'GET') {
        const filePath = path.join(__dirname, 'index.html'); // Make sure index.html is in the same directory

        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.error("Error reading index.html:", err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error - Could not load index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        // Respond with 404 for any other HTTP request
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

// --- 2. WebSocket Server Setup ---
// Attach WebSocket server to the HTTP server.
const wss = new WebSocket.Server({ server });

console.log('WebSocket server components initialized...');

// A Set to keep track of all connected WebSocket clients
const clients = new Set();

// --- 3. WebSocket Connection Handling ---
wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws); // Add the new client to our set

    // Send a welcome message (as JSON) to the newly connected client
    // Note: Client should only connect *after* getting a username,
    // so this welcome message makes sense contextually.
    try {
        const welcomeMessage = JSON.stringify({
            type: 'system',
            text: 'Welcome to the Real-Time Chat!'
        });
        ws.send(welcomeMessage);
    } catch (error) {
        console.error("Error sending welcome message:", error);
    }

    // Handle messages received from this specific client
    ws.on('message', (message) => {
        const messageString = message.toString(); // Ensure message is a string
        console.log('Received message: %s', messageString);

        // We expect the messageString to be JSON like { type: 'chat', username: '...', text: '...' }
        // Broadcast the *exact* received message string to ALL clients (including sender)
        broadcast(messageString, ws);
    });

    // Handle client closing the connection
    ws.on('close', (code, reason) => {
        console.log(`Client disconnected. Code: ${code}, Reason: ${reason}`);
        clients.delete(ws); // Remove the client from the set
        // Optional: Broadcast a leave message if you have username info stored server-side
        // Currently, only clients know usernames, so broadcasting a generic leave is tricky
    });

    // Handle WebSocket errors for this client
    ws.on('error', (error) => {
        console.error('WebSocket error for a client:', error);
        clients.delete(ws); // Clean up on error
    });
});

// --- 4. Broadcast Function ---
// Sends a message string to all currently connected clients
function broadcast(messageString, sender) {
    console.log(`Broadcasting message to ${clients.size} clients.`);
    clients.forEach((client) => {
        // Check if the client connection is still open
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(messageString); // Send the JSON string
            } catch (error) {
                console.error("Error sending message during broadcast:", error);
                clients.delete(client); // Remove client if sending fails
            }
        } else {
            // Optional: Clean up clients that are not open
             // console.log("Removing stale client during broadcast.");
             // clients.delete(client);
        }
    });
}

// --- 5. Start the Server and Open Browser ---
server.listen(PORT, async () => { // Use async for await
    const url = `http://localhost:${PORT}`;
    console.log(`Server started. HTTP and WebSocket listening on ${url}`);

    // Attempt to automatically open the chat in the default browser
    try {
        await open(url);
        console.log(`Launched chat in default browser at ${url}`);
    } catch (err) {
        console.error(`Failed to open browser automatically. Please navigate to ${url} manually. Error:`, err);
    }
});

// Optional: Global error handling for the WebSocket server itself
wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

console.log('Server script finished setup. Waiting for connections...');