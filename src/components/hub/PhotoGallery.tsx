'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'

interface Photo {
  id: string
  url: string
  caption: string | null
  createdAt: Date
  user: { name: string | null }
}

interface TournamentFilter {
  id: string
  name: string
  year: number
}

interface Props {
  tournamentId: string
  currentUserId: string | null
  isRegistered: boolean
  initialPhotos: Photo[]
  tournamentFilters?: TournamentFilter[]
}

const SKELETON_ID = '__skeleton__'

export function PhotoGallery({ tournamentId, currentUserId, isRegistered, initialPhotos, tournamentFilters }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [caption, setCaption] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeFilter, setActiveFilter] = useState<string>('current')
  const [filterLoading, setFilterLoading] = useState(false)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPendingFile(file)
    setCaption('')
    setError(null)
  }

  async function handleUpload() {
    if (!pendingFile || uploading) return
    setUploading(true)
    setError(null)

    // Show skeleton in grid immediately
    const skeletonPhoto: Photo = {
      id: SKELETON_ID,
      url: '',
      caption: null,
      createdAt: new Date(),
      user: { name: null },
    }
    setPhotos((prev) => [skeletonPhoto, ...prev])

    try {
      const form = new FormData()
      form.append('file', pendingFile)
      if (caption.trim()) form.append('caption', caption.trim())

      const res = await fetch(`/api/tournaments/${tournamentId}/photos`, {
        method: 'POST',
        body: form,
      })

      if (res.ok) {
        const photo = await res.json()
        setPhotos((prev) => [photo, ...prev.filter((p) => p.id !== SKELETON_ID)])
        setPendingFile(null)
        setCaption('')
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setPhotos((prev) => prev.filter((p) => p.id !== SKELETON_ID))
        let msg = 'Upload failed — please try again.'
        try {
          const body = await res.json()
          if (body.error === 'Unauthorized') msg = 'You need to be signed in to upload photos.'
          else if (body.error === 'Not a tournament participant') msg = 'Only registered players can upload photos.'
          else if (body.error === 'File required') msg = 'Please select an image file.'
          else if (body.error) msg = body.error
        } catch {}
        setError(msg)
      }
    } catch {
      setPhotos((prev) => prev.filter((p) => p.id !== SKELETON_ID))
      setError("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setUploading(false)
    }
  }

  async function handleFilterChange(filter: string) {
    setActiveFilter(filter)
    if (filter === 'current') {
      // Show current tournament's photos (the initial data)
      setPhotos(initialPhotos)
      return
    }

    setFilterLoading(true)
    try {
      if (filter === 'all' && tournamentFilters) {
        // Fetch from all tournaments
        const allPhotos: Photo[] = []
        for (const tf of tournamentFilters) {
          const res = await fetch(`/api/tournaments/${tf.id}/photos`)
          if (res.ok) {
            const data = await res.json()
            allPhotos.push(...data)
          }
        }
        allPhotos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setPhotos(allPhotos)
      } else {
        // Fetch from specific tournament
        const res = await fetch(`/api/tournaments/${filter}/photos`)
        if (res.ok) {
          setPhotos(await res.json())
        }
      }
    } catch {
      setError('Failed to load photos')
    } finally {
      setFilterLoading(false)
    }
  }

  const realPhotos = photos.filter((p) => p.id !== SKELETON_ID)
  const showSkeleton = photos.some((p) => p.id === SKELETON_ID)

  if (!currentUserId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-3">Sign in to view and upload photos.</p>
        <Link href="/auth/login" className="text-sm underline">Sign in</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header row with upload button */}
      {isRegistered && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-3 sm:py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60 min-h-[48px] sm:min-h-0"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              + Add Photo
            </button>
            <span className="text-xs text-muted-foreground text-center sm:text-right">Max 10 MB · JPEG, PNG, GIF, WebP, HEIC</span>
          </div>

          {/* Hidden file input */}
          <Input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,image/bmp,image/tiff,image/avif,image/*"
            capture="environment"
            className="hidden"
            onChange={onFileChange}
          />

          {/* Caption + confirm row — appears after file selected */}
          {pendingFile && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/30">
              <span className="text-xs text-muted-foreground truncate flex-1">{pendingFile.name}</span>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption (optional)"
                className="h-8 text-xs w-40"
                onKeyDown={(e) => e.key === 'Enter' && handleUpload()}
              />
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="shrink-0 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button
                type="button"
                onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = '' }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      )}

      {/* Tournament filter (for renewed tournaments) */}
      {tournamentFilters && tournamentFilters.length > 1 && (
        <select
          value={activeFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="w-full sm:w-auto h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
        >
          <option value="all">All Tournaments</option>
          {tournamentFilters.map((tf, i) => (
            <option key={tf.id} value={i === 0 ? 'current' : tf.id}>
              {tf.name}{tf.year ? ` (${tf.year})` : ''}
            </option>
          ))}
        </select>
      )}

      {/* Gallery grid */}
      {filterLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-md overflow-hidden border border-border bg-muted/30 animate-pulse">
              <div className="w-full h-36 bg-muted" />
              <div className="p-2 space-y-1.5">
                <div className="h-2.5 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : realPhotos.length === 0 && !showSkeleton ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          No photos yet — be the first to share one!
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Loading skeleton */}
          {showSkeleton && (
            <div className="rounded-md overflow-hidden border border-border bg-muted/30 animate-pulse">
              <div className="w-full h-36 bg-muted" />
              <div className="p-2 space-y-1.5">
                <div className="h-2.5 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            </div>
          )}

          {realPhotos.map((photo) => (
            <div key={photo.id} className="rounded-md overflow-hidden border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? ''} className="w-full h-36 object-cover" />
              <div className="p-2">
                {photo.caption && <p className="text-xs font-medium truncate">{photo.caption}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{photo.user.name ?? 'Player'}</p>
                <a
                  href={photo.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline text-muted-foreground hover:text-foreground mt-1 block"
                >
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
