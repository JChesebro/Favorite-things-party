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
type FrameAdjustment = {
  zoom: number
  offsetX: number
  offsetY: number
}

const ownedGalleryIdsStorageKey = 'glacier-owned-gallery-ids'
const defaultFrameAdjustment: FrameAdjustment = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
}

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

function getCoverCrop(imageWidth: number, imageHeight: number, targetWidth: number, targetHeight: number) {
  const imageRatio = imageWidth / imageHeight
  const targetRatio = targetWidth / targetHeight

  if (imageRatio > targetRatio) {
    const cropHeight = imageHeight
    const cropWidth = cropHeight * targetRatio
    const sx = (imageWidth - cropWidth) / 2
    return { sx, sy: 0, sw: cropWidth, sh: cropHeight }
  }

  const cropWidth = imageWidth
  const cropHeight = cropWidth / targetRatio
  const sy = (imageHeight - cropHeight) / 2
  return { sx: 0, sy, sw: cropWidth, sh: cropHeight }
}

function getAdjustedCrop(
  imageWidth: number,
  imageHeight: number,
  targetWidth: number,
  targetHeight: number,
  adjustment: FrameAdjustment,
) {
  const base = getCoverCrop(imageWidth, imageHeight, targetWidth, targetHeight)
  const zoom = Math.max(1, adjustment.zoom)

  const sw = base.sw / zoom
  const sh = base.sh / zoom

  const maxOffsetX = (base.sw - sw) / 2
  const maxOffsetY = (base.sh - sh) / 2

  const nextSx = base.sx + maxOffsetX + (adjustment.offsetX / 100) * maxOffsetX
  const nextSy = base.sy + maxOffsetY + (adjustment.offsetY / 100) * maxOffsetY

  const sx = Math.min(Math.max(nextSx, base.sx), base.sx + base.sw - sw)
  const sy = Math.min(Math.max(nextSy, base.sy), base.sy + base.sh - sh)

  return { sx, sy, sw, sh }
}

function buildPolaroid(source: string, caption: string, adjustment: FrameAdjustment = defaultFrameAdjustment) {
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

      context.fillStyle = '#f2f8ff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      context.save()
      context.shadowColor = 'rgba(20, 38, 72, 0.24)'
      context.shadowBlur = 22
      context.shadowOffsetY = 18
      context.fillStyle = '#ffffff'
      context.fillRect(86, 74, 1028, 1342)
      context.restore()

      const frameX = 120
      const frameY = 120
      const frameWidth = 960
      const frameHeight = 1080
      const crop = getAdjustedCrop(image.width, image.height, frameWidth, frameHeight, adjustment)

      context.save()
      context.beginPath()
      context.rect(frameX, frameY, frameWidth, frameHeight)
      context.clip()
      context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, frameX, frameY, frameWidth, frameHeight)
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

      resolve(canvas.toDataURL('image/jpeg', 0.94))
    }
    image.onerror = reject
    image.crossOrigin = 'anonymous'
    image.src = source
  })
}

