import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Copy, LogOut, PaintRoller, Bell, Check, ClipboardType, User } from 'lucide-react';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : undefined;
const socket = io(SOCKET_URL);

const colors = ['orange', 'green', 'blue', 'pink'];

const Room = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [roomData, setRoomData] = useState(null);
    const [selectedColor, setSelectedColor] = useState('orange');
    const [occupiedColors, setOccupiedColors] = useState({}); // { orange: 'socketId', ... }
    const [error, setError] = useState('');

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const pwdFromUrl = searchParams.get('pwd');

        if (roomId === 'new') {
            const password = location.state?.createPassword || '5299';
            socket.emit('create_room', { password }, (res) => {
                if (res.success) {
                    setRoomData(res.room);
                    setOccupiedColors(res.room.occupiedColors || {});
                    // Initially claim orange if free
                    if (!res.room.occupiedColors?.orange) {
                        socket.emit('claim_color', { roomId: res.roomId, color: 'orange' });
                    }
                    navigate(`/room/${res.roomId}`, { replace: true, state: { password: res.room.password, isJoined: true } });
                }
            });
        } else if (!location.state?.isJoined) {
            const password = location.state?.password || pwdFromUrl || '';
            socket.emit('join_room', { roomId, password }, (res) => {
                if (res.success) {
                    setRoomData(res.room);
                } else {
                    setError(res.message);
                    alert(res.message);
                    navigate('/');
                }
            });
        } else {
             // Re-join logic if already redirected from create
             const password = location.state?.password || pwdFromUrl || '';
             socket.emit('join_room', { roomId, password }, (res) => {
                 if (res.success) setRoomData(res.room);
             });
        }

        socket.on('grid_update', (newGrid) => {
            setRoomData(prev => prev ? { ...prev, grid: newGrid } : null);
        });

        socket.on('color_status_update', (occ) => {
            setOccupiedColors(occ);
        });

        return () => {
            socket.off('grid_update');
            socket.off('color_status_update'); // Add cleanup for color_status_update
            socket.emit('leave_room', { roomId: roomData?.id || roomId });
        };
    }, [roomId, location.state, navigate]);

    if (error) return <div className="room-wrapper"><h3 style={{color:'white'}}>Error joining room</h3></div>;
    if (!roomData) return <div className="room-wrapper"><h3 style={{color:'white'}}>載入中...</h3></div>;

    const handleColorSelect = (color) => {
        // If color is taken by someone else, alert
        if (occupiedColors[color] && occupiedColors[color] !== socket.id) {
            alert('這個顏色已經有人在那裡囉！');
            return;
        }
        setSelectedColor(color);
        socket.emit('claim_color', { roomId: roomData.id, color });
    };

    const handleCellClick = (row, col) => {
        // Optimistic update for better UX (optional but helps if server is laggy)
        // For now, we mainly need the backend to process it. 
        // Let's ensure the user is pushing the code.
        socket.emit('update_cell', { roomId: roomData.id, row, col, color: selectedColor });
    };

    const handleClearColor = () => {
        socket.emit('clear_color', { roomId: roomData.id, color: selectedColor });
    };

    const handleCopyUnfilled = () => {
        // Collect indices of null cells for each row 1 to 10
        let result = '';
        for (let r = 1; r <= 10; r++) {
            const row = roomData.grid[r];
            const unfilled = [];
            row.forEach((cell, idx) => {
                if (cell === null) unfilled.push(idx + 1);
            });
            // If multiple unfilled, we can join them or just take the first. 
            // User requested something like 14512... which implies 1 digit per row.
            result += unfilled.length > 0 ? unfilled[0] : 'X'; 
            if (r === 5) result += ' '; // Add a space for readability as requested 14512 21432
        }
        navigator.clipboard.writeText(result);
        alert(`已複製未選格子：${result}\n(這通常是給第四位不在線的人參考用的)`);
    };

    const copyRoomInfo = () => {
        const url = `${window.location.origin}/room/${roomData.id}?pwd=${roomData.password}`;
        const text = `邀請您加入羅茱組隊小工具！\n網址: ${url}\n房號: ${roomData.id}\n密碼: ${roomData.password}`;
        navigator.clipboard.writeText(text);
        alert('已複製網址、房號與密碼！');
    };

    return (
        <div className="room-wrapper">
            <div className="room-container">
                
                {/* Header */}
                <div className="room-header">
                    <div className="room-info">
                        <div className="room-details">
                            <span>房號: <strong>{roomData.id}</strong></span>
                            <span>密碼: <strong>{roomData.password}</strong></span>
                        </div>
                    </div>
                    <button className="copy-btn" onClick={copyRoomInfo} title="複製房號密碼">
                        <Copy size={30} />
                    </button>
                    
                    <div className="color-palette">
                        {colors.map(c => (
                            <button 
                                key={c}
                                className={`color-btn ${selectedColor === c ? 'selected' : ''} ${occupiedColors[c] && occupiedColors[c] !== socket.id ? 'occupied' : ''}`}
                                style={{ backgroundColor: `var(--color-${c})` }}
                                onClick={() => handleColorSelect(c)}
                            >
                                {selectedColor === c && <Check color="white" size={36} />}
                                {occupiedColors[c] && occupiedColors[c] !== socket.id && <User color="rgba(0,0,0,0.4)" size={32} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="action-row">
                    <button className="btn-leave" onClick={() => navigate('/')} title="退出房間">
                        <LogOut size={30} />
                    </button>
                    <button className="btn-clear" onClick={handleClearColor} title={`清除所有 ${selectedColor} 標記`}>
                        <PaintRoller size={30} />
                    </button>
                    <button className="btn-view" onClick={handleCopyUnfilled} style={{backgroundColor: '#6c5ce7'}} title="複製未選取格子 (3人團適用)">
                        <ClipboardType size={30} />
                    </button>
                </div>

                {/* Grid */}
                <div className="grid-section">
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(row => (
                        <div key={row} className="grid-row">
                            <span className="row-label">{row}</span>
                            {roomData.grid[row].map((cellColor, col) => (
                                <button 
                                    key={col}
                                    className="grid-cell"
                                    style={{ backgroundColor: cellColor ? `var(--color-${cellColor})` : undefined, color: 'white' }}
                                    onClick={() => handleCellClick(row, col)}
                                >
                                    {col + 1}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

            </div>

        </div>
    );
};

export default Room;
