"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  GradientAvatar,
  Slider,
} from "@voidhash/ui";
import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
// v6 ships positioning styles as a separate stylesheet (not auto-injected); the
// cropper renders broken without it.
import "react-easy-crop/react-easy-crop.css";

/** Accepted upload types — kept in sync with the server-side allow-list. */
const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";

/** Edge length the cropped square is resized to before upload (keeps payloads tiny). */
const OUTPUT_SIZE = 512;

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the `data:<type>;base64,` prefix — the server accepts raw base64.
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

/**
 * Draws the selected crop area to an offscreen canvas, resizing to a fixed
 * square, and returns the result as a base64 WebP (no data-URL prefix).
 */
const getCroppedImage = async (
  imageSrc: string,
  pixelCrop: Area,
): Promise<{ imageBase64: string; contentType: string }> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) {
    throw new Error("Could not produce cropped image");
  }
  const imageBase64 = await blobToBase64(blob);
  return { imageBase64, contentType: "image/webp" };
};

export interface AvatarUploaderProps {
  /** Display name (used for alt text). */
  readonly name: string;
  /** Stable id used to seed the gradient fallback. */
  readonly fallback: string;
  /** Current avatar URL, or `null` to show the generated gradient. */
  readonly src: string | null;
  /** Disables interaction while a mutation is in flight. */
  readonly isPending: boolean;
  readonly onUpload: (input: { imageBase64: string; contentType: string }) => void;
  readonly onRemove: () => void;
}

/**
 * Click-to-upload avatar with a 1:1 crop dialog. Clicking the avatar opens the
 * file picker; selecting an image opens a {@link Cropper} locked to a square
 * aspect, and saving renders the crop to a 512×512 WebP that is handed to
 * `onUpload` as base64. A "Remove" action appears once a custom avatar is set.
 */
export function AvatarUploader({
  name,
  fallback,
  src,
  isPending,
  onUpload,
  onRemove,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const closeDialog = () => {
    if (imageSrc) {
      URL.revokeObjectURL(imageSrc);
    }
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so selecting the same file again re-triggers onChange.
    event.target.value = "";
    if (!file) {
      return;
    }
    setImageSrc(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      return;
    }
    setIsSaving(true);
    try {
      const result = await getCroppedImage(imageSrc, croppedAreaPixels);
      onUpload(result);
      closeDialog();
    } catch {
      toast.error("Failed to process the image. Please try another file.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        aria-label="Upload avatar"
        className="rounded-full ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <GradientAvatar
          alt={name}
          className="size-16 rounded-full"
          fallback={fallback}
          src={src ?? undefined}
        />
      </button>
      {src ? (
        <Button
          disabled={isPending}
          onClick={onRemove}
          size="xs"
          type="button"
          variant="ghost"
        >
          Remove
        </Button>
      ) : null}

      <input
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileSelected}
        ref={inputRef}
        type="file"
      />

      <Dialog onOpenChange={(open) => (open ? null : closeDialog())} open={imageSrc !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crop avatar</DialogTitle>
            <DialogDescription>Drag to reposition and use the slider to zoom.</DialogDescription>
          </DialogHeader>
          <div className="relative h-72 w-full overflow-hidden rounded-md bg-muted">
            {imageSrc ? (
              <Cropper
                aspect={1}
                crop={crop}
                cropShape="round"
                image={imageSrc}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                showGrid={false}
                zoom={zoom}
              />
            ) : null}
          </div>
          <Slider
            aria-label="Zoom"
            max={3}
            min={1}
            onValueChange={(value) => setZoom(value[0] ?? 1)}
            step={0.01}
            value={[zoom]}
          />
          <DialogFooter>
            <Button onClick={closeDialog} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={isSaving} onClick={handleSave} type="button">
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
