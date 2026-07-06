import { sampleGuestPreview } from '../data'

export type GalleryRecord = {
  id: string
  src: string
  caption: string
  created_at: string
}

export type InviteRecord = {
  id: string
  code: string
  name: string
  email: string
  plus_ones: number
  bringing_dish: string
  favorite_thing: string
  icebreaker_answer: string
  trivia_answer_one: string
  trivia_answer_two: string
  notes: string
  updated_at: string
}

type InviteInput = {
  id?: string
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
}

type GalleryInput = {
  src: string
  caption: string
}

const env = import.meta.env
const supabaseUrl = env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY as string | undefined
const invitesTable = env.VITE_SUPABASE_INVITES_TABLE || 'guest_invites'
const galleryTable = env.VITE_SUPABASE_GALLERY_TABLE || 'gallery_entries'

function hasBackend() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

function authHeaders() {
  if (!supabaseAnonKey) return { 'Content-Type': 'application/json' }
  return {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    Prefer: 'return=representation',
  }
}

async function request<T>(path: string, init?: RequestInit) {
  if (!supabaseUrl) throw new Error('Supabase URL is not configured.')

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) return [] as T
  return (await response.json()) as T
}

function toInvitePreview(record: InviteRecord) {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    plusOnes: Number(record.plus_ones || 0),
    bringingDish: record.bringing_dish,
    favoriteThing: record.favorite_thing,
    icebreakerAnswer: record.icebreaker_answer,
    triviaAnswerOne: record.trivia_answer_one,
    triviaAnswerTwo: record.trivia_answer_two,
    notes: record.notes,
    code: record.code,
    updatedAt: new Date(record.updated_at).getTime(),
  }
}

export function isBackendConfigured() {
  return hasBackend()
}

export async function loadSharedInvites() {
  if (!hasBackend()) return sampleGuestPreview
  const data = await request<InviteRecord[]>(`${invitesTable}?select=*&order=updated_at.desc`)
  return data.map(toInvitePreview)
}

export async function saveSharedInvite(input: InviteInput) {
  if (!hasBackend()) {
    return {
      id: input.id ?? crypto.randomUUID(),
      code: input.code,
      name: input.name,
      email: input.email,
      plusOnes: input.plusOnes,
      bringingDish: input.bringingDish,
      favoriteThing: input.favoriteThing,
      icebreakerAnswer: input.icebreakerAnswer,
      triviaAnswerOne: input.triviaAnswerOne,
      triviaAnswerTwo: input.triviaAnswerTwo,
      notes: input.notes,
      updatedAt: Date.now(),
    }
  }

  const payload = {
    id: input.id ?? crypto.randomUUID(),
    code: input.code,
    name: input.name,
    email: input.email,
    plus_ones: input.plusOnes,
    bringing_dish: input.bringingDish,
    favorite_thing: input.favoriteThing,
    icebreaker_answer: input.icebreakerAnswer,
    trivia_answer_one: input.triviaAnswerOne,
    trivia_answer_two: input.triviaAnswerTwo,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  }

  const response = await request<InviteRecord[]>(`${invitesTable}?on_conflict=id`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  })

  return toInvitePreview(response[0] || payload)
}

export async function loadSharedGallery() {
  if (!hasBackend()) return []
  const data = await request<GalleryRecord[]>(`${galleryTable}?select=*&order=created_at.desc`)
  return data.map((item) => ({
    id: item.id,
    src: item.src,
    caption: item.caption,
    createdAt: new Date(item.created_at).getTime(),
  }))
}

export async function saveSharedGalleryItem(input: GalleryInput) {
  if (!hasBackend()) {
    return {
      id: crypto.randomUUID(),
      src: input.src,
      caption: input.caption,
      createdAt: Date.now(),
    }
  }

  const payload = {
    id: crypto.randomUUID(),
    src: input.src,
    caption: input.caption,
    created_at: new Date().toISOString(),
  }

  const data = await request<GalleryRecord[]>(`${galleryTable}`, {
    method: 'POST',
    headers: {
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  })

  const item = data[0] || payload
  return {
    id: item.id,
    src: item.src,
    caption: item.caption,
    createdAt: new Date(item.created_at).getTime(),
  }
}

export async function findSharedInviteByCode(code: string) {
  if (!hasBackend()) {
    return sampleGuestPreview.find((invite) => invite.code.toUpperCase() === code.trim().toUpperCase()) || null
  }

  const normalized = code.trim().toUpperCase()
  const data = await request<InviteRecord[]>(`${invitesTable}?select=*&code=eq.${encodeURIComponent(normalized)}&limit=1`)
  const item = data[0]
  return item ? toInvitePreview(item) : null
}
