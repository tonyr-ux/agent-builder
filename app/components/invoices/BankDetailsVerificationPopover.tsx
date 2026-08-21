'use client';

import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Shield, X, Mail, AlertTriangle, Bot } from 'lucide-react';
import { AnimatedPopover } from '../ui/AnimatedPopover';
import Link from 'next/link';

interface BankDetails {
  bank_name?: string;
  account_name?: string;
  iban?: string;
  swift_bic?: string;
  sort_code?: string;
  account_number?: string;
  routing_number?: string;
}

interface BankDetailsVerificationPopoverProps {
  invoiceNumber: string;
  vendorName: string;
  invoiceAmount: number;
  currency: string;
  dueDate: string;
  oldBankDetails: BankDetails;
  newBankDetails: BankDetails;
  requisitionerName?: string;
  requisitionerEmail?: string;
  poNumber?: string;
  onClose?: () => void;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  fieldName?: string;
  onFieldFocus?: (fieldName: string | null) => void;
}

export function BankDetailsVerificationPopover({
  invoiceNumber,
  vendorName,
  invoiceAmount,
  currency,
  dueDate,
  oldBankDetails,
  newBankDetails,
  requisitionerName = 'Requisitioner',
  requisitionerEmail = 'requisitioner@company.com',
  poNumber,
  onClose,
  children,
  open,
  onOpenChange,
  fieldName,
  onFieldFocus,
}: BankDetailsVerificationPopoverProps) {

  // Format IBAN with spaces every 4 characters
  const formatIBAN = (iban: string) => {
    if (!iban) return '';
    return iban.replace(/(.{4})/g, '$1 ').trim();
  };

  // Check if a field has changed
  const hasChanged = (oldVal: string | undefined, newVal: string | undefined) => {
    if (!oldVal || !newVal) return false;
    return oldVal !== newVal;
  };

  const formatCurrency = (amount: number, curr: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
    if (onFieldFocus && fieldName) {
      onFieldFocus(null);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange?.(isOpen);
    if (onFieldFocus && fieldName) {
      onFieldFocus(isOpen ? fieldName : null);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50"
          side="right"
          sideOffset={5}
          align="start"
        >
          <AnimatedPopover className="w-[390px] rounded-lg border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white shadow-lg">
            <div className="max-h-[500px] overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-50">
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-900">Bank details checker</span>
                <button
                  onClick={handleClose}
                  className="ml-auto p-0.5 rounded hover:bg-purple-100 transition-colors"
                  title="Close"
                >
                  <X className="h-3.5 w-3.5 text-gray-600" />
                </button>
              </div>

              {/* No-match message */}
              <div className="mb-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-950">
                  The bank details on this invoice do not match any bank account details we have on file for <span className="font-semibold">{vendorName}</span>. Please verify before approving payment.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => {
                    // Placeholder - no action for now
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-purple-900 text-white rounded-md hover:bg-purple-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  <Mail className="h-4 w-4" />
                  Draft Verification Email
                </button>
                
                <Link
                  href="/settings-old?agent=Bank%20details%20checker#automation-agent-builder-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-purple-900 border border-purple-900 rounded-md hover:bg-purple-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  onClick={handleClose}
                >
                  <Bot className="h-4 w-4" />
                  View agent
                </Link>
              </div>
            </div>
          </AnimatedPopover>

          <Popover.Arrow className="fill-purple-300" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