async function buildPhotoStrip(sources: string[], caption: string, adjustments: FrameAdjustment[]) {
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

  context.fillStyle = '#f3f9ff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = '#ffffff'
  context.fillRect(74, 48, 932, 1824)

  const frameX = 132
  const frameWidth = 816
  const frameHeight = 500
  const filters = ['saturate(1.05)', 'contrast(1.04) sepia(0.08)', 'brightness(1.03) hue-rotate(-4deg)']

  images.forEach((image, index) => {
    const frameY = 128 + index * 560
    const crop = getAdjustedCrop(
      image.width,
      image.height,
      frameWidth,
      frameHeight,
      adjustments[index] || defaultFrameAdjustment,
    )

    context.save()
    context.fillStyle = '#fdf8f1'
    context.fillRect(frameX - 18, frameY - 18, frameWidth + 36, frameHeight + 36)
    context.filter = filters[index] || 'none'
    context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, frameX, frameY, frameWidth, frameHeight)
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

  return canvas.toDataURL('image/jpeg', 0.94)
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
  const [polaroidSource, setPolaroidSource] = useState('')
  const [stripSources, setStripSources] = useState<string[]>([])
  const [polaroidAdjustment, setPolaroidAdjustment] = useState<FrameAdjustment>(defaultFrameAdjustment)
  const [stripAdjustments, setStripAdjustments] = useState<FrameAdjustment[]>([])
  const [activeStripFrame, setActiveStripFrame] = useState(0)
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
    if (photoStyle === 'polaroid') {
      setStripSources([])
      setStripAdjustments([])
      setActiveStripFrame(0)
    } else {
      setCapturedSrc('')
    }
  }, [photoStyle])

  useEffect(() => {
    let cancelled = false

    async function buildPolaroidPreview() {
      if (photoStyle !== 'polaroid') return
      if (!polaroidSource) {
        setCapturedSrc('')
        return
      }

      try {
        const rendered = await buildPolaroid(polaroidSource, galleryCaption, polaroidAdjustment)
        if (cancelled) return
        setCapturedSrc(rendered)
      } catch {
        if (cancelled) return
        setCapturedSrc('')
      }
    }

    buildPolaroidPreview()

    return () => {
      cancelled = true
    }
  }, [photoStyle, polaroidSource, galleryCaption, polaroidAdjustment])

  useEffect(() => {
    let cancelled = false

    async function buildStripPreview() {
      if (photoStyle !== 'strip') return
      if (stripSources.length !== 3) {
        setCapturedSrc('')
        return
      }

      try {
        const rendered = await buildPhotoStrip(stripSources, galleryCaption, stripAdjustments)
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
  }, [photoStyle, stripSources, galleryCaption, stripAdjustments])

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
        setSavedInvites([])
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
    setStripAdjustments((current) => {
      if (current.length >= 3) return current
      return [...current, { ...defaultFrameAdjustment }]
    })
  }

  function updatePolaroidAdjustment(field: keyof FrameAdjustment, value: number) {
    setPolaroidAdjustment((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateStripAdjustment(field: keyof FrameAdjustment, value: number) {
    setStripAdjustments((current) =>
      current.map((adjustment, index) =>
        index === activeStripFrame
          ? {
              ...adjustment,
              [field]: value,
            }
          : adjustment,
      ),
    )
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

    setPolaroidSource(src)
    setPolaroidAdjustment({ ...defaultFrameAdjustment })
  }

  function clearStripFrames() {
    setStripSources([])
    setStripAdjustments([])
    setActiveStripFrame(0)
    setCapturedSrc('')
    setGalleryMessage('Cleared strip frames. Add 3 new photos.')
  }

  async function downloadImage(src: string, filename: string) {
    try {
      const image = await loadCanvasImage(src)
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth || image.width
      canvas.height = image.naturalHeight || image.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      context.drawImage(image, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (!value) {
            reject(new Error('Blob conversion failed'))
            return
          }
          resolve(value)
        }, 'image/jpeg', 0.92)
      })
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
      await downloadImage(item.src, `glacier-party-photo-${String(index + 1).padStart(2, '0')}.jpg`)
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
    link.download = photoStyle === 'strip' ? 'glacier-soiree-photostrip.jpg' : 'glacier-soiree-polaroid.jpg'
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
      triviaAnswerTwo: '',
      notes: '',
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

  const visibleInvites = savedInvites
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
  const attendeeNames = useMemo(
    () => Array.from(new Set(visibleInvites.map((invite) => invite.name.trim()).filter(Boolean))),
    [visibleInvites],
  )
  const icebreakerResponses = useMemo(
    () => visibleInvites.map((invite) => invite.icebreakerAnswer.trim()).filter(Boolean),
    [visibleInvites],
  )
  const triviaOneResponses = useMemo(
    () => visibleInvites.map((invite) => invite.triviaAnswerOne.trim()).filter(Boolean),
    [visibleInvites],
  )
  const gamesUrl =
    typeof window === 'undefined' ? '?tab=games' : `${window.location.origin}${window.location.pathname}?tab=games`
  const partyUrl =
    typeof window === 'undefined' ? '/' : `${window.location.origin}${window.location.pathname}${window.location.search.replace(/\?tab=games/, '')}`
  const isGamesTab = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'games'

  if (isGamesTab) {
    return (
      <main className="page-shell">
        <section className="card">
          <div className="section-header">
            <h2>Party Games</h2>
            <a className="secondary-button" href={partyUrl}>Back to party</a>
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
        </section>
      </main>
    )
  }

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
          <div className="coming-row">
            <span className="meta-label">Who is coming</span>
            <div className="coming-list">
              {attendeeNames.length ? attendeeNames.map((name) => <span key={name}>{name}</span>) : <span>No RSVPs yet</span>}
            </div>
            <a className="secondary-button party-games-link" href={gamesUrl} target="_blank" rel="noreferrer">
              Party Games
            </a>
          </div>
        </article>

        <article className="card photo-card card-icicle icicle-variant-5">
          <div className="section-header">
            <h2>Photo booth</h2>
          </div>
          <label>
            Photo style
            <select value={photoStyle} onChange={(event) => setPhotoStyle(event.target.value as PhotoStyle)}>
              <option value="polaroid">Polaroid</option>
              <option value="strip">Photo strip</option>
            </select>
          </label>
          <label>
            Submit a Funny Caption
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
                  setPolaroidSource(src)
                  setPolaroidAdjustment({ ...defaultFrameAdjustment })
                }
              }
              reader.readAsDataURL(file)
              event.currentTarget.value = ''
            }}
          />
          {photoStyle === 'polaroid' && polaroidSource ? (
            <div className="crop-controls">
              <label>
                Zoom
                <input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.05}
                  value={polaroidAdjustment.zoom}
                  onChange={(event) => updatePolaroidAdjustment('zoom', Number(event.target.value))}
                />
              </label>
              <label>
                Move left-right
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={polaroidAdjustment.offsetX}
                  onChange={(event) => updatePolaroidAdjustment('offsetX', Number(event.target.value))}
                />
              </label>
              <label>
                Move up-down
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={polaroidAdjustment.offsetY}
                  onChange={(event) => updatePolaroidAdjustment('offsetY', Number(event.target.value))}
                />
              </label>
            </div>
          ) : null}
          {photoStyle === 'strip' && stripSources.length ? (
            <div className="crop-controls">
              <div className="strip-frame-pills">
                {stripSources.map((_, index) => (
                  <button
                    key={`frame-${index}`}
                    type="button"
                    className={index === activeStripFrame ? 'pill-active' : 'secondary-button'}
                    onClick={() => setActiveStripFrame(index)}
                  >
                    Frame {index + 1}
                  </button>
                ))}
              </div>
              <label>
                Zoom frame {activeStripFrame + 1}
                <input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.05}
                  value={stripAdjustments[activeStripFrame]?.zoom ?? 1}
                  onChange={(event) => updateStripAdjustment('zoom', Number(event.target.value))}
                />
              </label>
              <label>
                Move left-right
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={stripAdjustments[activeStripFrame]?.offsetX ?? 0}
                  onChange={(event) => updateStripAdjustment('offsetX', Number(event.target.value))}
                />
              </label>
              <label>
                Move up-down
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={stripAdjustments[activeStripFrame]?.offsetY ?? 0}
                  onChange={(event) => updateStripAdjustment('offsetY', Number(event.target.value))}
                />
              </label>
            </div>
          ) : null}
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

      <section>
        <article className="card card-icicle icicle-variant-2">
          <div className="section-header">
            <h2>RSVP</h2>
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
            <div className="form-grid">
              <h3 className="form-subhead">Icebreak Questions</h3>
              <label>
                Icebreaker Questions
                <span className="meta-label">Question: {icebreakerPrompts[icebreakerIndex % icebreakerPrompts.length]}</span>
                <textarea
                  value={inviteDraft.icebreakerAnswer}
                  onChange={(event) => handleDraftChange('icebreakerAnswer', event.target.value)}
                  rows={3}
                  placeholder="Answer this icebreaker right here"
                />
                <button type="button" className="secondary-button" onClick={() => setIcebreakerIndex((current) => current + 1)}>
                  New icebreaker question
                </button>
              </label>
              <h3 className="form-subhead">Trivia Questions</h3>
              <label>
                Trivia Questions
                <span className="meta-label">Question: {triviaPrompts[triviaIndex % triviaPrompts.length]}</span>
                <textarea
                  value={inviteDraft.triviaAnswerOne}
                  onChange={(event) => handleDraftChange('triviaAnswerOne', event.target.value)}
                  rows={3}
                  placeholder="Answer this trivia question here"
                />
                <button type="button" className="secondary-button" onClick={() => setTriviaIndex((current) => current + 1)}>
                  New trivia question
                </button>
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
            <h2>Guest Trivia / Icebreaker responses</h2>
          </div>
          <p className="muted">Each question lists every submitted answer for guests to read.</p>
          <div className="response-columns">
            <section className="board-panel">
              <h3>Question responses</h3>
              <div className="guest-board responses-by-question">
                <article className="guest-card">
                  <span className="meta-label">Icebreaker question</span>
                  <p className="question-line">{icebreakerPrompts[icebreakerIndex % icebreakerPrompts.length]}</p>
                  {icebreakerResponses.length ? (
                    <ul className="answer-list">
                      {icebreakerResponses.map((answer, index) => <li key={`ice-${index}`}>{answer}</li>)}
                    </ul>
                  ) : (
                    <p>No responses yet.</p>
                  )}
                </article>
                <article className="guest-card">
                  <span className="meta-label">Trivia question 1</span>
                  <p className="question-line">{triviaPrompts[triviaIndex % triviaPrompts.length]}</p>
                  {triviaOneResponses.length ? (
                    <ul className="answer-list">
                      {triviaOneResponses.map((answer, index) => <li key={`trivia-one-${index}`}>{answer}</li>)}
                    </ul>
                  ) : (
                    <p>No responses yet.</p>
                  )}
                </article>
              </div>
            </section>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-header">
          <h2>Gallery</h2>
          <div className="gallery-actions">
            <button type="button" onClick={syncSharedData} className="secondary-button">
              Refresh shared data
            </button>
            <button type="button" onClick={downloadAllGalleryPhotos} className="secondary-button">
              Download all photos
            </button>
          </div>
        </div>
        <p className="muted">Guests can download any photo, and uploaders can remove only their own photos.</p>
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
                  onClick={() => downloadImage(item.src, `glacier-party-photo-${item.id}.jpg`)}
                >
                  Download photo
                </button>
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
