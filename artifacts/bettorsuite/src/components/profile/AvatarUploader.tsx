import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Move, RotateCcw, Trash2, ZoomIn } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AvatarUploaderProps {
  username: string;
  value: string | null;
  onChange: (value: string) => void;
}

interface CropImage {
  src: string;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_AVATAR_LENGTH = 850_000;
const OUTPUT_SIZE = 512;
const CROP_RATIO = 0.86;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });
}

function decodeImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This image could not be opened."));
    image.src = src;
  });
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function AvatarUploader({ username, value, onChange }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    start: Point;
    origin: Point;
  } | null>(null);
  const [cropImage, setCropImage] = useState<CropImage | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState(320);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!cropImage || !viewport) return;
    const measure = () => setViewportSize(viewport.clientWidth || 320);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [cropImage]);

  const geometry = useMemo(() => {
    if (!cropImage) return null;
    const cropSize = viewportSize * CROP_RATIO;
    const baseScale = Math.max(cropSize / cropImage.width, cropSize / cropImage.height);
    const scale = baseScale * zoom;
    const width = cropImage.width * scale;
    const height = cropImage.height * scale;
    return {
      baseScale,
      cropSize,
      scale,
      width,
      height,
      maxX: Math.max(0, (width - cropSize) / 2),
      maxY: Math.max(0, (height - cropSize) / 2),
    };
  }, [cropImage, viewportSize, zoom]);

  const closeEditor = () => {
    setCropImage(null);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    dragRef.current = null;
  };

  const resetCrop = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const updateZoom = (nextZoom: number) => {
    if (!cropImage) return;
    const cropSize = viewportSize * CROP_RATIO;
    const nextBaseScale = Math.max(cropSize / cropImage.width, cropSize / cropImage.height);
    const nextWidth = cropImage.width * nextBaseScale * nextZoom;
    const nextHeight = cropImage.height * nextBaseScale * nextZoom;
    const maxX = Math.max(0, (nextWidth - cropSize) / 2);
    const maxY = Math.max(0, (nextHeight - cropSize) / 2);
    setZoom(nextZoom);
    setPosition((current) => ({
      x: clamp(current.x, -maxX, maxX),
      y: clamp(current.y, -maxY, maxY),
    }));
  };

  const openFile = async (file: File) => {
    if (!ACCEPTED_TYPES.has(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
    if (file.size > MAX_FILE_BYTES) throw new Error("Choose an image under 8 MB.");
    const src = await readFileAsDataUrl(file);
    const image = await decodeImage(src);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("This image has no usable dimensions.");
    setCropImage({ src, width: image.naturalWidth, height: image.naturalHeight });
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const applyCrop = async () => {
    if (!cropImage || !geometry) return;
    setProcessing(true);
    setError("");
    try {
      const image = await decodeImage(cropImage.src);
      const sourceX = ((geometry.width - geometry.cropSize) / 2 - position.x) / geometry.scale;
      const sourceY = ((geometry.height - geometry.cropSize) / 2 - position.y) / geometry.scale;
      const sourceSide = geometry.cropSize / geometry.scale;
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare this image.");
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSide,
        sourceSide,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );

      let quality = 0.88;
      let result = canvas.toDataURL("image/webp", quality);
      while (result.length > MAX_AVATAR_LENGTH && quality > 0.48) {
        quality -= 0.08;
        result = canvas.toDataURL("image/webp", quality);
      }
      if (!result.startsWith("data:image/webp;base64,") || result.length > MAX_AVATAR_LENGTH) {
        throw new Error("This photo could not be compressed enough. Try a simpler image.");
      }

      onChange(result);
      setPhotoReady(true);
      closeEditor();
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Unable to use this image.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex w-32 flex-col items-center gap-2">
      <div className="relative">
        <Avatar className="h-28 w-28 border-4 border-white shadow-lg ring-1 ring-slate-200">
          <AvatarImage src={value ?? undefined} alt={`${username} profile`} />
          <AvatarFallback className="bg-slate-950 text-2xl font-bold text-white">
            {username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          aria-label={value ? "Change profile image" : "Upload profile image"}
          className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-md transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        >
          <Camera className="h-4 w-4" />
        </button>
        {value && (
          <button
            type="button"
            aria-label="Remove profile image"
            onClick={() => {
              onChange("");
              setPhotoReady(true);
            }}
            className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-white text-red-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setProcessing(true);
          setError("");
          try {
            await openFile(file);
          } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Unable to use this image.");
          } finally {
            setProcessing(false);
          }
        }}
      />
      {processing && !cropImage && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Preparing photo...
        </span>
      )}
      {photoReady && !error && (
        <p className="text-center text-[10px] font-medium leading-4 text-blue-600">
          Ready to save
        </p>
      )}
      {error && !cropImage && (
        <p role="alert" className="w-48 text-center text-xs leading-4 text-red-600">
          {error}
        </p>
      )}

      <Dialog open={Boolean(cropImage)} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-md gap-0 overflow-hidden border-0 bg-slate-950 p-0 text-white shadow-2xl">
          <DialogHeader className="border-b border-white/10 px-5 py-5 pr-12">
            <DialogTitle className="text-base text-white">Position your photo</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Drag to reposition, then zoom until your profile photo feels right.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 py-5">
            <div
              ref={viewportRef}
              className="relative mx-auto aspect-square w-full max-w-[320px] cursor-grab select-none overflow-hidden rounded-xl bg-slate-900 active:cursor-grabbing"
              style={{ touchAction: "none" }}
              onPointerDown={(event) => {
                if (!geometry) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = {
                  pointerId: event.pointerId,
                  start: { x: event.clientX, y: event.clientY },
                  origin: position,
                };
              }}
              onPointerMove={(event) => {
                if (!geometry || dragRef.current?.pointerId !== event.pointerId) return;
                setPosition({
                  x: clamp(
                    dragRef.current.origin.x + event.clientX - dragRef.current.start.x,
                    -geometry.maxX,
                    geometry.maxX,
                  ),
                  y: clamp(
                    dragRef.current.origin.y + event.clientY - dragRef.current.start.y,
                    -geometry.maxY,
                    geometry.maxY,
                  ),
                });
              }}
              onPointerUp={(event) => {
                if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
            >
              {cropImage && geometry && (
                <img
                  src={cropImage.src}
                  alt="Profile crop preview"
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: geometry.width,
                    height: geometry.height,
                    transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
                  }}
                />
              )}
              <div className="pointer-events-none absolute inset-[7%] rounded-full border-[3px] border-white shadow-[0_0_0_999px_rgba(2,6,23,0.58),0_0_25px_rgba(0,0,0,0.35)]" />
              <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-950/70 px-3 py-1.5 text-[10px] font-semibold text-slate-200 backdrop-blur-sm">
                <Move className="h-3 w-3" /> Drag to move
              </div>
            </div>

            <div className="mx-auto mt-5 flex max-w-[320px] items-center gap-3">
              <ImageIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <label htmlFor="avatar-zoom" className="sr-only">Zoom profile image</label>
              <input
                id="avatar-zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => updateZoom(Number(event.target.value))}
                className="h-1.5 min-w-0 flex-1 cursor-pointer accent-blue-500"
              />
              <ZoomIn className="h-5 w-5 text-slate-300" aria-hidden="true" />
              <button
                type="button"
                onClick={resetCrop}
                className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
            {error && (
              <p role="alert" className="mx-auto mt-3 max-w-[320px] text-center text-xs text-red-300">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="flex-row justify-end gap-2 border-t border-white/10 bg-white/[0.03] px-5 py-4 sm:space-x-0">
            <Button type="button" variant="ghost" onClick={closeEditor} className="text-slate-300 hover:bg-white/10 hover:text-white">
              Cancel
            </Button>
            <Button type="button" disabled={processing} onClick={() => void applyCrop()} className="bg-blue-600 px-6 text-white hover:bg-blue-500">
              {processing ? "Applying..." : "Apply photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
