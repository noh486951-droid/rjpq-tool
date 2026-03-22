import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import { Copy, LogOut, PaintRoller, Check, ClipboardType, User, PictureInPicture } from 'lucide-react'
import { getOrCreateUserId, saveRoomSession, clearRoomSession } from '../utils/user'

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : undefined
const socket = io(SOCKET_URL, { autoConnect: true })
const MY_USER_ID = getOrCreateUserId()
const colors = ['orange', 'green', 'blue', 'pink']

// ─── PiP Grid Renderer ──────────────────────────────────────────────────────
// Renders the interactive grid, with an optional compact/PiP mode style
const GridView = ({ grid, selectedColor, onCellClick, compact = false }) => {
  if (!grid) return null

  // In PiP (compact) mode the container fills whatever vertical space it has;
  // each row gets an equal flex share, so resizing the PiP window scales everything.
  const containerStyle = compact
    ? { display: 'flex', flexDirection: 'column', gap: '3px', padding: '0 4px 4px', flex: 1, minHeight: 0 }
    : { display: 'flex', flexDirection: 'column', gap: '6px' }

  const rowStyle = compact
    ? { display: 'flex', alignItems: 'stretch', gap: '3px', background: 'rgba(0,0,0,0.35)', padding: '2px 4px', borderRadius: '8px', flex: 1, minHeight: 0 }
    : { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.35)', padding: '6px', borderRadius: '10px' }

  return (
    <div style={containerStyle}>
      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((row) => (
        <div key={row} style={rowStyle}>
          <span
            style={{
              width: compact ? '18px' : '35px',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: compact ? 'clamp(9px, 1.5vh, 13px)' : '16px',
              color: '#888899',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {row}
          </span>
          {grid[row].map((cellColor, col) => (
            <button
              key={col}
              onClick={() => onCellClick(row, col)}
              style={{
                flex: 1,
                height: compact ? '100%' : '40px',
                minHeight: compact ? 0 : 'auto',
                background: cellColor
                  ? cellColor === 'orange' ? '#ff9f43'
                  : cellColor === 'green' ? '#1dd1a1'
                  : cellColor === 'blue' ? '#54a0ff'
                  : '#ff9ff3'
                  : '#2a2a35',
                border: cellColor === selectedColor
                  ? '2px solid rgba(255,255,255,0.9)'
                  : '1px solid rgba(255,255,255,0.07)',
                borderRadius: '6px',
                color: 'white',
                fontSize: compact ? 'clamp(9px, 1.6vh, 14px)' : '18px',
                fontWeight: 'bold',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                boxShadow: cellColor ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {col + 1}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── PiP Portal Content ─────────────────────────────────────────────────────
const PiPContent = ({ pipWin, grid, selectedColor, occupiedColors, onCellClick, onColorSelect, onClearColor, onCopyUnfilled }) => {
  if (!pipWin) return null

  const colorMap = {
    orange: { bg: '#ff9f43', label: '橙' },
    green: { bg: '#1dd1a1', label: '綠' },
    blue: { bg: '#54a0ff', label: '藍' },
    pink: { bg: '#ff9ff3', label: '粉' },
  }

  const content = (
    <div
      style={{
        fontFamily: "'Noto Sans TC', 'Segoe UI', sans-serif",
        backgroundColor: '#0f0f12',
        background: 'radial-gradient(circle at top right, #1a1a2e, #0f0f12)',
        height: '100dvh',
        padding: '8px',
        boxSizing: 'border-box',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          background: 'rgba(0,210,255,0.1)',
          border: '1px solid rgba(0,210,255,0.25)',
          borderRadius: '10px',
          padding: '6px 10px',
        }}
      >
        <span style={{ fontSize: '12px', color: '#00d2ff', fontWeight: 'bold', letterSpacing: '0.05em' }}>
          🎲 羅茱 PiP 模式
        </span>
        <span style={{ fontSize: '11px', color: '#888899' }}>選色後點格</span>
      </div>

      {/* Color selector */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '8px',
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '12px',
          padding: '8px',
        }}
      >
        {colors.map((c) => {
          const taken = occupiedColors[c] && occupiedColors[c] !== MY_USER_ID
          const isSelected = selectedColor === c
          return (
            <button
              key={c}
              onClick={() => !taken && onColorSelect(c)}
              style={{
                flex: 1,
                height: '38px',
                borderRadius: '9px',
                background: colorMap[c].bg,
                border: isSelected ? '3px solid white' : '2px solid transparent',
                opacity: taken ? 0.4 : 1,
                cursor: taken ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isSelected ? `0 0 14px ${colorMap[c].bg}` : '0 2px 8px rgba(0,0,0,0.3)',
                transform: isSelected ? 'scale(1.08)' : 'none',
                transition: 'all 0.2s',
                fontSize: '13px',
                fontWeight: 'bold',
                color: 'rgba(0,0,0,0.6)',
              }}
            >
              {isSelected ? <Check size={18} color="white" strokeWidth={3} /> : (taken ? <User size={15} color="rgba(0,0,0,0.5)" /> : colorMap[c].label)}
            </button>
          )
        })}
      </div>

      {/* Action buttons in PiP */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '8px',
        }}
      >
        <button
          onClick={onClearColor}
          title={`清除所有 ${selectedColor} 標記`}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: '9px',
            background: 'rgba(0,210,255,0.15)',
            border: '1px solid rgba(0,210,255,0.3)',
            color: '#00d2ff',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <PaintRoller size={15} /> 清除
        </button>
        <button
          onClick={() => onCopyUnfilled(pipWin)}
          title="複製第4人未選格子"
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: '9px',
            background: 'rgba(108,92,231,0.25)',
            border: '1px solid rgba(108,92,231,0.5)',
            color: '#a29bfe',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <ClipboardType size={15} /> 複製
        </button>
      </div>

      {/* Grid */}
      <GridView grid={grid} selectedColor={selectedColor} onCellClick={onCellClick} compact />
    </div>
  )

  return createPortal(content, pipWin.document.body)
}

// ─── Main Room Component ────────────────────────────────────────────────────
const Room = () => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [roomData, setRoomData] = useState(null)
  const [selectedColor, setSelectedColor] = useState('orange')
  const [occupiedColors, setOccupiedColors] = useState({})
  const [error, setError] = useState('')
  const [pipSupported] = useState(() => 'documentPictureInPicture' in window)
  const [pipWindow, setPipWindow] = useState(null)

  const roomDataRef = useRef(null)
  useEffect(() => { roomDataRef.current = roomData }, [roomData])

  // Setup socket listeners & join room
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const pwdFromUrl = searchParams.get('pwd')

    const doJoin = (rId, pwd) => {
      socket.emit('join_room', { roomId: rId, password: pwd, userId: MY_USER_ID }, (res) => {
        if (res.success) {
          setRoomData(res.room)
          setOccupiedColors(res.room.occupiedColors || {})
          saveRoomSession(rId, pwd)
        } else {
          setError(res.message)
          alert(res.message)
          navigate('/')
        }
      })
    }

    if (roomId === 'new') {
      const password = location.state?.createPassword || '5299'
      socket.emit('create_room', { password, userId: MY_USER_ID }, (res) => {
        if (res.success) {
          setRoomData(res.room)
          setOccupiedColors(res.room.occupiedColors || {})
          if (!res.room.occupiedColors?.orange) {
            socket.emit('claim_color', { roomId: res.roomId, color: 'orange', userId: MY_USER_ID })
          }
          saveRoomSession(res.roomId, res.room.password)
          navigate(`/room/${res.roomId}`, { replace: true, state: { password: res.room.password, isJoined: true } })
        }
      })
    } else {
      const password = location.state?.password || pwdFromUrl || ''
      doJoin(roomId, password)
    }

    socket.on('grid_update', (newGrid) => setRoomData((prev) => (prev ? { ...prev, grid: newGrid } : null)))
    socket.on('color_status_update', (occ) => setOccupiedColors(occ))

    return () => {
      socket.off('grid_update')
      socket.off('color_status_update')
      socket.emit('leave_room', { roomId: roomDataRef.current?.id || roomId, userId: MY_USER_ID })
      clearRoomSession()
    }
  }, [roomId, location.state, navigate])

  // Reconnect on tab visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (!socket.connected) socket.connect()
      const rd = roomDataRef.current
      if (!rd) return
      const pwd = location.state?.password || new URLSearchParams(window.location.search).get('pwd') || rd.password || ''
      socket.emit('join_room', { roomId: rd.id, password: pwd, userId: MY_USER_ID }, (res) => {
        if (res.success) {
          setRoomData(res.room)
          setOccupiedColors(res.room.occupiedColors || {})
          socket.emit('claim_color', { roomId: rd.id, color: selectedColor, userId: MY_USER_ID })
        }
      })
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [location.state, selectedColor])

  // Heartbeat
  useEffect(() => {
    const interval = setInterval(() => fetch('/api/ping').catch(() => {}), 300_000)
    return () => clearInterval(interval)
  }, [])

  // Helpers
  const handleColorSelect = (color) => {
    if (occupiedColors[color] && occupiedColors[color] !== MY_USER_ID) {
      alert('這個顏色已經有人在那裡囉！')
      return
    }
    setSelectedColor(color)
    if (roomData) socket.emit('claim_color', { roomId: roomData.id, color, userId: MY_USER_ID })
  }

  const handleCellClick = (row, col) => {
    if (roomData) socket.emit('update_cell', { roomId: roomData.id, row, col, color: selectedColor })
  }

  const handleClearColor = () => {
    if (roomData) socket.emit('clear_color', { roomId: roomData.id, color: selectedColor })
  }

  // win: the window whose clipboard & alert to use (main page or PiP window)
  const handleCopyUnfilled = (win = window) => {
    const fourthColor = colors.find((c) => !occupiedColors[c])
    let result = ''
    for (let r = 1; r <= 10; r++) {
      const row = roomData.grid[r] || []
      const unfilled = row.map((c, i) => (c === null ? i + 1 : null)).filter(Boolean)
      if (unfilled.length > 0) {
        result += unfilled[0]
      } else if (fourthColor) {
        const col = row.findIndex((c) => c === fourthColor)
        result += col >= 0 ? col + 1 : '?'
      } else {
        result += '?'
      }
      if (r === 5) result += ' '
    }
    win.navigator.clipboard.writeText(result).catch(() => {
      // Fallback: use textarea trick if clipboard API unavailable
      const el = win.document.createElement('textarea')
      el.value = result
      win.document.body.appendChild(el)
      el.select()
      win.document.execCommand('copy')
      win.document.body.removeChild(el)
    })
    win.alert(`已複製未選格子：${result}`)
  }

  const copyRoomInfo = () => {
    const url = `${window.location.origin}/room/${roomData.id}?pwd=${roomData.password}`
    navigator.clipboard.writeText(`邀請您加入羅茱組隊小工具！\n網址: ${url}\n房號: ${roomData.id}\n密碼: ${roomData.password}`)
    alert('已複製網址、房號與密碼！')
  }

  // PiP handler
  const handlePiP = async () => {
    if (!pipSupported) return
    if (pipWindow) { pipWindow.close(); return }
    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({ width: 320, height: 580 })

      // Inject Google Font into PiP
      const fontLink = pipWin.document.createElement('link')
      fontLink.rel = 'stylesheet'
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&display=swap'
      pipWin.document.head.appendChild(fontLink)

      // Reset body styles
      const baseStyle = pipWin.document.createElement('style')
      baseStyle.textContent = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
      `
      pipWin.document.head.appendChild(baseStyle)

      setPipWindow(pipWin)
      pipWin.addEventListener('pagehide', () => setPipWindow(null))
    } catch (e) {
      console.error('PiP failed:', e)
    }
  }

  if (error) return <div className="room-wrapper"><h3 style={{ color: 'white' }}>Error joining room</h3></div>
  if (!roomData) return <div className="room-wrapper"><h3 style={{ color: 'white' }}>載入中...</h3></div>

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
            {colors.map((c) => (
              <button
                key={c}
                className={`color-btn ${selectedColor === c ? 'selected' : ''} ${occupiedColors[c] && occupiedColors[c] !== MY_USER_ID ? 'occupied' : ''}`}
                style={{ backgroundColor: `var(--color-${c})` }}
                onClick={() => handleColorSelect(c)}
              >
                {selectedColor === c && <Check color="white" size={36} />}
                {occupiedColors[c] && occupiedColors[c] !== MY_USER_ID && <User color="rgba(0,0,0,0.4)" size={32} />}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="action-row">
          <button className="btn-leave" onClick={() => navigate('/')} title="退出房間"><LogOut size={30} /></button>
          <button className="btn-clear" onClick={handleClearColor} title={`清除所有 ${selectedColor} 標記`}><PaintRoller size={30} /></button>
          <button className="btn-view" onClick={() => handleCopyUnfilled()} style={{ backgroundColor: '#6c5ce7' }} title="複製未選取格子"><ClipboardType size={30} /></button>
          {pipSupported && (
            <button
              className="btn-view"
              onClick={handlePiP}
              style={{ backgroundColor: pipWindow ? '#00b894' : '#0984e3' }}
              title={pipWindow ? '關閉子母畫面' : '彈出子母畫面 (置頂, Chrome/Edge)'}
            >
              <PictureInPicture size={30} />
            </button>
          )}
        </div>

        {/* Main Grid (always stays here) */}
        <GridView grid={roomData.grid} selectedColor={selectedColor} onCellClick={handleCellClick} />
      </div>

      {/* PiP Portal — rendered into PiP window's DOM via React Portal */}
      <PiPContent
        pipWin={pipWindow}
        grid={roomData.grid}
        selectedColor={selectedColor}
        occupiedColors={occupiedColors}
        onCellClick={handleCellClick}
        onColorSelect={handleColorSelect}
        onClearColor={handleClearColor}
        onCopyUnfilled={handleCopyUnfilled}
      />
    </div>
  )
}

export default Room
