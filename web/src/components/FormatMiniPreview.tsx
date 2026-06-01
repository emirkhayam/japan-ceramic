// Квадратное мини-превью формата плитки — просто приближённая картинка плитки.
export default function FormatMiniPreview({
  src,
  size = 56,
  className = "",
  title,
}: {
  src: string;
  dimensions?: string | null; // оставлено для совместимости с местом вызова
  size?: number;
  className?: string;
  title?: string;
}) {
  const box = "overflow-hidden rounded-[4px] border border-white/40 shadow-[0_5px_18px_rgba(0,0,0,.7)] bg-[var(--bg-2)]";
  return (
    <div className={`${className} ${box}`} style={{ width: size, height: size }} title={title}>
      <img src={src} alt="" loading="lazy" className="w-full h-full object-cover scale-[3.5]" />
    </div>
  );
}
