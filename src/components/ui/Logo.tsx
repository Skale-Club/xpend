interface XpendLogoProps {
  className?: string;
}

export function XpendLogo({ className }: XpendLogoProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Xpend"
    >
      <g clipPath="url(#xpend_clip)">
        <path
          d="M404.942 0H107.058C47.9317 0 0 47.9317 0 107.058V404.942C0 464.068 47.9317 512 107.058 512H404.942C464.068 512 512 464.068 512 404.942V107.058C512 47.9317 464.068 0 404.942 0Z"
          fill="url(#xpend_gradient)"
        />
        <path
          d="M132.338 256.001L45.0332 343.306L126.061 424.334L213.366 337.028L132.338 256.001Z"
          fill="#6C852E"
        />
        <path
          d="M126.047 87.6735L213.352 174.979C258.071 219.698 258.071 292.316 213.352 337.034L45.0193 168.701L126.047 87.6735Z"
          fill="#BDC91C"
        />
        <path
          d="M379.662 255.997L466.967 168.692L385.939 87.6643L298.634 174.97L379.662 255.997Z"
          fill="#6C8626"
        />
        <path
          d="M385.942 424.318L298.637 337.013C253.918 292.294 253.918 219.677 298.637 174.958L466.959 343.28L385.931 424.308L385.942 424.318Z"
          fill="#BEC91F"
        />
      </g>
      <defs>
        <linearGradient
          id="xpend_gradient"
          x1="41.2953"
          y1="508.829"
          x2="450.413"
          y2="27.0817"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#30568C" />
          <stop offset="1" stopColor="#2979B4" />
        </linearGradient>
        <clipPath id="xpend_clip">
          <rect width="512" height="512" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
