/**
 * SVG futbol sahası: biçilmiş çim şeritleri, saha çizgileri, kenarlara doğru
 * kararan vinyet ve üzerinde yavaşça gezinen tek bir floodlight katmanı.
 */
export default function PitchBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl ring-1 ring-mid/50">
      <svg
        className="h-full w-full"
        viewBox="0 0 68 105"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14402a" />
            <stop offset="55%" stopColor="#0e3220" />
            <stop offset="100%" stopColor="#092416" />
          </linearGradient>
          <pattern id="stripes" width="68" height="15" patternUnits="userSpaceOnUse">
            <rect width="68" height="7.5" fill="rgba(107,255,160,0.05)" />
          </pattern>
          <radialGradient id="vignette" cx="50%" cy="46%" r="72%">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="70%" stopColor="rgba(0,0,0,0.05)" />
            <stop offset="100%" stopColor="rgba(2,10,6,0.55)" />
          </radialGradient>
        </defs>

        <rect width="68" height="105" fill="url(#grass)" />
        <rect width="68" height="105" fill="url(#stripes)" />

        {/* Saha çizgileri */}
        <g fill="none" stroke="rgba(199,240,214,0.38)" strokeWidth="0.35">
          <rect x="2" y="2" width="64" height="101" rx="0.5" />
          <line x1="2" y1="52.5" x2="66" y2="52.5" />
          <circle cx="34" cy="52.5" r="9.15" />
          <rect x="13.84" y="2" width="40.32" height="16.5" />
          <rect x="24.84" y="2" width="18.32" height="5.5" />
          <path d="M 26.7 18.5 A 9.15 9.15 0 0 0 41.3 18.5" />
          <rect x="13.84" y="86.5" width="40.32" height="16.5" />
          <rect x="24.84" y="97.5" width="18.32" height="5.5" />
          <path d="M 26.7 86.5 A 9.15 9.15 0 0 1 41.3 86.5" />
          <path d="M 2 4 A 2 2 0 0 0 4 2" />
          <path d="M 64 2 A 2 2 0 0 0 66 4" />
          <path d="M 4 103 A 2 2 0 0 0 2 101" />
          <path d="M 66 101 A 2 2 0 0 0 64 103" />
        </g>
        <g fill="rgba(199,240,214,0.45)">
          <circle cx="34" cy="52.5" r="0.6" />
          <circle cx="34" cy="13" r="0.5" />
          <circle cx="34" cy="92" r="0.5" />
        </g>

        {/* Vinyet: derinlik hissi */}
        <rect width="68" height="105" fill="url(#vignette)" />
      </svg>

      {/* Tek floodlight katmanı — ambiyans, abartısız */}
      <div
        className="floodlight -top-24 left-1/4 h-[26rem] w-[26rem]"
        style={{
          background: "radial-gradient(circle, rgba(107,255,160,0.10) 0%, transparent 62%)",
        }}
      />
    </div>
  );
}
