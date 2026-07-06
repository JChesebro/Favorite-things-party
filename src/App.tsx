import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  eventInfo,
  giftRules,
  icebreakerPrompts,
  polaroidCaptionContestPrompts,
  sampleGuestPreview,
  superlativePollPrompts,
  twoTruthsAndFavoritePrompts,
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

type CaptionContestEntry = {
  id: string
  photoId: string
  text: string
  votes: number
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
const captionContestEntriesStorageKey = 'glacier-caption-contest-entries'
const captionContestVotesStorageKey = 'glacier-caption-contest-votes'

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

function loadCanvasImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.crossOrigin = 'anonymous'
    image.src = source
  })
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

async function buildPhotoStrip(sources: string[], caption: string) {
  const frameSources = sources.slice(0, 3)
  if (frameSources.length !== 3) {
    throw new Error('Photo strip needs exactly 3 photos.')
  }

  const images = await Promise.all(frameSources.map((source) => loadCanvasImage(source)))

  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas unavailable')
  }

  context.fillStyle = '#f7efe4'
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = '#fff7ee'
  context.fillRect(74, 48, 932, 1824)

  const frameX = 132
  const frameWidth = 816
  const frameHeight = 500
  const filters = ['saturate(1.05)', 'contrast(1.04) sepia(0.08)', 'brightness(1.03) hue-rotate(-4deg)']

  images.forEach((image, index) => {
    const frameY = 128 + index * 560
    const squareSize = Math.min(image.width, image.height)
    const sx = (image.width - squareSize) / 2
    const sy = (image.height - squareSize) / 2

    context.save()
    context.fillStyle = '#fdf8f1'
    context.fillRect(frameX - 18, frameY - 18, frameWidth + 36, frameHeight + 36)
    context.filter = filters[index] || 'none'
    context.drawImage(image, sx, sy, squareSize, squareSize, frameX, frameY, frameWidth, frameHeight)
    context.restore()
  })

  context.fillStyle = '#0f2348'
  context.font = '700 46px Georgia, serif'
  context.fillText('Glacier Soiree Booth', 138, 1822)

  context.fillStyle = '#7e6238'
  context.font = '30px Georgia, serif'
  const lines = caption.trim() ? wrapText(caption.trim(), 730, context) : []
  lines.slice(0, 1).forEach((line) => {
    context.fillText(line, 138, 1864)
  })

  return canvas.toDataURL('image/png')
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
  const [galleryCaption, setGalleryCaption] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [capturedSrc, setCapturedSrc] = useState('')
  const [stripSources, setStripSources] = useState<string[]>([])
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>(emptyDraft)
  const [inviteMessage, setInviteMessage] = useState('')
  const [savedInvites, setSavedInvites] = useState<InviteRecord[]>([])
  const [galleryMessage, setGalleryMessage] = useState('')
  const [icebreakerIndex, setIcebreakerIndex] = useState(0)
  const [triviaIndex, setTriviaIndex] = useState(0)
  const [superlativeIndex, setSuperlativeIndex] = useState(0)
  const [twoTruthsIndex, setTwoTruthsIndex] = useState(0)
  const [captionContestIndex, setCaptionContestIndex] = useState(0)
  const [photoStyle, setPhotoStyle] = useState<PhotoStyle>('polaroid')
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({})
  const [contestMessage, setContestMessage] = useState('')
  const [captionContestEntries, setCaptionContestEntries] = useState<CaptionContestEntry[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = window.localStorage.getItem(captionContestEntriesStorageKey)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item): item is CaptionContestEntry =>
          item &&
          typeof item.id === 'string' &&
          typeof item.photoId === 'string' &&
          typeof item.text === 'string' &&
          typeof item.votes === 'number' &&
          typeof item.createdAt === 'number',
      )
    } catch {
      return []
    }
  })
  const [votedCaptionEntryIds, setVotedCaptionEntryIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = window.localStorage.getItem(captionContestVotesStorageKey)
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  })
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
    if (typeof window === 'undefined') return
    window.localStorage.setItem(captionContestEntriesStorageKey, JSON.stringify(captionContestEntries))
  }, [captionContestEntries])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(captionContestVotesStorageKey, JSON.stringify(votedCaptionEntryIds))
  }, [votedCaptionEntryIds])

  useEffect(() => {
    if (photoStyle === 'polaroid') {
      setStripSources([])
    } else {
      setCapturedSrc('')
    }
  }, [photoStyle])

  useEffect(() => {
    let cancelled = false

    async function buildStripPreview() {
      if (photoStyle !== 'strip') return
      if (stripSources.length !== 3) {
        setCapturedSrc('')
        return
      }

      try {
        const rendered = await buildPhotoStrip(stripSources, galleryCaption)
        if (cancelled) return
        setCapturedSrc(rendered)
      } catch {
        if (cancelled) return
        setCapturedSrc('')
      }
    }

    buildStripPreview()

    return () => {
      cancelled = true
    }
  }, [photoStyle, stripSources, galleryCaption])

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

  function addStripFrame(source: string) {
    setStripSources((current) => {
      if (current.length >= 3) {
        setGalleryMessage('Photo strip already has 3 frames. Clear it to retake.')
        return current
      }
      const next = [...current, source]
      setGalleryMessage(`Added frame ${next.length} of 3 for the strip.`)
      return next
    })
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

    if (photoStyle === 'strip') {
      addStripFrame(src)
      return
    }

    const nextImage = await buildPolaroid(src, galleryCaption)
    setCapturedSrc(nextImage)
  }

  function clearStripFrames() {
    setStripSources([])
    setCapturedSrc('')
    setGalleryMessage('Cleared strip frames. Add 3 new photos.')
  }

  async function downloadImage(src: string, filename: string) {
    try {
      const response = await fetch(src)
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      link.click()
      URL.revokeObjectURL(objectUrl)
      return
    } catch {
      const link = document.createElement('a')
      link.href = src
      link.download = filename
      link.click()
    }
  }

  async function downloadAllGalleryPhotos() {
    if (!gallery.length) {
      setGalleryMessage('No gallery photos to download yet.')
      return
    }

    for (const [index, item] of gallery.entries()) {
      await downloadImage(item.src, `glacier-party-photo-${String(index + 1).padStart(2, '0')}.png`)
      await new Promise((resolve) => window.setTimeout(resolve, 140))
    }

    setGalleryMessage('Download started for all shared gallery photos.')
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

  function handleCaptionDraftChange(photoId: string, value: string) {
    setCaptionDrafts((current) => ({
      ...current,
      [photoId]: value,
    }))
  }

  function submitCaptionEntry(photoId: string) {
    const draft = (captionDrafts[photoId] || '').trim()
    if (!draft) {
      setContestMessage('Add a caption before submitting.')
      return
    }

    const nextEntry: CaptionContestEntry = {
      id: crypto.randomUUID(),
      photoId,
      text: draft,
      votes: 0,
      createdAt: Date.now(),
    }

    setCaptionContestEntries((current) => [nextEntry, ...current])
    setCaptionDrafts((current) => ({
      ...current,
      [photoId]: '',
    }))
    setContestMessage('Caption submitted to the contest board.')
  }

  function voteForCaption(entryId: string) {
    if (votedCaptionEntryIds.includes(entryId)) {
      setContestMessage('You already voted for that caption from this browser.')
      return
    }

    setCaptionContestEntries((current) =>
      current.map((entry) => (entry.id === entryId ? { ...entry, votes: entry.votes + 1 } : entry)),
    )
    setVotedCaptionEntryIds((current) => [...current, entryId])
    setContestMessage('Vote counted.')
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
  const contestPhotoIds = useMemo(() => galleryPreview.map((item) => item.id), [galleryPreview])
  const contestEntriesByPhoto = useMemo(() => {
    const grouped: Record<string, CaptionContestEntry[]> = {}
    captionContestEntries.forEach((entry) => {
      if (!contestPhotoIds.includes(entry.photoId)) return
      const existingEntries = grouped[entry.photoId] ?? []
      grouped[entry.photoId] = [...existingEntries, entry]
    })

    Object.keys(grouped).forEach((photoId) => {
      const entries = grouped[photoId]
      if (!entries) return
      entries.sort((left, right) => {
        if (right.votes === left.votes) return right.createdAt - left.createdAt
        return right.votes - left.votes
      })
    })

    return grouped
  }, [captionContestEntries, contestPhotoIds])
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
            <h2>Guest spotlight games</h2>
            <span className="muted">For guests who RSVP yes. Kind prompts only.</span>
          </div>
          <div className="idea-grid">
            <article className="game-card">
              <span className="eyebrow">Superlatives poll</span>
              <h3>{superlativePollPrompts[superlativeIndex % superlativePollPrompts.length]}</h3>
              <p className="game-question">Guests vote live or the host can tally by show of hands.</p>
              <div className="camera-actions invite-actions">
                <button type="button" onClick={() => setSuperlativeIndex((current) => current + 1)}>
                  Next superlative
                </button>
              </div>
            </article>
            <article className="game-card">
              <span className="eyebrow">Two truths and a favorite</span>
              <h3>{twoTruthsAndFavoritePrompts[twoTruthsIndex % twoTruthsAndFavoritePrompts.length]}</h3>
              <p className="game-question">Each guest shares two true favorites and one fake favorite. Everyone guesses the fake.</p>
              <div className="camera-actions invite-actions">
                <button type="button" onClick={() => setTwoTruthsIndex((current) => current + 1)}>
                  Next two truths prompt
                </button>
              </div>
            </article>
            <article className="game-card">
              <span className="eyebrow">Polaroid caption contest</span>
              <h3>{polaroidCaptionContestPrompts[captionContestIndex % polaroidCaptionContestPrompts.length]}</h3>
              <p className="game-question">Guests pin up their photo with a funny caption. Crowd vote decides the winner.</p>
              <div className="camera-actions invite-actions">
                <button type="button" onClick={() => setCaptionContestIndex((current) => current + 1)}>
                  Next caption prompt
                </button>
              </div>
            </article>
          </div>
        </article>

        <article className="card photo-card card-icicle icicle-variant-5">
          <div className="section-header">
            <h2>Photo booth</h2>
            <span className="muted">Capture now, connect shared storage later. Captions and voting happen under each shared photo.</span>
          </div>
          <label>
            Photo style
            <select value={photoStyle} onChange={(event) => setPhotoStyle(event.target.value as PhotoStyle)}>
              <option value="polaroid">Polaroid</option>
              <option value="strip">Photo strip</option>
            </select>
          </label>
          <label>
            Print caption
            <input
              value={galleryCaption}
              onChange={(event) => setGalleryCaption(event.target.value)}
              placeholder="Appears right under Glacier Soiree Booth"
            />
          </label>
          {photoStyle === 'strip' ? (
            <div className="strip-progress">
              <span className="muted">Strip frames: {stripSources.length}/3</span>
              <button type="button" className="secondary-button" onClick={clearStripFrames}>Clear strip</button>
            </div>
          ) : null}
          <div className="camera-actions">
            <button type="button" onClick={startCamera}>Open camera</button>
            <button type="button" onClick={stopCamera}>Stop camera</button>
            <button type="button" onClick={capturePhoto} disabled={!cameraReady || (photoStyle === 'strip' && stripSources.length >= 3)}>
              {photoStyle === 'strip' ? 'Take strip frame' : 'Take photo'}
            </button>
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="secondary-button upload-button">
            {photoStyle === 'strip' ? 'Upload strip frame' : 'Upload instead'}
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
                if (photoStyle === 'strip') {
                  addStripFrame(src)
                } else {
                  const nextImage = await buildPolaroid(src, galleryCaption)
                  setCapturedSrc(nextImage)
                }
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
          <h2>Shared gallery + caption contest</h2>
          <div className="gallery-actions">
            <button type="button" onClick={syncSharedData} className="secondary-button">
              Refresh shared data
            </button>
            {hostUnlocked ? (
              <button type="button" onClick={downloadAllGalleryPhotos} className="secondary-button">
                Download all photos
              </button>
            ) : null}
          </div>
        </div>
        <p className="muted">Add your caption directly under any photo, then vote on your favorites.</p>
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
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => downloadImage(item.src, `glacier-party-photo-${item.id}.png`)}
                >
                  Download photo
                </button>
                <div className="contest-input-row">
                  <input
                    value={captionDrafts[item.id] || ''}
                    onChange={(event) => handleCaptionDraftChange(item.id, event.target.value)}
                    placeholder="Write a funny caption"
                  />
                  <button type="button" onClick={() => submitCaptionEntry(item.id)}>
                    Submit caption
                  </button>
                </div>
                <div className="contest-entries">
                  {(contestEntriesByPhoto[item.id] || []).slice(0, 3).map((entry) => (
                    <div className="contest-entry" key={`gallery-entry-${entry.id}`}>
                      <p>{entry.text}</p>
                      <button type="button" className="secondary-button" onClick={() => voteForCaption(entry.id)}>
                        Vote ({entry.votes})
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <p className="muted">No photos yet. Add the first Polaroid to start the wall.</p>
          )}
        </div>
      </section>

      <section className="card card-icicle icicle-variant-2">
        <div className="section-header">
          <h2>Polaroid caption contest board</h2>
          <span className="muted">Guests who RSVP yes can submit funny captions and vote favorites.</span>
        </div>
        {contestMessage ? <p className="status">{contestMessage}</p> : null}
        {galleryPreview.length ? (
          <div className="contest-grid">
            {galleryPreview.map((item) => {
              const entries = contestEntriesByPhoto[item.id] || []
              return (
                <article className="contest-card" key={`contest-${item.id}`}>
                  <img src={item.src} alt={item.caption || 'Caption contest photo'} />
                  <div className="contest-input-row">
                    <input
                      value={captionDrafts[item.id] || ''}
                      onChange={(event) => handleCaptionDraftChange(item.id, event.target.value)}
                      placeholder="Write a funny caption"
                    />
                    <button type="button" onClick={() => submitCaptionEntry(item.id)}>
                      Submit
                    </button>
                  </div>
                  <div className="contest-entries">
                    {entries.length ? (
                      entries.slice(0, 3).map((entry) => (
                        <div className="contest-entry" key={entry.id}>
                          <p>{entry.text}</p>
                          <button type="button" className="secondary-button" onClick={() => voteForCaption(entry.id)}>
                            Vote ({entry.votes})
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="muted">No captions yet for this photo.</p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="muted">Add photos to the gallery first, then launch the caption contest round.</p>
        )}
      </section>
    </main>
  )
}
