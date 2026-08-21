'use client';

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Zap, X, RotateCcw } from 'lucide-react';

interface FieldNormalizationPopoverProps {
  fieldName: string;
  originalValue: string;
  normalizedValue: string;
  agentName: string;
  confidence?: number;
  explanation: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUndo?: () => void;
}

export function FieldNormalizationPopover({
  fieldName,
  originalValue,
  normalizedValue,
  agentName,
  confidence = 95,
  explanation,
  children,
  open: controlledOpen,
  onOpenChange,
  onUndo,
}: FieldNormalizationPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (val: boolean) => {
    if (!isControlled) setInternalOpen(val);
    onOpenChange?.(val);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[380px] rounded-lg border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white shadow-lg p-4"
          sideOffset={5}
          align="start"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-purple-600" fill="currentColor" />
            <span className="text-sm font-semibold text-purple-900">{agentName}</span>
            <button
              onClick={() => handleOpenChange(false)}
              className="ml-auto p-0.5 rounded hover:bg-purple-100 transition-colors"
              title="Close"
            >
              <X className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </div>

          {/* Value Comparison */}
          <div className="space-y-2 mb-3">
            <div>
              <div className="text-xs font-medium text-gray-800 mb-0.5">Original Value (from document)</div>
              <div className="text-xs text-gray-950 bg-white px-2 py-1.5 rounded border border-gray-200">
                {originalValue}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-800 mb-0.5">Normalized Value</div>
              <div className="text-xs text-gray-950 bg-white px-2 py-1.5 rounded border border-gray-200 font-semibold">
                {normalizedValue}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-purple-200 flex flex-col gap-2">
            {onUndo && (
              <button
                onClick={() => { onUndo(); handleOpenChange(false); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-purple-900 border border-purple-900 rounded-md hover:bg-purple-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                <RotateCcw className="h-4 w-4" />
                Revert to original value
              </button>
            )}
            <a
              href={`/settings-old?agent=${encodeURIComponent(agentName)}#automation-agent-builder-2`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-1"
            >
              View agent in Agent Builder →
            </a>
          </div>

          <Popover.Arrow className="fill-purple-300" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
