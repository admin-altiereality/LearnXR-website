import React from 'react';
import { learnXRFontStyle, TrademarkSymbol } from './LearnXRTypography';

export default function Logo() {
  return (
    <div className="flex items-center">
      <span className="text-2xl tracking-[0.1rem]" style={learnXRFontStyle}>
        <span className="text-foreground">Learn</span>
        <span className="text-primary">XR</span>
        <TrademarkSymbol />
      </span>
    </div>
  );
}
