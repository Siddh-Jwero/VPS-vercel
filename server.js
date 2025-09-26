const WebSocket = require('ws');
const pty = require('node-pty');
const http = require('http');

const PORT = 8080; // Ensure this port is open on your VPS firewall

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server for shell is running.\n');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Spawn a new shell for each connection
    const shell = pty.spawn('bash', [], {
        name: 'xterm-color',
        cols: 80, // Default columns
        rows: 30, // Default rows
        cwd: process.env.HOME,
        env: process.env
    });

    // Send shell output to the client
    shell.onData((data) => {
        ws.send(data);
    });

    // Send client input to the shell
    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'resize') {
                shell.resize(parsedMessage.cols, parsedMessage.rows);
            } else {
                shell.write(message.toString());
            }
        } catch (e) {
            // If not JSON, assume it's direct terminal input
            shell.write(message.toString());
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        shell.kill(); // Kill the shell process when the client disconnects
    });

    // Handle shell exit
    shell.onExit(({ exitCode, signal }) => {
        console.log(`Shell exited with code ${exitCode}, signal ${signal}`);
        ws.close();
    });

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        shell.kill();
    };
});

server.listen(PORT, () => {
    console.log(`WebSocket server started on port ${PORT}`);
});
