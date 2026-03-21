const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

// Maps socketId -> { roomId, userId }
const socketMeta = {};

// Grace-period timers for disconnected users
const disconnectTimers = {};

const DISCONNECT_GRACE_MS = 30 * 1000; // 30 seconds

const generateRoomId = () => {
    let id;
    do { id = Math.floor(100000 + Math.random() * 900000).toString(); } while (rooms[id]);
    return id;
};

const createEmptyGrid = () => {
    const grid = {};
    for (let i = 1; i <= 10; i++) {
        grid[i] = [null, null, null, null];
    }
    return grid;
};

// Remove a userId's color claim from a room and broadcast
const unclaimColor = (roomId, userId) => {
    const room = rooms[roomId];
    if (!room) return;
    let changed = false;
    Object.keys(room.occupiedColors).forEach(c => {
        if (room.occupiedColors[c] === userId) {
            delete room.occupiedColors[c];
            changed = true;
        }
    });
    if (changed) io.to(roomId).emit('color_status_update', room.occupiedColors);
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ password, userId }, callback) => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            id: roomId,
            password: password || Math.floor(1000 + Math.random() * 9000).toString(),
            grid: createEmptyGrid(),
            occupiedColors: {} // { color: userId }
        };
        socketMeta[socket.id] = { roomId, userId };
        socket.join(roomId);
        callback({ success: true, roomId, room: rooms[roomId] });
    });

    socket.on('join_room', ({ roomId, password, userId }, callback) => {
        const room = rooms[roomId];
        if (!room) {
            return callback({ success: false, message: '找不到該房間' });
        }
        if (room.password !== password) {
            return callback({ success: false, message: '房號或密碼錯誤' });
        }
        // Cancel any pending disconnect cleanup for this user
        const timerKey = `${roomId}:${userId}`;
        if (disconnectTimers[timerKey]) {
            clearTimeout(disconnectTimers[timerKey]);
            delete disconnectTimers[timerKey];
        }
        socketMeta[socket.id] = { roomId, userId };
        socket.join(roomId);
        callback({ success: true, room });
    });

    socket.on('leave_room', ({ roomId, userId }) => {
        const room = rooms[roomId];
        if (room && userId) {
            unclaimColor(roomId, userId);
        }
        socket.leave(roomId);
        delete socketMeta[socket.id];
    });

    socket.on('claim_color', ({ roomId, color, userId }) => {
        const room = rooms[roomId];
        if (!room || !userId) return;
        const occ = room.occupiedColors;
        // Unclaim any previous color this userId held
        Object.keys(occ).forEach(c => {
            if (occ[c] === userId) delete occ[c];
        });
        if (color && !occ[color]) {
            occ[color] = userId;
        }
        io.to(roomId).emit('color_status_update', occ);
    });

    socket.on('update_cell', ({ roomId, row, col, color }) => {
        const room = rooms[roomId];
        if (!room) return;
        const grid = room.grid;
        if (grid[row][col] && grid[row][col] !== color) return;
        if (grid[row][col] === color) {
            grid[row][col] = null;
        } else {
            for (let c = 0; c < 4; c++) {
                if (grid[row][c] === color) grid[row][c] = null;
            }
            grid[row][col] = color;
        }
        io.to(roomId).emit('grid_update', grid);
    });

    socket.on('clear_color', ({ roomId, color }) => {
        const room = rooms[roomId];
        if (!room) return;
        const grid = room.grid;
        let updated = false;
        for (let r = 1; r <= 10; r++) {
            for (let c = 0; c < 4; c++) {
                if (grid[r][c] === color) { grid[r][c] = null; updated = true; }
            }
        }
        if (updated) io.to(roomId).emit('grid_update', grid);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const meta = socketMeta[socket.id];
        if (meta) {
            const { roomId, userId } = meta;
            delete socketMeta[socket.id];
            // Start grace period before releasing their color
            const timerKey = `${roomId}:${userId}`;
            if (!disconnectTimers[timerKey]) {
                disconnectTimers[timerKey] = setTimeout(() => {
                    unclaimColor(roomId, userId);
                    delete disconnectTimers[timerKey];
                }, DISCONNECT_GRACE_MS);
            }
        }
    });
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Socket.IO Server running on port ${PORT}`);
});
