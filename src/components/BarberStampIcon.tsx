import React from 'react';

interface BarberStampIconProps {
  className?: string;
  size?: number | string;
  isNew?: boolean;
  color?: string;
  glow?: boolean;
}

export const BarberStampIcon: React.FC<BarberStampIconProps> = ({
  className = '',
  size = 64,
  isNew = false,
  color = '#b6ff2e',
  glow = true,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${
        isNew ? 'animate-stamp-impact' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer Acid Glow Effect */}
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-md opacity-50 pointer-events-none transition-opacity duration-300"
          style={{ backgroundColor: color }}
        />
      )}

      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md relative z-10"
      >
        <defs>
          <linearGradient id="nvAcidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d8ff66" />
            <stop offset="60%" stopColor="#b6ff2e" />
            <stop offset="100%" stopColor="#6fb300" />
          </linearGradient>

          {/* Paths for circular curved text */}
          <path
            id="nvTextTop"
            d="M 30 100 A 70 70 0 0 1 170 100"
            fill="none"
          />
          <path
            id="nvTextBottom"
            d="M 170 100 A 70 70 0 0 1 30 100"
            fill="none"
          />
        </defs>

        {/* Outer Brutalist Industrial Notched Ring */}
        <circle
          cx="100"
          cy="100"
          r="94"
          stroke="url(#nvAcidGrad)"
          strokeWidth="3"
          strokeDasharray="4 3"
          opacity="0.9"
        />

        {/* Inner Solid Rings */}
        <circle
          cx="100"
          cy="100"
          r="86"
          stroke="url(#nvAcidGrad)"
          strokeWidth="2.5"
        />
        <circle
          cx="100"
          cy="100"
          r="73"
          stroke="url(#nvAcidGrad)"
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.6"
        />

        {/* Curved Circular Text in NV Style */}
        <text
          fill="url(#nvAcidGrad)"
          fontSize="11"
          fontWeight="900"
          letterSpacing="3.5"
          fontFamily="Unbounded, sans-serif"
        >
          <textPath href="#nvTextTop" startOffset="50%" textAnchor="middle">
            ★ NV BARBERS ★
          </textPath>
        </text>

        <text
          fill="url(#nvAcidGrad)"
          fontSize="9.5"
          fontWeight="800"
          letterSpacing="3"
          fontFamily="JetBrains Mono, monospace"
        >
          <textPath href="#nvTextBottom" startOffset="50%" textAnchor="middle">
            • НЕ ПРОСТО ФЕЙД •
          </textPath>
        </text>

        {/* Inner Circle Border */}
        <circle
          cx="100"
          cy="100"
          r="58"
          stroke="url(#nvAcidGrad)"
          strokeWidth="2"
        />

        {/* Central Stylized Razor-Sharp Fade Male Head */}
        <g transform="translate(100, 100) scale(0.68) translate(-100, -100)">
          {/* Hair: Slick modern textured fade pompadour */}
          <path
            d="M 72 88 
               C 68 76, 70 60, 80 50 
               C 92 38, 114 36, 130 44 
               C 142 50, 146 62, 143 72 
               C 139 74, 136 78, 135 84 
               C 134 88, 130 90, 126 90 
               C 120 90, 115 88, 110 89 
               C 105 90, 100 88, 95 86
               C 85 83, 76 84, 72 88 Z"
            fill="url(#nvAcidGrad)"
          />

          {/* Hair Texture Lines */}
          <path
            d="M 85 58 Q 102 46 122 52 M 88 68 Q 108 58 132 64 M 94 76 Q 112 70 128 75"
            stroke="#0b0b0b"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Skin Fade Hairline Transition */}
          <path
            d="M 73 89 C 74 95, 77 101, 80 106"
            stroke="url(#nvAcidGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 70 94 C 71 98, 73 103, 75 107"
            stroke="url(#nvAcidGrad)"
            strokeWidth="2"
            strokeDasharray="1 2.5"
          />

          {/* Face Profile Contour */}
          <path
            d="M 126 90 
               C 128 94, 131 99, 134 104 
               C 136 107, 141 110, 143 113
               C 145 116, 140 119, 137 120
               C 133 121, 134 125, 137 127
               C 139 129, 137 132, 134 133
               C 130 134, 128 138, 126 142
               C 122 147, 115 152, 107 154"
            stroke="url(#nvAcidGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Groomed Beard and Sharp Mustache */}
          <path
            d="M 134 122 C 127 123, 123 125, 120 127 C 124 130, 131 130, 136 127 Z"
            fill="url(#nvAcidGrad)"
          />
          <path
            d="M 126 136 
               C 125 142, 120 148, 114 152 
               C 106 156, 96 156, 90 152 
               C 85 148, 83 140, 83 133
               C 83 124, 85 116, 88 110
               C 92 116, 96 124, 102 128
               C 109 133, 118 134, 126 136 Z"
            fill="url(#nvAcidGrad)"
          />

          {/* Razor Cheek Line */}
          <path
            d="M 88 111 C 97 116, 108 120, 122 126"
            stroke="#0b0b0b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Ear Contour */}
          <path
            d="M 80 106 C 75 106, 73 112, 74 118 C 75 124, 79 126, 82 125"
            stroke="url(#nvAcidGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Neck Taper Fade */}
          <path
            d="M 78 126 C 79 135, 81 146, 83 154 M 92 153 C 94 158, 97 163, 100 166"
            stroke="url(#nvAcidGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />

          {/* Eye & Brow */}
          <path
            d="M 121 103 Q 128 100 134 105"
            stroke="url(#nvAcidGrad)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 125 109 Q 129 110 132 108"
            stroke="url(#nvAcidGrad)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Signature NV Shears Cut at base */}
          <g transform="translate(68, 150) scale(0.65)">
            <path
              d="M 10 28 L 50 4 M 18 32 C 14 34, 8 32, 8 26 C 8 20, 14 18, 20 22"
              stroke="url(#nvAcidGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 50 28 L 10 4 M 42 32 C 46 34, 52 32, 52 26 C 52 20, 46 18, 40 22"
              stroke="url(#nvAcidGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* Small NV Brand Stars */}
        <polygon
          points="22,100 24,95 26,100 30,101 27,103 28,107 24,105 20,107 21,103 18,101"
          fill="url(#nvAcidGrad)"
        />
        <polygon
          points="178,100 176,95 174,100 170,101 173,103 172,107 176,105 180,107 179,103 182,101"
          fill="url(#nvAcidGrad)"
        />
      </svg>
    </div>
  );
};

export default BarberStampIcon;
