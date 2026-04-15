import { useState, useEffect, useRef } from 'react'
import { SERVER, isVideo } from './constants.js'

export default function Lightbox({ items, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const touchX = useRef(null)
  const item = items[idx]

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i+1, items.length-1))
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i-1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, onClose])

  return (
    <div className="lightbox"
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current === null) return
        const d = touchX.current - e.changedTouches[0].clientX
        if (Math.abs(d) > 50) setIdx(i => d > 0 ? Math.min(i+1,items.length-1) : Math.max(i-1,0))
        touchX.current = null
      }}>
      <div className="lightbox-bar">
        <button className="lightbox-back" onClick={onClose}>← Back</button>
        <span className="lightbox-title">{item.title}</span>
      </div>
      <div className="lightbox-content">
        {isVideo(item.url)
          ? <video className="lightbox-media" src={SERVER+item.url} controls autoPlay playsInline />
          : <img className="lightbox-media" src={SERVER+item.url} alt={item.title} />}
      </div>
      {items.length > 1 && (
        <div className="lightbox-nav">
          <button className="lb-nav-btn" onClick={() => setIdx(i => Math.max(i-1,0))} disabled={idx===0}>←</button>
          <span className="lb-counter">{idx+1} / {items.length}</span>
          <button className="lb-nav-btn" onClick={() => setIdx(i => Math.min(i+1,items.length-1))} disabled={idx===items.length-1}>→</button>
        </div>
      )}
    </div>
  )
}
