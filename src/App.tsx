import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  eventInfo,
  giftRules,
  icebreakers,
  triviaQuestions,
  wouldYouRather,
} from './data'

type GalleryItem = {
  id: string
  src: string
  caption: string
  createdAt: number
}

const galleryStorageKey = 'favorite-things-gallery'
const rsvpStorageKey = 'favorite-things-rsvp'

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

function buildPolaroid(source: string, caption: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 1500
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Canvas unavailable'))
        return
      }

      context.fillStyle = '#f4efe7'
      context.fillRect(0, 0, canvas.width, canvas.height)

      context.save()
      context.shadowColor = 'rgba(28, 22, 18, 0.18)'
      context.shadowBlur = 18
      context.shadowOffsetY = 16
      context.fillStyle = '#fbf7f0'
      context.fillRect(80, 70, 1040, 1340)
      context.restore()

      const frameX = 120
      const frameY = 120
      const frameWidth = 960
      const frameHeight = 1080
      const squareSize = Math.min(frameWidth, frameHeight)
      const sx = (image.width - squareSize) / 2
      const sy = (image.height - squareSize) / 2

      context.save()
      context.beginPath()
      context.rect(frameX, frameY, frameWidth, frameHeight)
      context.clip()
      context.drawImage(image, sx, sy, squareSize, squareSize, frameX, frameY, frameWidth, frameHeight)
      context.restore()

      context.fillStyle = '#201914'
      context.font = '700 48px Georgia, serif'
      context.fillText('Favorite Things', 124, 1280)

      context.fillStyle = '#5f5145'
      context.font = '32px Georgia, serif'
      const lines = caption.trim() ? wrapText(caption.trim(), 560, context) : ['Add a caption']
      lines.slice(0, 2).forEach((line, index) => {
        context.fillText(line, 124, 1340 + index * 42)
      })

      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = reject
    image.crossOrigin = 'anonymous'
    image.src = source
  })
}

function wrapText(text: string, maxWidth: number, context: CanvasRenderingContext2D) {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word
    if (context.measureText(next).width <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  })

  if (current) lines.push(current)
  return lines
}

