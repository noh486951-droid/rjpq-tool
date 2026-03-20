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

const generateRoomId = () => {
    let id;
    do { id = Math.floor(100000 + Math.random() * 900000).toString(); } while (rooms[id]);
    return id;
};

const createEmptyGrid = () => {
    const grid = {};
    for (let i = 1; i <= 10; i++) {
        // [1, 2, 3, 4] columns
        grid[i] = [null, null, null, null];
    }
    return grid;
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_room', ({ password }, callback) => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            id: roomId,
            password: password || Math.floor(1000 + Math.random() * 9000).toString(),
            grid: createEmptyGrid(),
            occupiedColors: {} // { orange: socketId, ... }
        };
        socket.join(roomId);
        callback({ success: true, roomId, room: rooms[roomId] });
    });

    socket.on('join_room', ({ roomId, password }, callback) => {
        const room = rooms[roomId];
        if (!room) {
            return callback({ success: false, message: '找不到該房間' });
        }
        if (room.password !== password) {
            return callback({ success: false, message: '房號或密碼錯誤' });
        }
        socket.join(roomId);
        callback({ success: true, room });
    });

    socket.on('leave_room', ({ roomId }) => {
        if (rooms[roomId]) {
            // Unclaim color on leave
            Object.keys(rooms[roomId].occupiedColors).forEach(c => {
                if (rooms[roomId].occupiedColors[c] === socket.id) {
                    delete rooms[roomId].occupiedColors[c];
                }
            });
            io.to(roomId).emit('color_status_update', rooms[roomId].occupiedColors);
        }
        socket.leave(roomId);
    });

    socket.on('claim_color', ({ roomId, color }) => {
        if (rooms[roomId]) {
            const occ = rooms[roomId].occupiedColors;
            // Unclaim previous color of this socket
            Object.keys(occ).forEach(c => {
                if (occ[c] === socket.id) delete occ[c];
            });
            
            if (color && !occ[color]) {
                occ[color] = socket.id;
            }
            io.to(roomId).emit('color_status_update', occ);
        }
    });

    socket.on('update_cell', ({ roomId, row, col, color }) => {
        if (rooms[roomId]) {
            const grid = rooms[roomId].grid;
            // Prevent overwriting someone else's color
            if (grid[row][col] && grid[row][col] !== color) {
                return;
            }

            if (grid[row][col] === color) {
                grid[row][col] = null;
            } else {
                // Enforce: one color can only be in one column per row
                for (let c = 0; c < 4; c++) {
                    if (grid[row][c] === color) {
                        grid[row][c] = null;
                    }
                }
                grid[row][col] = color;
            }
            io.to(roomId).emit('grid_update', grid);
        }
    });

    socket.on('clear_color', ({ roomId, color }) => {
        if (rooms[roomId]) {
            const grid = rooms[roomId].grid;
            let updated = false;
            for (let r = 1; r <= 10; r++) {
                for (let c = 0; c < 4; c++) {
                    if (grid[r][c] === color) {
                        grid[r][c] = null;
                        updated = true;
                    }
                }
            }
            if (updated) {
                io.to(roomId).emit('grid_update', grid);
            }
        }
    });



    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Find all rooms this socket was in and unclaim their color
        Object.keys(rooms).forEach(roomId => {
            const occ = rooms[roomId].occupiedColors;
            let updated = false;
            Object.keys(occ).forEach(c => {
                if (occ[c] === socket.id) {
                    delete occ[c];
                    updated = true;
                }
            });
            if (updated) {
                io.to(roomId).emit('color_status_update', occ);
            }
        });
    });
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Socket.IO Server running on port ${PORT}`);
});
