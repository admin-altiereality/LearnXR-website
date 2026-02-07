"use client";

import React, { useState, useEffect } from "react";

export interface PrismFluxLoaderProps {
  size?: number;
  speed?: number;
  textSize?: number;
  statuses?: string[];
}

const DEFAULT_STATUSES = ["Fetching", "Loading", "Syncing", "Processing", "Updating", "Placing"];

export const PrismFluxLoader: React.FC<PrismFluxLoaderProps> = ({
  size = 36,
  speed = 5,
  textSize = 14,
  statuses = DEFAULT_STATUSES,
}) => {
  const [time, setTime] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => prev + 0.02 * speed);
    }, 16);
    return () => clearInterval(interval);
  }, [speed]);

  useEffect(() => {
    const statusInterval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 600);
    return () => clearInterval(statusInterval);
  }, [statuses.length]);

  const half = size / 2;
  const currentStatus = statuses[statusIndex];
  const faceTransforms = [
    `rotateY(0deg) translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ];
  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[200px]">
      <div
        className="relative"
        style={{
          width: size,
          height: size,
          transformStyle: "preserve-3d",
          transform: `rotateY(${time * 30}deg) rotateX(${time * 30}deg)`,
        }}
      >
        {faceTransforms.map((transform, i) => (
          <div
            key={i}
            className="absolute flex items-center justify-center font-semibold text-foreground border border-border bg-card"
            style={{
              width: size,
              height: size,
              transform,
              backfaceVisibility: "hidden",
              fontSize: textSize,
            }}
          >
            XR
          </div>
        ))}
      </div>
      <p className="text-sm font-medium text-muted-foreground tracking-wide">
        {currentStatus}...
      </p>
    </div>
  );
};
