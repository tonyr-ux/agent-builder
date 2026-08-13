'use client';

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Sparkles, X, ChevronRight, ChevronDown, Check, AlertTriangle, ExternalLink } from 'lucide-react';

interface SubstitutionSuggestionPopoverProps {
  invoiceDescription: string;
  poDescription: string;
  fromLabel?: string;
  toLabel?: string;
  invoiceLine?: {
    qty: number;
    unit_price: number;
    line_total: number;
  };
  poLine?: {
    qty_ordered: number;
    unit_price: number;
  };
  confidence: number; // 0-1 (e.g., 0.78 = 78%)
  reason: string;
  differences: Array<{
    field: string;
    invoice_value: string;
    po_value: string;
  }>;
  title?: string;
  agentLink?: string;
  agentLinkLabel?: string;
  matchNote?: string;
  onAccept: () => void;
  onReject: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collisionBoundary?: Element | null;
}

export function SubstitutionSuggestionPopover({
  invoiceDescription,
  poDescription,
  fromLabel = 'Invoice Description',
  toLabel = 'Purchase Order Description',
  invoiceLine,
  poLine,
  confidence,
  reason,
  differences,
  title = 'Smart Match (Substitution)',
  agentLink = '/settings-old?agent=Substitution%20Agent#automation-agent-builder-2',
  agentLinkLabel = 'View Smart Match (Substitution) in Agent Builder →',
  matchNote,
  onAccept,
  onReject,
  onClose,
  children,
  open,
  onOpenChange,
  collisionBoundary,
}: SubstitutionSuggestionPopoverProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const effectiveOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (val: boolean) => {
    if (!isControlled) setInternalOpen(val);
    onOpenChange?.(val);
  };

  const confidencePercent = Math.round(confidence * 100);

  const handleAccept = () => {
    onAccept();
    handleOpenChange(false);
  };

  const handleReject = () => {
    onReject();
    handleOpenChange(false);
  };

  const handleClose = () => {
    onClose?.();
    handleOpenChange(false);
  };

  // Helper to bold highlight differences in description text
  const highlightDifferences = (text: string, value: string) => {
    if (!value) return text;

    const regex = new RegExp(`(${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) =>
          regex.test(part) ? <strong key={index}>{part}</strong> : part
        )}
      </>
    );
  };

  return (
    <Popover.Root open={effectiveOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[450px] max-h-[600px] flex flex-col rounded-lg border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white shadow-lg"
          side="right"
          sideOffset={10}
          align="start"
          collisionPadding={20}
          collisionBoundary={collisionBoundary || (typeof window !== 'undefined' ? document.body : undefined)}
        >
          <div className="flex-1 overflow-y-auto p-4">
            {/* Header - matches AISuggestionCard */}
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-purple-600 animate-pulse" />
              <span className="text-sm font-semibold text-purple-900">{title}</span>
              <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${confidencePercent >= 90 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {confidencePercent}% confidence
              </span>
              <button
                onClick={handleClose}
                className="ml-1 p-0.5 rounded hover:bg-purple-100 transition-colors"
                title="Close"
              >
                <X className="h-3.5 w-3.5 text-gray-600" />
              </button>
            </div>

            {/* Two-Column Comparison */}
            <div className="space-y-2 mb-3">
              <div>
                <div className="text-xs font-medium text-gray-800 mb-0.5">{fromLabel}</div>
                <div className="text-xs text-gray-950 bg-white px-2 py-1.5 rounded border border-gray-200">
                  {differences.length > 0
                    ? highlightDifferences(invoiceDescription, differences[0].invoice_value)
                    : invoiceDescription
                  }
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-800 mb-0.5">{toLabel}</div>
                <div className="text-xs text-gray-950 bg-white px-2 py-1.5 rounded border border-gray-200">
                  {differences.length > 0
                    ? highlightDifferences(poDescription, differences[0].po_value)
                    : poDescription
                  }
                </div>
              </div>
            </div>

            {/* Match Details (Collapsible) */}
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
                  {invoiceLine && poLine && (
                    <>
                      <div className="flex items-center gap-1.5 text-xs text-gray-800">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Quantity matches: {invoiceLine.qty} = {poLine.qty_ordered}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-800">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Unit price matches: ${invoiceLine.unit_price.toFixed(2)} = ${poLine.unit_price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-800">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Total matches: ${invoiceLine.line_total.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {differences.map((diff, index) => (
                    <div key={index} className="flex items-center gap-1.5 text-xs text-gray-800">
                      <AlertTriangle className="h-3 w-3 text-orange-600" />
                      <span>{diff.field} differs: {diff.invoice_value} vs {diff.po_value}</span>
                    </div>
                  ))}
                  {matchNote && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-800">
                      <AlertTriangle className="h-3 w-3 text-orange-600 shrink-0" />
                      <span>{matchNote}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons - matches AISuggestionCard - Fixed at bottom */}
          <div className="flex gap-2 p-4 pt-3 border-t border-purple-200">
            <button
              onClick={handleReject}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-purple-900 border border-purple-900 rounded-md hover:bg-purple-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
              Unmatch
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-purple-900 text-white rounded-md hover:bg-purple-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <Check className="h-4 w-4" />
              Accept
            </button>
          </div>

          {/* Agent link */}
          <div className="px-4 pb-3 pt-0 border-t-0">
            <a
              href={agentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-purple-700 hover:text-purple-900 transition-colors"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              {agentLinkLabel}
            </a>
          </div>

          <Popover.Arrow className="fill-purple-300" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
