'use client'

import { useEffect, useState, useCallback } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import MuiSlider from '@mui/material/Slider'
import { ZoomIn, ZoomOut } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getCroppedImageBlob } from '@/lib/crop-image'

interface AvatarCropDialogProps {
  file: File | null
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

export function AvatarCropDialog({ file, onConfirm, onCancel }: AvatarCropDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!file) {
      setImageUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleConfirm() {
    if (!imageUrl || !croppedAreaPixels) return
    setProcessing(true)
    try {
      const blob = await getCroppedImageBlob(imageUrl, croppedAreaPixels)
      onConfirm(blob)
    } catch {
      // Let the parent handle the error via the upload flow
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Position Your Photo</DialogTitle>
          <DialogDescription>
            Drag to reposition. Scroll or pinch to zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black/90">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="flex items-center gap-3 px-2">
          <ZoomOut className="w-4 h-4 shrink-0 text-muted-foreground" />
          <MuiSlider
            value={zoom}
            min={1}
            max={3}
            step={0.05}
            onChange={(_, v) => setZoom(v as number)}
            size="small"
          />
          <ZoomIn className="w-4 h-4 shrink-0 text-muted-foreground" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing}>
            {processing ? 'Processing…' : 'Save Photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
