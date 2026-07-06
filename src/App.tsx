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
  findSharedInviteByCode,
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
  bringingDish: string
  favoriteThing: string
  icebreakerAnswer: string
  triviaAnswerOne: string
  triviaAnswerTwo: string
  notes: string
  updatedAt: number
}

type InviteDraft = Omit<InviteRecord, 'id' | 'code' | 'updatedAt'>

const emptyDraft: InviteDraft = {
  name: '',
  email: '',
  plusOnes: 0,
  bringingDish: '',
  favoriteThing: '',
  icebreakerAnswer: '',
  triviaAnswerOne: '',
  triviaAnswerTwo: '',
  notes: '',
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
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
  const [inviteCode, setInviteCode] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [savedInvites, setSavedInvites] = useState<InviteRecord[]>([])
  const [galleryMessage, setGalleryMessage] = useState('')
  const [favoriteThingIndex, setFavoriteThingIndex] = useState(0)
  const [revealedFavoriteThing, setRevealedFavoriteThing] = useState(false)
  const [icebreakerIndex, setIcebreakerIndex] = useState(0)
  const [triviaIndex, setTriviaIndex] = useState(0)
  const [responseFilter, setResponseFilter] = useState('')
  const [sharedStatus, setSharedStatus] = useState(
    isBackendConfigured() ? 'Shared backend connected.' : 'Backend not configured yet. Using local preview data.',
  )
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sharedBackendEnabled = isBackendConfigured()

  useEffect(() => {
    let cancelled = false

    async function loadSharedData() {
      try {
        const [invites, galleryItems] = await Promise.all([loadSharedInvites(), loadSharedGallery()])
        if (cancelled) return
        setSavedInvites(invites.map(toInviteRecord))
        setGallery(galleryItems)
        setSharedStatus(sharedBackendEnabled ? 'Shared backend synced.' : 'Backend not configured yet. Using local preview data.')
      } catch (error) {
        if (cancelled) return
        setSavedInvites(sampleGuestPreview)
        setGallery([])
        setSharedStatus(
          error instanceof Error
            ? `Shared backend unavailable: ${error.message}`
            : 'Shared backend unavailable. Showing local preview data.',
        )
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
      setSharedStatus(sharedBackendEnabled ? 'Shared backend synced.' : 'Backend not configured yet. Using local preview data.')
    } catch (error) {
      setSharedStatus(error instanceof Error ? `Could not refresh shared data: ${error.message}` : 'Could not refresh shared data.')
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
    const polaroid = await buildPolaroid(src, galleryCaption)
    setCapturedSrc(polaroid)
  }

  async function addToGallery(src: string) {
    const savedItem = await saveSharedGalleryItem({ src, caption: galleryCaption })
    setGallery((current) => [savedItem, ...current.filter((item) => item.id !== savedItem.id)])
    setGalleryMessage(sharedBackendEnabled ? 'Photo added to the shared gallery.' : 'Photo added locally. Connect Supabase to share it across devices.')
    if (sharedBackendEnabled) {
      await syncSharedData()
    }
  }

  async function savePolaroid() {
    if (!capturedSrc) return
    const link = document.createElement('a')
    link.href = capturedSrc
    link.download = 'glacier-soiree-polaroid.png'
    link.click()
  }

  function handleDraftChange(field: keyof InviteDraft, value: string | number) {
    setInviteDraft((current) => ({ ...current, [field]: value }))
  }

  async function loadInviteByCode(code: string) {
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      setInviteMessage('Enter a code to load an invite.')
      return
    }

    const match = await findSharedInviteByCode(normalized)
    if (!match) {
      setInviteMessage('No invite found for that code yet.')
      return
    }

    setInviteDraft({
      name: match.name,
      email: match.email,
      plusOnes: match.plusOnes,
      bringingDish: match.bringingDish,
      favoriteThing: match.favoriteThing,
      icebreakerAnswer: match.icebreakerAnswer,
      triviaAnswerOne: match.triviaAnswerOne,
      triviaAnswerTwo: match.triviaAnswerTwo,
      notes: match.notes,
    })
    setInviteCode(match.code)
    setInviteMessage(`Loaded ${match.name}'s invite. Make changes and save again.`)
  }

  function resetDraft() {
    setInviteDraft(emptyDraft)
    setInviteCode('')
    setInviteMessage('Ready for a new invite.')
  }

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const existing = inviteCode
      ? savedInvites.find((item) => item.code.toUpperCase() === inviteCode.trim().toUpperCase())
      : undefined

    const nextCode = (existing?.code ?? inviteCode.trim().toUpperCase()) || createCode()

    const nextInvite = await saveSharedInvite({
      id: existing?.id,
      code: nextCode,
      name: inviteDraft.name.trim(),
      email: inviteDraft.email.trim(),
      plusOnes: Number(inviteDraft.plusOnes) || 0,
      bringingDish: inviteDraft.bringingDish.trim(),
      favoriteThing: inviteDraft.favoriteThing.trim(),
      icebreakerAnswer: inviteDraft.icebreakerAnswer.trim(),
      triviaAnswerOne: inviteDraft.triviaAnswerOne.trim(),
      triviaAnswerTwo: inviteDraft.triviaAnswerTwo.trim(),
      notes: inviteDraft.notes.trim(),
    })

    setSavedInvites((current) => {
      const filtered = current.filter((item) => item.id !== nextInvite.id)
      return [nextInvite, ...filtered].sort((left, right) => right.updatedAt - left.updatedAt)
    })
    setInviteCode(nextInvite.code)
    setInviteMessage(
      sharedBackendEnabled
        ? `Saved ${nextInvite.name}'s invite. Keep code ${nextInvite.code} to edit later.`
        : `Saved locally for preview. Keep code ${nextInvite.code} to edit later.`,
    )
    if (sharedBackendEnabled) {
      await syncSharedData()
    }
  }

  const visibleInvites = savedInvites.length ? savedInvites : sampleGuestPreview
  const activeFavoriteThing = visibleInvites.length ? visibleInvites[favoriteThingIndex % visibleInvites.length] : undefined
  const invitedGuestCount = useMemo(
    () => visibleInvites.reduce((total, invite) => total + 1 + Number(invite.plusOnes || 0), 0),
    [visibleInvites],
  )
  const totalBringing = useMemo(
    () => visibleInvites.filter((invite) => invite.bringingDish).length,
    [visibleInvites],
  )
  const galleryPreview = useMemo(() => gallery.slice(0, 6), [gallery])
  const filteredResponses = responseFilter
    ? visibleInvites.filter((invite) => invite.name.toLowerCase().includes(responseFilter.toLowerCase()))
    : visibleInvites

  return (
    <main className="page-shell">
      <section className="hero card hero-glow">
        <div className="hero-copy">
          <div className="eyebrow">{eventInfo.theme}</div>
          <h1>{eventInfo.title}</h1>
          <p className="lede">{eventInfo.note}</p>
          <p className="intro-text">
            Editable invites, shared guest responses, a favorite-thing guessing game, and a photo booth designed for the Glacier Soiree
            palette.
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
          <div>
            <span className="meta-label">Status</span>
            <strong>{sharedStatus}</strong>
          </div>
        </div>
      </section>

      <section className="grid two-up">
        <article className="card accent-panel">
          <div className="section-header">
            <h2>How the party works</h2>
            <span className="muted">Rules + counts pulled from the shared board.</span>
          </div>
          <ul className="rule-list">
            {giftRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="stat-row">
            <div>
              <span className="meta-label">Estimated guests</span>
              <strong>{invitedGuestCount}</strong>
            </div>
            <div>
              <span className="meta-label">Bringing food</span>
              <strong>{totalBringing}</strong>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="section-header">
            <h2>Invite editor</h2>
            <span className="muted">Guests can update their invite with a saved code.</span>
          </div>
          <form className="stack form-grid" onSubmit={handleInviteSubmit}>
            <div className="split-grid">
              <label>
                Invite code
                <div className="inline-actions">
                  <input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="Enter your code to edit later"
                  />
                  <button type="button" onClick={() => loadInviteByCode(inviteCode)}>
                    Load
                  </button>
                </div>
              </label>
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
                <input
                  value={inviteDraft.email}
                  onChange={(event) => handleDraftChange('email', event.target.value)}
                  type="email"
                  placeholder="you@example.com"
                />
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
            <label>
              What food are you bringing?
              <input
                value={inviteDraft.bringingDish}
                onChange={(event) => handleDraftChange('bringingDish', event.target.value)}
                placeholder="For example: whipped feta, cookies, sparkling grapes"
              />
            </label>
            <label>
              Favorite thing you’re bringing
              <input
                value={inviteDraft.favoriteThing}
                onChange={(event) => handleDraftChange('favoriteThing', event.target.value)}
                placeholder="The item everyone will be talking about"
              />
            </label>
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
        <article className="card">
          <div className="section-header">
            <h2>Guest board</h2>
            <label className="mini-filter">
              Filter by name
              <input value={responseFilter} onChange={(event) => setResponseFilter(event.target.value)} placeholder="Search guests" />
            </label>
          </div>
          <p className="muted">Everyone can see who is coming, what they are bringing, and what they answered.</p>
          <div className="guest-board">
            {filteredResponses.map((invite) => (
              <article className="guest-card" key={invite.id}>
                <div className="guest-card-top">
                  <div>
                    <strong>{invite.name}</strong>
                    <p>{1 + Number(invite.plusOnes || 0)} coming</p>
                  </div>
                  <span className="code-pill">{invite.code}</span>
                </div>
                <div className="guest-grid">
                  <div>
                    <span className="meta-label">Food</span>
                    <p>{invite.bringingDish || 'Not added yet'}</p>
                  </div>
                  <div>
                    <span className="meta-label">Favorite thing</span>
                    <p>{invite.favoriteThing || 'Not added yet'}</p>
                  </div>
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
        </article>

        <article className="card">
          <div className="section-header">
            <h2>Favorite things game</h2>
            <span className="muted">A guessing game built from what people are bringing.</span>
          </div>
          <div className="game-card">
            <span className="eyebrow">Round {visibleInvites.length ? (favoriteThingIndex % visibleInvites.length) + 1 : 1}</span>
            <h3>{activeFavoriteThing?.name ? 'Who brought this?' : 'Invite responses unlock the round'}</h3>
            <p className="game-question">
              {activeFavoriteThing?.favoriteThing || 'Have guests add their favorite thing and reveal it in rounds.'}
            </p>
            {revealedFavoriteThing && activeFavoriteThing ? <p className="reveal-line">Answer: {activeFavoriteThing.name}</p> : null}
            <div className="camera-actions invite-actions">
              <button
                type="button"
                onClick={() => {
                  setFavoriteThingIndex((current) => current + 1)
                  setRevealedFavoriteThing(false)
                }}
              >
                Next round
              </button>
              <button type="button" onClick={() => setRevealedFavoriteThing((current) => !current)} className="secondary-button">
                {revealedFavoriteThing ? 'Hide answer' : 'Reveal answer'}
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
              <button type="button" onClick={() => setTriviaIndex((current) => current + 1)}>
                New trivia prompt
              </button>
            </div>
            <div>
              <span className="meta-label">Trivia prompt</span>
              <p className="prompt">{triviaPrompts[triviaIndex % triviaPrompts.length]}</p>
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

        <article className="card photo-card">
          <div className="section-header">
            <h2>Polaroid booth</h2>
            <span className="muted">Capture now, connect shared storage later.</span>
          </div>
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
                setCapturedSrc(await buildPolaroid(src, galleryCaption))
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
            galleryPreview.map((item) => <img key={item.id} src={item.src} alt={item.caption} />)
          ) : (
            <p className="muted">No photos yet. Add the first Polaroid to start the wall.</p>
          )}
        </div>
      </section>
    </main>
  )
}