export default function App() {
  const [currentIcebreaker, setCurrentIcebreaker] = useState(icebreakers[0])
  const [triviaAnswer, setTriviaAnswer] = useState('')
  const [triviaResult, setTriviaResult] = useState('')
  const [wouldYouRatherPrompt, setWouldYouRatherPrompt] = useState(wouldYouRather[0])
  const [giftWinner, setGiftWinner] = useState('')
  const [guestList, setGuestList] = useState('')
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [galleryLoaded, setGalleryLoaded] = useState(false)
  const [caption, setCaption] = useState('Favorite things and a few good moments')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [capturedSrc, setCapturedSrc] = useState('')
  const [rsvpStatus, setRsvpStatus] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const storedGallery = window.localStorage.getItem(galleryStorageKey)
    if (storedGallery) {
      try {
        setGallery(JSON.parse(storedGallery) as GalleryItem[])
      } catch {
        window.localStorage.removeItem(galleryStorageKey)
      }
    }
    setGalleryLoaded(true)

    const storedRsvp = window.localStorage.getItem(rsvpStorageKey)
    if (storedRsvp) setRsvpStatus(storedRsvp)
  }, [])

  useEffect(() => {
    if (!galleryLoaded) return
    window.localStorage.setItem(galleryStorageKey, JSON.stringify(gallery))
  }, [gallery, galleryLoaded])

  useEffect(() => {
    if (rsvpStatus) window.localStorage.setItem(rsvpStorageKey, rsvpStatus)
  }, [rsvpStatus])

  async function startCamera() {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraReady(true)
    } catch {
      setCameraError('Camera access is unavailable here. Use upload instead.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraReady(false)
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')

    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const src = canvas.toDataURL('image/png')
    const polaroid = await buildPolaroid(src, caption)
    setCapturedSrc(polaroid)
  }

  async function addToGallery(src: string) {
    setGallery((current) => [
      {
        id: crypto.randomUUID(),
        src,
        caption,
        createdAt: Date.now(),
      },
      ...current,
    ])
  }

  async function savePolaroid() {
    if (!capturedSrc) return
    const link = document.createElement('a')
    link.href = capturedSrc
    link.download = 'favorite-things-polaroid.png'
    link.click()
  }

  function randomizeIcebreaker() {
    setCurrentIcebreaker(shuffle(icebreakers)[0] ?? currentIcebreaker)
  }

  function randomizeWouldYouRather() {
    setWouldYouRatherPrompt(shuffle(wouldYouRather)[0] ?? wouldYouRatherPrompt)
  }

  function drawGiftOrder() {
    const names = guestList
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean)
    if (!names.length) {
      setGiftWinner('Add names first to draw an order.')
      return
    }
    setGiftWinner(shuffle(names).join(' • '))
  }

  function checkTrivia() {
    const normalized = triviaAnswer.trim().toLowerCase()
    const correctCount = triviaQuestions.filter((item) => item.answer.toLowerCase() === normalized).length
    setTriviaResult(correctCount ? 'Nice match for one of the host answers.' : 'Close, but not one of the host answers yet.')
  }

  function handleRsvpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const attending = String(form.get('attending') ?? 'yes')

    setRsvpStatus(`${name || 'Guest'} RSVP saved locally as ${attending}. Connect Netlify Forms for live submissions.`)
    event.currentTarget.reset()
  }

  const galleryPreview = useMemo(() => gallery.slice(0, 6), [gallery])

  return (
    <main className="page-shell">
      <section className="hero card">
        <div className="eyebrow">{eventInfo.theme}</div>
        <h1>{eventInfo.title}</h1>
        <p className="lede">{eventInfo.note}</p>
        <div className="hero-grid">
          <div>
            <span className="meta-label">Hosts</span>
            <strong>{eventInfo.hosts}</strong>
          </div>
          <div>
            <span className="meta-label">When</span>
            <strong>{eventInfo.date}</strong>
            <span>{eventInfo.time}</span>
          </div>
          <div>
            <span className="meta-label">Where</span>
            <strong>{eventInfo.location}</strong>
          </div>
        </div>
      </section>

      <section className="grid two-up">
        <article className="card">
          <h2>Gift exchange rules</h2>
          <ul>
            {giftRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>RSVP</h2>
          <form
            name="rsvp"
            method="post"
            data-netlify="true"
            netlify-honeypot="bot-field"
            onSubmit={handleRsvpSubmit}
            className="stack"
          >
            <input type="hidden" name="form-name" value="rsvp" />
            <p className="hidden-field">
              <label>
                Don’t fill this out: <input name="bot-field" />
              </label>
            </p>
            <label>
              Name
              <input name="name" type="text" placeholder="Your name" required />
            </label>
            <label>
              Will you attend?
              <select name="attending" defaultValue="yes">
                <option value="yes">Yes</option>
                <option value="maybe">Maybe</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>
              Notes
              <textarea name="notes" placeholder="Dietary notes or anything else we should know" rows={4} />
            </label>
            <button type="submit">Send RSVP</button>
          </form>
          {rsvpStatus ? <p className="status">{rsvpStatus}</p> : null}
        </article>
      </section>

      <section className="grid three-up">
        <article className="card">
          <div className="section-header">
            <h2>Icebreakers</h2>
            <button type="button" onClick={randomizeIcebreaker}>New prompt</button>
          </div>
          <p className="prompt">{currentIcebreaker}</p>
        </article>

        <article className="card">
          <div className="section-header">
            <h2>Would you rather</h2>
            <button type="button" onClick={randomizeWouldYouRather}>Shuffle</button>
          </div>
          <p className="prompt">{wouldYouRatherPrompt}</p>
        </article>

        <article className="card">
          <div className="section-header">
            <h2>Trivia</h2>
            <button type="button" onClick={checkTrivia}>Check</button>
          </div>
          <input value={triviaAnswer} onChange={(event) => setTriviaAnswer(event.target.value)} placeholder="Try an answer" />
          <p className="status">{triviaResult || 'Host note: use this as a quick party quiz.'}</p>
        </article>
      </section>

      <section className="grid two-up">
        <article className="card">
          <h2>Gift picker</h2>
          <textarea
            value={guestList}
            onChange={(event) => setGuestList(event.target.value)}
            placeholder="Paste guest names, one per line"
            rows={8}
          />
          <div className="section-header">
            <button type="button" onClick={drawGiftOrder}>Draw order</button>
            <span className="muted">Randomized for a game-night style reveal.</span>
          </div>
          {giftWinner ? <p className="prompt">{giftWinner}</p> : null}
        </article>

        <article className="card photo-card">
          <div className="section-header">
            <h2>Polaroid booth</h2>
            <span className="muted">Capture now, connect storage later.</span>
          </div>
          <label>
            Caption
            <input value={caption} onChange={(event) => setCaption(event.target.value)} />
          </label>
          <div className="camera-actions">
            <button type="button" onClick={startCamera}>Open camera</button>
            <button type="button" onClick={stopCamera}>Stop camera</button>
            <button type="button" onClick={capturePhoto} disabled={!cameraReady}>Take photo</button>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()}>Upload instead</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = async () => {
                const src = String(reader.result)
                setCapturedSrc(await buildPolaroid(src, caption))
              }
              reader.readAsDataURL(file)
              event.currentTarget.value = ''
            }}
          />
          {cameraError ? <p className="status">{cameraError}</p> : null}
          <video ref={videoRef} autoPlay playsInline muted className={`camera ${cameraReady ? 'live' : ''}`} />
          {capturedSrc ? (
            <div className="photo-preview">
              <img src={capturedSrc} alt="Polaroid preview" />
              <div className="camera-actions">
                <button type="button" onClick={savePolaroid}>Save photo</button>
                <button type="button" onClick={() => addToGallery(capturedSrc)}>Add to gallery</button>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Shared gallery</h2>
          <span className="muted">Local preview now; backend hook next.</span>
        </div>
        <div className="gallery">
          {galleryPreview.length ? galleryPreview.map((item) => <img key={item.id} src={item.src} alt={item.caption} />) : <p className="muted">No photos yet. Add the first Polaroid to start the wall.</p>}
        </div>
      </section>
    </main>
  )
}
