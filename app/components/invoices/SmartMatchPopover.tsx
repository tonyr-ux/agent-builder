'use client';

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Zap, X, ChevronRight, ChevronDown, Check, AlertTriangle, ExternalLink } from 'lucide-react';

interface SmartMatchPopoverProps {
  invoiceDescription: string;
  poDescription: string;
  invoiceLine?: {
    qty: number;
    unit_price: number;
    line_total?: number;
  };
  poLine?: {
    qty_ordered: number;
    unit_price: number;
  };
  confidence?: number; // Confidence score (0-1, will be displayed as percentage)
  agentName?: string;
  onUnmatch: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SmartMatchPopover({
  invoiceDescription,
  poDescription,
  invoiceLine,
  poLine,
  confidence,
  agentName = 'Smart Match (Semantic)',
  onUnmatch,
  onClose,
  children,
  open,
  onOpenChange,
}: SmartMatchPopoverProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const handleUnmatch = () => {
    onUnmatch();
    onOpenChange?.(false);
  };

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
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
            {confidence !== undefined && (
              <span className="ml-auto mr-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
            <button
              onClick={handleClose}
              className={`${confidence !== undefined ? '' : 'ml-auto'} p-0.5 rounded hover:bg-purple-100 transition-colors`}
              title="Close"
            >
              <X className="h-3.5 w-3.5 text-gray-600" />
            </button>
          </div>

          {/* Descriptions */}
          <div className="space-y-2 mb-3">
            <div>
              <div className="text-xs font-medium text-gray-800 mb-0.5">Invoice Description</div>
              <div className="text-xs text-gray-950 bg-white px-2 py-1.5 rounded border border-gray-200">
                {invoiceDescription}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-800 mb-0.5">Purchase Order Description</div>
              <div className="text-xs text-gray-950 bg-white px-2 py-1.5 rounded border border-gray-200">
                {poDescription}
              </div>
            </div>
          </div>

          {/* Match Details (Collapsible) */}
          {invoiceLine && poLine && (
            <div className="mb-3">
              <button
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-700 hover:text-purple-900 transition-colors"
              >
                {isDetailsExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                View Match Details
              </button>

              {isDetailsExpanded && (
                <div className="mt-2 space-y-1 pl-5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-800">
                    <Check className="h-3 w-3 text-green-600" />
                    <span>Quantity matches: {invoiceLine.qty} = {poLine.qty_ordered}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-800">
                    <Check className="h-3 w-3 text-green-600" />
                    <span>Unit price matches: £{invoiceLine.unit_price.toFixed(2)} = £{poLine.unit_price.toFixed(2)}</span>
                  </div>
                  {invoiceLine.line_total && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-800">
                      <Check className="h-3 w-3 text-green-600" />
                      <span>Total matches: £{invoiceLine.line_total.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-gray-800">
                    <AlertTriangle className="h-3 w-3 text-orange-600" />
                    <span>Descriptions differ</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleUnmatch}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium border border-purple-900 bg-white text-purple-900 rounded-md hover:bg-purple-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Unmatch
          </button>

          {/* Agent link */}
          <div className="mt-2.5 pt-2.5 border-t border-purple-200">
            <a
              href="/settings-old?agent=Semantic%20Match%20Agent#automation-agent-builder-2"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-purple-700 hover:text-purple-900 transition-colors"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              View Smart Match (Semantic) in Agent Builder →
            </a>
          </div>

          <Popover.Arrow className="fill-purple-300" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
