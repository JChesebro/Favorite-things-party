import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  eventInfo,
  giftRules,
  icebreakerPrompts,
  partyGameIdeas,
  sampleGuestPreview,
  triviaPrompts,
} from './data'
import {
  deleteSharedGalleryItem,
  findSharedInviteByEmail,
  isBackendConfigured,
  loadSharedGallery,
  loadSharedInvites,
  saveSharedGalleryItem,
  saveSharedInvite,
} from './lib/backend'

type GalleryItem = {
  id: string
  src: string
  caption: string
  createdAt: number
}

type InviteRecord = {
  id: string
  code: string
  name: string
  email: string
  plusOnes: number
  icebreakerAnswer: string
  triviaAnswerOne: string
  triviaAnswerTwo: string
  notes: string
  updatedAt: number
}

type InviteDraft = Omit<InviteRecord, 'id' | 'code' | 'updatedAt'>
type ViewMode = 'guest' | 'host' | 'split'
type PhotoStyle = 'polaroid' | 'strip'

const ownedGalleryIdsStorageKey = 'glacier-owned-gallery-ids'

const emptyDraft: InviteDraft = {
  name: '',
  email: '',
  plusOnes: 0,
  icebreakerAnswer: '',
  triviaAnswerOne: '',
  triviaAnswerTwo: '',
  notes: '',
}

