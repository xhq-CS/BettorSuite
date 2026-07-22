import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AvatarUploaderProps {
  username: string;
  value: string | null;
  onChange: (value: string) => void;
}

async function prepareAvatar(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Choose an image under 8 MB.");
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - side) / 2;
    const sourceY = (image.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare this image.");
    context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 512, 512);
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function AvatarUploader({ username, value, onChange }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  return (
    <div className="flex w-28 flex-col items-center gap-2">
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
          aria-label="Upload profile image"
          className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70"
        >
          <Camera className="h-4 w-4" />
        </button>
        {value && (
          <button
            type="button"
            aria-label="Remove profile image"
            onClick={() => onChange("")}
            className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-white text-red-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
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
            onChange(await prepareAvatar(file));
          } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Unable to use this image.");
          } finally {
            setProcessing(false);
          }
        }}
      />
      {processing && <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Preparing photo…</span>}
      {error && <p role="alert" className="max-w-52 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
