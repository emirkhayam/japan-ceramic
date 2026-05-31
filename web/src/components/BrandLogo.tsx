import type { CSSProperties } from "react";

// Геометрический знак-монограмма «JC» (японский меандр) из брендбука.
// Соотношение сторон 142×75. Цвет берётся из CSS `color`, поэтому
// перекрашивается через проп markColor или наследуется родителем.
const MARK_PATHS = [
  "matrix(1,0,0,-1,4.793396,69.49609)|M0 0H64.599V64.599H33.852V59.72H59.72V4.879H4.879V30.746H0ZM67.705-3.106H-3.106V33.853H7.985V7.985H56.614V56.614H30.746V67.705H67.705Z",
  "matrix(1,0,0,-1,20.763794,53.525606)|M0 0H32.658V32.658H17.882V27.779H27.779V4.879H4.879V14.776H0ZM35.764-3.106H-3.106V17.882H7.985V7.985H24.673V24.673H14.776V35.764H35.764Z",
  "matrix(1,0,0,-1,-350,376.276)|M354.793 350.53H375.642V371.379H354.793ZM378.749 347.424H351.68699V374.48603H378.749Z",
  "matrix(1,0,0,-1,137.0976,4.8963015)|M0 0H-64.599V-64.599H-33.852V-59.72H-59.72V-4.879H-4.879V-30.746H0ZM-67.705 3.106H3.106V-33.853H-7.985V-7.985H-56.614V-56.614H-30.746V-67.705H-67.705Z",
  "matrix(1,0,0,-1,121.127109,20.86679)|M0 0H-32.658V-32.658H-17.882V-27.779H-27.779V-4.879H-4.879V-14.776H0ZM-35.764 3.106H3.106V-17.882H-7.985V-7.985H-24.673V-24.673H-14.776V-35.764H-35.764Z",
  "matrix(1,0,0,-1,-350,376.276)|M487.098 327.629H466.249V306.78H487.098ZM463.142 330.735H490.204V303.67298H463.142Z",
];

export function LogoMark({
  height = 26,
  color = "var(--brand-gold)",
  className,
  style,
}: {
  height?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const width = (height * 142) / 75;
  return (
    <svg
      viewBox="0 0 142 75"
      width={width}
      height={height}
      className={className}
      style={{ color, flex: "none", ...style }}
      role="img"
      aria-label="Japan Ceramic"
    >
      {MARK_PATHS.map((p, i) => {
        const [transform, d] = p.split("|");
        return <path key={i} transform={transform} d={d} fill="currentColor" />;
      })}
    </svg>
  );
}

export default function BrandLogo({
  height = 26,
  markColor = "var(--brand-gold)",
  wordmark = true,
  wordSize,
  wordColor = "currentColor",
  gap = 12,
  className,
  style,
}: {
  height?: number;
  markColor?: string;
  wordmark?: boolean;
  wordSize?: number;
  wordColor?: string;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap, ...style }}
    >
      <LogoMark height={height} color={markColor} />
      {wordmark && (
        <span
          style={{
            fontFamily: "var(--font-krona)",
            fontSize: wordSize ?? Math.round(height * 0.58),
            letterSpacing: ".12em",
            lineHeight: 1,
            color: wordColor,
            whiteSpace: "nowrap",
          }}
        >
          JAPAN CERAMIC
        </span>
      )}
    </span>
  );
}
