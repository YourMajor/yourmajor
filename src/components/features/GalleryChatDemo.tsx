'use client'

import { useState, useEffect, useRef } from 'react'
import { Camera, MessageCircle } from 'lucide-react'

const MESSAGES = [
  { name: 'Tyler', initial: 'T', text: 'Nice birdie on 7!', align: 'left' as const },
  { name: 'Marcus', initial: 'M', text: 'Wait till you see hole 12', align: 'right' as const },
  { name: 'Jordan', initial: 'J', text: 'Who used the sand trap card on me?!', align: 'left' as const },
  { name: 'Alex', initial: 'A', text: 'That eagle was INSANE', align: 'right' as const },
]

// Placeholder "photos" as gradient thumbnails
const PHOTOS = [
  { gradient: 'from-emerald-300 to-emerald-500', caption: 'Hole 3 tee box' },
  { gradient: 'from-sky-300 to-sky-500', caption: 'Approach on 7' },
  { gradient: 'from-amber-300 to-amber-500', caption: 'The winning putt' },
  { gradient: 'from-rose-300 to-rose-500', caption: 'Trophy ceremony' },
  { gradient: 'from-violet-300 to-violet-500', caption: 'Group photo' },
  { gradient: 'from-teal-300 to-teal-500', caption: '18th green' },
]

export function GalleryChatDemo() {
  const [msgCount, setMsgCount] = useState(0)
  const [photoCount, setPhotoCount] = useState(0)
  const tick = useRef(0)

  useEffect(() => {
    const timer = setInterval(() => {
      tick.current++
      const total = MESSAGES.length + PHOTOS.length
      if (tick.current > total + 3) {
        tick.current = 0
        setMsgCount(0)
        setPhotoCount(0)
        return
      }
      if (tick.current % 2 === 1) {
        setMsgCount((c) => Math.min(c + 1, MESSAGES.length))
      } else {
        setPhotoCount((c) => Math.min(c + 1, PHOTOS.length))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="grid grid-cols-2 gap-3 lg:gap-4 max-w-sm lg:max-w-md mx-auto md:mx-0">
      {/* Gallery — matches PhotoGallery grid pattern */}
      <div className="rounded-xl border border-border overflow-hidden shadow-lg">
        <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-muted-foreground" />
          <span className="text-xs lg:text-sm font-semibold">Gallery</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-2 bg-card min-h-[160px]">
          {PHOTOS.slice(0, photoCount).map((photo, i) => (
            <div
              key={i}
              className="rounded-md overflow-hidden border border-border bg-muted/30"
            >
              <div className={`aspect-square bg-gradient-to-br ${photo.gradient}`} />
              <div className="px-1.5 py-1">
                <p className="text-[8px] lg:text-[10px] font-medium truncate">{photo.caption}</p>
                <p className="text-[7px] lg:text-[9px] text-muted-foreground">Player</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat — matches ChatMessageList pattern */}
      <div className="rounded-xl border border-border overflow-hidden shadow-lg flex flex-col">
        <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-muted-foreground" />
          <span className="text-xs lg:text-sm font-semibold">Chat</span>
        </div>
        <div className="p-2.5 bg-card flex-1 flex flex-col justify-end space-y-2 min-h-[160px]">
          {MESSAGES.slice(0, msgCount).map((msg, i) => (
            <div key={i} className="flex items-start gap-2">
              {/* Avatar */}
              <div
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {msg.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] lg:text-xs font-semibold">{msg.name}</span>
                  <span className="text-[8px] lg:text-[10px] text-muted-foreground">now</span>
                </div>
                <p className="text-[10px] lg:text-xs mt-0.5 break-words">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Input bar */}
        <div className="border-t border-border px-2 py-1.5 flex gap-1.5 bg-card">
          <div className="flex-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-[9px] text-muted-foreground">
            Say something...
          </div>
          <div
            className="rounded-md px-2 py-1 text-[9px] font-semibold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Send
          </div>
        </div>
      </div>
    </div>
  )
}
