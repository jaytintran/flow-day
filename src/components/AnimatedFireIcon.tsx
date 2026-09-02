/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AnimatedFireIconProps {
  className?: string;
  size?: number;
}

export default function AnimatedFireIcon({ className = '', size = 14 }: AnimatedFireIconProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 120"
        width={size}
        height={size}
        className="overflow-visible animate-flame-anime"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Layer 1: Outer Orange Flame Body (Warm Orange-Red #f95721) */}
        <path
          d="M50 8C48 20 44 28 35 38C26 48 20 58 20 72C20 88 33 108 50 108C67 108 80 88 80 72C80 58 74 48 65 38C56 28 52 20 50 8Z"
          fill="#f95721"
        />
        {/* Outer side flame wings */}
        <path
          d="M50 12C47 24 43 32 32 40C24 46 16 58 18 72C15 62 18 50 26 42C33 35 36 28 38 20C40 25 43 28 47 28C48 22 49 16 50 12Z"
          fill="#f95721"
        />
        <path
          d="M50 12C53 24 57 32 68 40C76 46 84 58 82 72C85 62 82 50 74 42C67 35 64 28 62 20C60 25 57 28 53 28C52 22 51 16 50 12Z"
          fill="#f95721"
        />

        {/* Layer 2: Mid-Tone Golden Orange Inner Flame (#ff941a) */}
        <path
          d="M50 32C46 42 40 50 34 60C30 67 28 75 30 84C32 94 40 102 50 102C60 102 68 94 70 84C72 75 70 67 66 60C60 50 54 42 50 32Z"
          fill="#ff941a"
        />
        <path
          d="M50 35C48 44 42 50 36 58C32 63 32 72 35 78C33 72 35 64 40 58C45 52 47 46 48 40C49 44 51 46 54 46C53 41 52 37 50 35Z"
          fill="#ff941a"
        />

        {/* Layer 3: Inner Golden Yellow Core (#ffcc00) */}
        <path
          d="M50 54C47 62 42 70 40 78C38 84 41 96 50 96C59 96 62 84 60 78C58 70 53 62 50 54Z"
          fill="#ffcc00"
          className="animate-flame-core origin-bottom"
        />
      </svg>
    </div>
  );
}
