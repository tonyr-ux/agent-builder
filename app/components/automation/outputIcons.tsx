"use client"

import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  Calculator,
  Copy,
  FilePlus2,
  FileSearch,
  FileText,
  Flag,
  Handshake,
  Layers,
  MessageSquareText,
  PieChart,
  ReceiptText,
  Send,
  Share2,
  Sigma,
  Split,
  Tags,
  Ticket,
  UserCheck,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react"
import type { XelixCapabilityGroup, XelixOutputType } from "../agentbuilder/xelixConfig"

/** One mark per supported output, used on identity tiles and list rows. */
export const OUTPUT_ICONS: Record<XelixOutputType, LucideIcon> = {
  "send-emails": Send,
  "assign-users": UserPlus,
  "assign-approvers": UserCheck,
  "raise-invoices-as-exceptions": AlertTriangle,
  "perform-workflow-actions": Workflow,
  "custom-field-extraction": FilePlus2,
  "custom-extraction-instructions": FileSearch,
  "custom-classification": Tags,
  "derive-value": Calculator,
  "derive-custom-field-value": Sigma,
  "split-or-merge-line-items": Split,
  "helpdesk-trigger": Ticket,
  "generated-reply-instructions": MessageSquareText,
  "statement-trigger": FileText,
  "statement-share-queue": Share2,
  "transaction-classification": Copy,
  "vendor-group": Users,
  "vendor-flagging-rule": Flag,
  "report-chart": PieChart,
}

/** Mark for the capability-group pill. */
export const GROUP_ICONS: Record<XelixCapabilityGroup, LucideIcon> = {
  "External connection": Send,
  "Processing action": AlertTriangle,
  "Custom extraction": ReceiptText,
  "Data modification": Layers,
  Helpdesk: Ticket,
  Statements: FileText,
  Transactions: Copy,
  Vendors: Handshake,
  Reporting: PieChart,
}
