import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
    const [joinRoomId, setJoinRoomId] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        setCreatePassword(Math.floor(1000 + Math.random() * 9000).toString());
    }, []);

    const handleJoin = () => {
        if (!joinRoomId) return alert('請輸入房號');
        if (!joinPassword) return alert('請輸入房門密碼才能進入唷！');
        // Actually for simplicity, we pass state and connect inside Room component
        // But checking if room exists is better. We'll verify inside Room component or here.
        // Let's just navigate to Room component and pass password via state.
        navigate(`/room/${joinRoomId}`, { state: { password: joinPassword } });
    };

    const handleCreate = () => {
        // Will create room in Room component upon entry, or fetch here via HTTP/Socket?
        // Since we didn't export socket here, it's easier to redirect to `/room/CREATE` and let Room.jsx handle it
        navigate(`/room/new`, { state: { createPassword } });
    };

    return (
        <div className="home-wrapper">
            <div className="glass-container">
                <h2 className="title">
                    羅茱組隊小工具 <span className="version">v1.6.4</span>
                </h2>
                
                <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                    <input 
                        type="text" 
                        className="input-field" 
                        placeholder="輸入房號" 
                        value={joinRoomId}
                        onChange={e => setJoinRoomId(e.target.value)}
                        style={{marginBottom: 0}}
                    />
                    <input 
                        type="text" 
                        className="input-field" 
                        placeholder="密碼" 
                        value={joinPassword}
                        onChange={e => setJoinPassword(e.target.value)}
                        style={{marginBottom: 0, width: '40%'}}
                    />
                </div>
                <button className="btn-primary" style={{width: '100%'}} onClick={handleJoin}>進入</button>
                
                <div className="divider">或者</div>
                
                <div className="input-row">
                    <input 
                        type="text" 
                        className="input-field" 
                        value={createPassword} 
                        readOnly
                        style={{marginBottom: 0, backgroundColor: '#eee', color: '#333'}}
                    />
                    <button className="btn-primary" onClick={handleCreate}>建立</button>
                </div>


            </div>

            <p style={{
                marginTop: '16px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.45)',
                textAlign: 'center',
                lineHeight: '1.6',
                maxWidth: '300px',
            }}>
                本工具僅供《Artale》遊戲交流使用，純屬非營利性質，與任何商業行為無關。
            </p>

        </div>
    );
};

export default Home;