function createCode() {
  return `GL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
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

      context.fillStyle = '#f7f1e7'
      context.fillRect(0, 0, canvas.width, canvas.height)

      context.save()
      context.shadowColor = 'rgba(20, 38, 72, 0.24)'
      context.shadowBlur = 22
      context.shadowOffsetY = 18
      context.fillStyle = '#fbf8f2'
      context.fillRect(86, 74, 1028, 1342)
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

      context.fillStyle = '#0f2348'
      context.font = '700 48px Georgia, serif'
      context.fillText('Glacier Soiree', 124, 1280)

      context.fillStyle = '#7e6238'
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

function buildPhotoStrip(source: string, caption: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1920
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Canvas unavailable'))
        return
      }

      context.fillStyle = '#f7efe4'
      context.fillRect(0, 0, canvas.width, canvas.height)

      context.fillStyle = '#fff7ee'
      context.fillRect(74, 48, 932, 1824)

      const frameX = 132
      const frameWidth = 816
      const frameHeight = 500
      const squareSize = Math.min(image.width, image.height)
      const sx = (image.width - squareSize) / 2
      const sy = (image.height - squareSize) / 2

      const filters = ['saturate(1.05)', 'contrast(1.04) sepia(0.08)', 'brightness(1.03) hue-rotate(-4deg)']
      filters.forEach((filter, index) => {
        const frameY = 128 + index * 560
        context.save()
        context.fillStyle = '#fdf8f1'
        context.fillRect(frameX - 18, frameY - 18, frameWidth + 36, frameHeight + 36)
        context.filter = filter
        context.drawImage(image, sx, sy, squareSize, squareSize, frameX, frameY, frameWidth, frameHeight)
        context.restore()
      })

      context.fillStyle = '#0f2348'
      context.font = '700 46px Georgia, serif'
      context.fillText('Glacier Soiree Booth', 138, 1822)

      context.fillStyle = '#7e6238'
      context.font = '30px Georgia, serif'
      const lines = caption.trim() ? wrapText(caption.trim(), 730, context) : ['Favorite things night']
      lines.slice(0, 1).forEach((line) => {
        context.fillText(line, 138, 1864)
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

function toInviteRecord(item: InviteRecord) {
  return item
}

export default function App() {
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [galleryCaption, setGalleryCaption] = useState('Favorite things and a few good moments')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [capturedSrc, setCapturedSrc] = useState('')
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>(emptyDraft)
  const [inviteMessage, setInviteMessage] = useState('')
  const [savedInvites, setSavedInvites] = useState<InviteRecord[]>([])
  const [galleryMessage, setGalleryMessage] = useState('')
  const [icebreakerIndex, setIcebreakerIndex] = useState(0)
  const [triviaIndex, setTriviaIndex] = useState(0)
  const [photoStyle, setPhotoStyle] = useState<PhotoStyle>('polaroid')
  const [ownedGalleryIds, setOwnedGalleryIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = window.localStorage.getItem(ownedGalleryIdsStorageKey)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  })
  const [responseFilter, setResponseFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'guest'
    const mode = new URLSearchParams(window.location.search).get('view')
    return mode === 'host' || mode === 'split' ? mode : 'guest'
  })
  const [hostCodeInput, setHostCodeInput] = useState('')
  const [hostUnlocked, setHostUnlocked] = useState(false)
  const [hostViewMessage, setHostViewMessage] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sharedBackendEnabled = isBackendConfigured()
  const hostViewCode = ((import.meta.env.VITE_HOST_VIEW_CODE as string | undefined) || 'glacier-host').trim()

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ownedGalleryIdsStorageKey, JSON.stringify(ownedGalleryIds))
  }, [ownedGalleryIds])

  useEffect(() => {
    let cancelled = false

    async function loadSharedData() {
      try {
        const [invites, galleryItems] = await Promise.all([loadSharedInvites(), loadSharedGallery()])
        if (cancelled) return
        setSavedInvites(invites.map(toInviteRecord))
        setGallery(galleryItems)
      } catch (error) {
        if (cancelled) return
        setSavedInvites(sampleGuestPreview)
        setGallery([])
      }
    }

    loadSharedData()

    const interval = window.setInterval(() => {
      if (sharedBackendEnabled) {
        loadSharedData()
      }
    }, 30000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [sharedBackendEnabled])

  async function syncSharedData() {
    try {
      const [invites, galleryItems] = await Promise.all([loadSharedInvites(), loadSharedGallery()])
      setSavedInvites(invites.map(toInviteRecord))
      setGallery(galleryItems)
    } catch {
      // Keep existing state if refresh fails.
    }
  }

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
    const nextImage = photoStyle === 'strip' ? await buildPhotoStrip(src, galleryCaption) : await buildPolaroid(src, galleryCaption)
    setCapturedSrc(nextImage)
  }

  async function addToGallery(src: string) {
    const savedItem = await saveSharedGalleryItem({ src, caption: galleryCaption })
    setGallery((current) => [savedItem, ...current.filter((item) => item.id !== savedItem.id)])
    setOwnedGalleryIds((current) => Array.from(new Set([savedItem.id, ...current])))
    setGalleryMessage(sharedBackendEnabled ? 'Photo added to the shared gallery.' : 'Photo added locally. Connect Supabase to share it across devices.')
    if (sharedBackendEnabled) {
      await syncSharedData()
    }
  }

  async function removeOwnedPhoto(photoId: string) {
    if (!ownedGalleryIds.includes(photoId)) {
      setGalleryMessage('You can only remove photos you added from this browser.')
      return
    }

    try {
      await deleteSharedGalleryItem(photoId)
      setGallery((current) => current.filter((item) => item.id !== photoId))
      setOwnedGalleryIds((current) => current.filter((id) => id !== photoId))
      setGalleryMessage('Removed your photo from the gallery.')
      if (sharedBackendEnabled) {
        await syncSharedData()
      }
    } catch (error) {
      setGalleryMessage(error instanceof Error ? `Could not remove photo: ${error.message}` : 'Could not remove photo right now.')
    }
  }

  async function savePolaroid() {
    if (!capturedSrc) return
    const link = document.createElement('a')
    link.href = capturedSrc
    link.download = photoStyle === 'strip' ? 'glacier-soiree-photostrip.png' : 'glacier-soiree-polaroid.png'
    link.click()
  }

  function handleDraftChange(field: keyof InviteDraft, value: string | number) {
    setInviteDraft((current) => ({ ...current, [field]: value }))
  }

  function setModeAndUrl(mode: ViewMode) {
    setViewMode(mode)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (mode === 'guest') {
      url.searchParams.delete('view')
    } else {
      url.searchParams.set('view', mode)
    }
    window.history.replaceState({}, '', url.toString())
  }

  function unlockHostView() {
    const attempt = hostCodeInput.trim()
    if (!attempt) {
      setHostViewMessage('Enter your host code to unlock host view.')
      return
    }

    if (attempt === hostViewCode) {
      setHostUnlocked(true)
      setHostCodeInput('')
      setHostViewMessage('Host view unlocked on this device.')
      if (viewMode === 'guest') setModeAndUrl('host')
      return
    }

    setHostViewMessage('That code did not match. Try again.')
  }

  function relockHostView() {
    setHostUnlocked(false)
    setHostViewMessage('Host view locked. Guests now only see anonymous responses.')
    setModeAndUrl('guest')
  }

  async function loadInviteByEmail(email: string) {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      setInviteMessage('Enter your email to load your response.')
      return
    }

    const match = await findSharedInviteByEmail(normalized)
    if (!match) {
      setInviteMessage('No existing response found for that email yet.')
      return
    }

    setInviteDraft({
      name: match.name,
      email: match.email,
      plusOnes: match.plusOnes,
      icebreakerAnswer: match.icebreakerAnswer,
      triviaAnswerOne: match.triviaAnswerOne,
      triviaAnswerTwo: match.triviaAnswerTwo,
      notes: match.notes,
    })
    setInviteMessage(`Loaded your response. Make changes and save again.`)
  }

  function resetDraft() {
    setInviteDraft(emptyDraft)
    setInviteMessage('Ready for a new response.')
  }

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const existing = savedInvites.find((item) => item.email.toLowerCase() === inviteDraft.email.trim().toLowerCase())

    const nextCode = existing?.code || createCode()

    const nextInvite = await saveSharedInvite({
      id: existing?.id,
      code: nextCode,
      name: inviteDraft.name.trim(),
      email: inviteDraft.email.trim(),
      plusOnes: Number(inviteDraft.plusOnes) || 0,
      bringingDish: '',
      icebreakerAnswer: inviteDraft.icebreakerAnswer.trim(),
      triviaAnswerOne: inviteDraft.triviaAnswerOne.trim(),
      triviaAnswerTwo: inviteDraft.triviaAnswerTwo.trim(),
      notes: inviteDraft.notes.trim(),
    })

    setSavedInvites((current) => {
      const filtered = current.filter((item) => item.id !== nextInvite.id)
      return [nextInvite, ...filtered].sort((left, right) => right.updatedAt - left.updatedAt)
    })
    setInviteMessage(
      sharedBackendEnabled
        ? 'Saved your response. You can return and edit anytime using your email.'
        : 'Saved locally for preview. You can return and edit anytime using your email.',
    )
    if (sharedBackendEnabled) {
      await syncSharedData()
    }
  }

  const visibleInvites = savedInvites.length ? savedInvites : sampleGuestPreview
  const anonymizedInvites = useMemo(
    () =>
      visibleInvites.map((invite, index) => ({
        ...invite,
        alias: `Guest ${String(index + 1).padStart(2, '0')}`,
      })),
    [visibleInvites],
  )
  const invitedGuestCount = useMemo(
    () => visibleInvites.reduce((total, invite) => total + 1 + Number(invite.plusOnes || 0), 0),
    [visibleInvites],
  )
  const galleryPreview = useMemo(() => gallery.slice(0, 12), [gallery])
  const filteredResponses = responseFilter
    ? anonymizedInvites.filter((invite) => {
        const query = responseFilter.toLowerCase()
        return (
          invite.alias.toLowerCase().includes(query) ||
          invite.icebreakerAnswer.toLowerCase().includes(query) ||
          invite.triviaAnswerOne.toLowerCase().includes(query) ||
          invite.triviaAnswerTwo.toLowerCase().includes(query)
        )
      })
    : anonymizedInvites
  const hostFilteredResponses = responseFilter
    ? visibleInvites.filter((invite) => {
        const query = responseFilter.toLowerCase()
        return (
          invite.name.toLowerCase().includes(query) ||
          invite.email.toLowerCase().includes(query) ||
          invite.icebreakerAnswer.toLowerCase().includes(query) ||
          invite.triviaAnswerOne.toLowerCase().includes(query) ||
          invite.triviaAnswerTwo.toLowerCase().includes(query)
        )
      })
    : visibleInvites
  const showHostBoard = hostUnlocked && (viewMode === 'host' || viewMode === 'split')
  const showGuestBoard = !hostUnlocked || viewMode === 'guest' || viewMode === 'split'

  return (
    <main className="page-shell">
      <section className="hero card hero-glow">
        <div className="hero-copy">
          <div className="champagne-row" aria-hidden="true">
            <img src="/champagne-cheers.svg" alt="" />
            <img src="/champagne-cheers.svg" alt="" />
          </div>
          <div className="eyebrow">{eventInfo.theme}</div>
          <h1>{eventInfo.title}</h1>
          <p className="theme-script">Favorite Things - Year 12</p>
          <p className="lede">Slip into your winter best and join us for a candlelit, ice-kissed night of laughter and favorite things.</p>
          <p className="intro-text">
            Think sparkling conversation, glowing tables, and playful trivia rounds all evening long.
          </p>
        </div>
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

      <section className="card view-control-card">
        <div className="section-header">
          <h2>View controls</h2>
          <span className="muted">Host mode lets you preview private details and split-screen compare.</span>
        </div>
        {!hostUnlocked ? (
          <div className="unlock-row">
            <label>
              Host code
              <input
                type="password"
                value={hostCodeInput}
                onChange={(event) => setHostCodeInput(event.target.value)}
                placeholder="Enter host code"
              />
            </label>
            <button type="button" onClick={unlockHostView}>Unlock host view</button>
          </div>
        ) : (
          <div className="mode-pills">
            <button type="button" onClick={() => setModeAndUrl('guest')} className={viewMode === 'guest' ? 'pill-active' : ''}>Guest view</button>
            <button type="button" onClick={() => setModeAndUrl('host')} className={viewMode === 'host' ? 'pill-active' : ''}>Host view</button>
            <button type="button" onClick={() => setModeAndUrl('split')} className={viewMode === 'split' ? 'pill-active' : ''}>Split view</button>
            <button type="button" onClick={relockHostView} className="secondary-button">Lock</button>
          </div>
        )}
        {hostViewMessage ? <p className="status">{hostViewMessage}</p> : null}
      </section>

      <section className="grid two-up">
        <article className="card accent-panel card-icicle icicle-variant-1">
          <div className="section-header">
            <h2>Soiree details</h2>
          </div>
          <ul className="rule-list">
            <li>Dress code: all white.</li>
            {giftRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="stat-row">
            <div>
              <span className="meta-label">Estimated guests</span>
              <strong>{invitedGuestCount}</strong>
            </div>
          </div>
        </article>

        <article className="card card-icicle icicle-variant-2">
          <div className="section-header">
            <h2>Invite editor</h2>
            <span className="muted">Return anytime and load your response with your email.</span>
          </div>
          <form className="stack form-grid" onSubmit={handleInviteSubmit}>
            <div className="split-grid">
              <label>
                Name
                <input
                  value={inviteDraft.name}
                  onChange={(event) => handleDraftChange('name', event.target.value)}
                  type="text"
                  placeholder="Your name"
                  required
                />
              </label>
            </div>
            <div className="split-grid">
              <label>
                Email
                <div className="inline-actions">
                  <input
                    value={inviteDraft.email}
                    onChange={(event) => handleDraftChange('email', event.target.value)}
                    type="email"
                    placeholder="you@example.com"
                  />
                  <button type="button" onClick={() => loadInviteByEmail(inviteDraft.email)}>
                    Load mine
                  </button>
                </div>
              </label>
              <label>
                Number coming
                <input
                  value={inviteDraft.plusOnes}
                  onChange={(event) => handleDraftChange('plusOnes', Number(event.target.value))}
                  type="number"
                  min={0}
                  max={12}
                />
              </label>
            </div>
            <div className="split-grid">
              <label>
                Icebreaker answer
                <textarea
                  value={inviteDraft.icebreakerAnswer}
                  onChange={(event) => handleDraftChange('icebreakerAnswer', event.target.value)}
                  rows={3}
                  placeholder="Your quick answer to the current icebreaker"
                />
              </label>
              <label>
                Trivia answer 1
                <textarea
                  value={inviteDraft.triviaAnswerOne}
                  onChange={(event) => handleDraftChange('triviaAnswerOne', event.target.value)}
                  rows={3}
                  placeholder="Answer to the first trivia prompt"
                />
              </label>
            </div>
            <div className="split-grid">
              <label>
                Trivia answer 2
                <textarea
                  value={inviteDraft.triviaAnswerTwo}
                  onChange={(event) => handleDraftChange('triviaAnswerTwo', event.target.value)}
                  rows={3}
                  placeholder="Answer to the second trivia prompt"
                />
              </label>
              <label>
                Notes
                <textarea
                  value={inviteDraft.notes}
                  onChange={(event) => handleDraftChange('notes', event.target.value)}
                  rows={3}
                  placeholder="Dietary notes, timing, or anything else we should know"
                />
              </label>
            </div>
            <div className="camera-actions invite-actions">
              <button type="submit">Save invite</button>
              <button type="button" onClick={resetDraft} className="secondary-button">
                New invite
              </button>
            </div>
          </form>
          {inviteMessage ? <p className="status invite-status">{inviteMessage}</p> : null}
        </article>
      </section>

      <section className="grid two-up">
        <article className="card card-icicle icicle-variant-3">
          <div className="section-header">
            <h2>{showGuestBoard && showHostBoard ? 'Response boards' : showHostBoard ? 'Host response board' : 'Anonymous response board'}</h2>
            <label className="mini-filter">
              Filter responses
              <input value={responseFilter} onChange={(event) => setResponseFilter(event.target.value)} placeholder="Search answers" />
            </label>
          </div>
          <p className="muted">
            {showHostBoard
              ? 'Host board reveals names and codes only after unlock. Guest board remains anonymized.'
              : 'Guest board displays anonymized responses only.'}
          </p>
          <div className={`response-columns ${showGuestBoard && showHostBoard ? 'split' : ''}`}>
            {showGuestBoard ? (
              <section className="board-panel">
                <h3>Guest-safe board</h3>
                <div className="guest-board">
                  {filteredResponses.map((invite) => (
                    <article className="guest-card" key={`guest-${invite.id}`}>
                      <div className="guest-card-top">
                        <div>
                          <strong>{invite.alias}</strong>
                          <p>{1 + Number(invite.plusOnes || 0)} coming</p>
                        </div>
                        <span className="code-pill">Anonymous</span>
                      </div>
                      <div className="guest-grid">
                        <div>
                          <span className="meta-label">Icebreaker</span>
                          <p>{invite.icebreakerAnswer || 'Not answered yet'}</p>
                        </div>
                        <div>
                          <span className="meta-label">Trivia answers</span>
                          <p>{invite.triviaAnswerOne || 'Not answered yet'}</p>
                          <p>{invite.triviaAnswerTwo || ''}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {showHostBoard ? (
              <section className="board-panel board-panel-host">
                <h3>Host board</h3>
                <div className="guest-board">
                  {hostFilteredResponses.map((invite) => (
                    <article className="guest-card" key={`host-${invite.id}`}>
                      <div className="guest-card-top">
                        <div>
                          <strong>{invite.name}</strong>
                          <p>{invite.email || 'No email added'}</p>
                        </div>
                        <span className="code-pill">Host view</span>
                      </div>
                      <div className="guest-grid">
                        <div>
                          <span className="meta-label">Icebreaker</span>
                          <p>{invite.icebreakerAnswer || 'Not answered yet'}</p>
                        </div>
                        <div>
                          <span className="meta-label">Trivia answers</span>
                          <p>{invite.triviaAnswerOne || 'Not answered yet'}</p>
                          <p>{invite.triviaAnswerTwo || ''}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </article>

        <article className="card card-icicle icicle-variant-4">
          <div className="section-header">
            <h2>Trivia lounge</h2>
            <span className="muted">Thought-provoking prompts for table conversation and mini rounds.</span>
          </div>
          <div className="game-card">
            <span className="eyebrow">Current prompt</span>
            <h3>{triviaPrompts[triviaIndex % triviaPrompts.length]}</h3>
            <p className="game-question">Pick a table winner, then post top responses to the anonymous board.</p>
            <div className="camera-actions invite-actions">
              <button type="button" onClick={() => setTriviaIndex((current) => current + 1)}>
                Next trivia prompt
              </button>
            </div>
          </div>
          <div className="prompt-stack">
            <div>
              <span className="meta-label">Icebreaker prompt</span>
              <p className="prompt">{icebreakerPrompts[icebreakerIndex % icebreakerPrompts.length]}</p>
            </div>
            <div className="section-header compact-header">
              <button type="button" onClick={() => setIcebreakerIndex((current) => current + 1)}>
                New icebreaker
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="grid two-up">
        <article className="card">
          <div className="section-header">
            <h2>Party game ideas</h2>
            <span className="muted">We can turn one of these into a live game next.</span>
          </div>
          <div className="idea-grid">
            {partyGameIdeas.map((idea) => (
              <article className="idea-card" key={idea.title}>
                <strong>{idea.title}</strong>
                <p>{idea.description}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="card photo-card card-icicle icicle-variant-5">
          <div className="section-header">
            <h2>Photo booth</h2>
            <span className="muted">Capture now, connect shared storage later.</span>
          </div>
          <label>
            Photo style
            <select value={photoStyle} onChange={(event) => setPhotoStyle(event.target.value as PhotoStyle)}>
              <option value="polaroid">Polaroid</option>
              <option value="strip">Photo strip</option>
            </select>
          </label>
          <label>
            Caption
            <input value={galleryCaption} onChange={(event) => setGalleryCaption(event.target.value)} />
          </label>
          <div className="camera-actions">
            <button type="button" onClick={startCamera}>Open camera</button>
            <button type="button" onClick={stopCamera}>Stop camera</button>
            <button type="button" onClick={capturePhoto} disabled={!cameraReady}>Take photo</button>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="secondary-button upload-button">
            Upload instead
          </button>
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
                const nextImage = photoStyle === 'strip' ? await buildPhotoStrip(src, galleryCaption) : await buildPolaroid(src, galleryCaption)
                setCapturedSrc(nextImage)
              }
              reader.readAsDataURL(file)
              event.currentTarget.value = ''
            }}
          />
          {cameraError ? <p className="status">{cameraError}</p> : null}
          <video ref={videoRef} autoPlay playsInline muted className={`camera ${cameraReady ? 'live' : ''}`} />
          {capturedSrc ? (
            <div className="photo-preview">
              <img src={capturedSrc} alt="Photo booth preview" className={photoStyle === 'strip' ? 'strip-shot' : 'polaroid-shot'} />
              <div className="camera-actions">
                <button type="button" onClick={savePolaroid}>Save photo</button>
                <button type="button" onClick={() => addToGallery(capturedSrc)}>Add to gallery</button>
              </div>
            </div>
          ) : null}
          {galleryMessage ? <p className="status">{galleryMessage}</p> : null}
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Shared gallery</h2>
          <button type="button" onClick={syncSharedData} className="secondary-button">
            Refresh shared data
          </button>
        </div>
        <div className="gallery">
          {galleryPreview.length ? (
            galleryPreview.map((item) => (
              <article className="gallery-item" key={item.id}>
                <img src={item.src} alt={item.caption || 'Party photo'} />
                <p className="gallery-caption">{item.caption || 'Glacier booth moment'}</p>
                {ownedGalleryIds.includes(item.id) ? (
                  <button type="button" className="secondary-button" onClick={() => removeOwnedPhoto(item.id)}>
                    Remove my photo
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <p className="muted">No photos yet. Add the first Polaroid to start the wall.</p>
          )}
        </div>
      </section>
    </main>
  )
}
