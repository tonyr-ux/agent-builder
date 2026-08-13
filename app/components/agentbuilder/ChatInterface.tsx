"use client"

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Button } from "@/app/components/ui/button"
import { Send, Bot, User, CheckCircle2, Paperclip, X, FileText, Loader2, AlertCircle } from "lucide-react"
import { Card } from "@/app/components/ui/card"
import { Textarea } from "@/app/components/ui/textarea"
import type { Agent, AgentDocument } from "./AgentBuilderPage"
import { extractTextFromFile, formatFileSize } from "@/app/utils/documentExtractor"
import { storeDocument } from "@/app/utils/documentStorage"
import {
  type XelixConfig,
  configAgentMode,
  configFields,
  configModeLabel,
  configStage,
  extractConfigBlock,
  outputTypeLabel,
  serialiseConfig,
  stripConfigBlock,
} from "./xelixConfig"

type Attachment = {
  id: string
  name: string
  size: number
  type: string
  file: File
  extractedText?: string
  extractionError?: string
  isExtracting?: boolean
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  generatedPrompt?: string
  /** Parsed Xelix configuration block, when the reply contained one */
  config?: XelixConfig
  /** The reply text with the configuration block removed */
  proseContent?: string
  suggestedSkills?: string[]
  attachments?: Attachment[]
  isSettingsRecommendation?: boolean
  settingsLink?: string
  showTestButton?: boolean
  applied?: boolean
}

interface ChatInterfaceProps {
  onPromptGenerated?: (prompt: string, skills: string[], documents?: AgentDocument[]) => void
  onStageDetected?: (stage: string) => void
  onLaneDetected?: (lane: string) => void
  onModeDetected?: (mode: "observe" | "suggest" | "auto-apply") => void
  currentPrompt?: string
  agentId?: string
  currentAgent?: Agent | null
  onOpenTest?: () => void
  initialScriptedFlow?: 'unitConversion'
}

export interface ChatInterfaceRef {
  clearChat: () => void
  enterUnitConversionScripted: () => void
}

const AVAILABLE_SKILLS = [
  "Extract text",
  "Process Documents",
  "Verify Data",
  "Find Purchase Orders",
  "Intelligent Matching",
  "Flag Issues",
  "Connect to ERP System",
  "Run Workflows",
  "Route for Approval",
  "Send Messages",
  "Map to General Ledger",
  "Find Vendor Information",
  "Triage Tickets",
  "Manage Helpdesk",
  "Create Purchase Orders",
  "Process Payments",
  "Check Compliance",
]

const GREETING =
  "Hi! Tell me what you'd like your agent to do, and I'll help you shape it."

export const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>(({ onPromptGenerated, onStageDetected, onLaneDetected, onModeDetected, currentPrompt, agentId, currentAgent, onOpenTest, initialScriptedFlow }, ref) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: GREETING,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [sessionDocuments, setSessionDocuments] = useState<Attachment[]>([])
  const [scriptedMode, setScriptedMode] = useState(false)
  const [scriptStep, setScriptStep] = useState(0)
  const [scriptData, setScriptData] = useState<{ mailbox?: string; suggestFormats?: boolean; signature?: string }>({})
  const [scriptedFlow, setScriptedFlow] = useState<'rejectWord' | 'unitConversion'>('rejectWord')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const skipNextAgentClear = useRef(false)

  const clearChat = () => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content: GREETING,
        timestamp: new Date(),
      },
    ])
    setInput("")
    setQuestionCount(0)
    setSessionDocuments([])
    setScriptedMode(false)
    setScriptStep(0)
    setScriptData({})
    setScriptedFlow('rejectWord')
  }

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    clearChat,
    enterUnitConversionScripted: () => {
      clearChat()
      setScriptedFlow('unitConversion')
      setScriptedMode(true)
      setScriptStep(1)
      setTimeout(() => {
        setMessages([
          {
            id: "1",
            role: "assistant",
            content: GREETING,
            timestamp: new Date(),
          },
        ])
        setTimeout(() => inputRef.current?.focus(), 100)
      }, 0)
    },
  }))

  useEffect(() => {
    if (skipNextAgentClear.current) {
      skipNextAgentClear.current = false
      return
    }
    console.log("[v0] Agent changed, clearing chat. Agent ID:", agentId)
    clearChat()
  }, [agentId])

  // Auto-start scripted flow on mount when requested by parent
  useEffect(() => {
    if (initialScriptedFlow === 'unitConversion') {
      setScriptedFlow('unitConversion')
      setScriptedMode(true)
      setScriptStep(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-resize textarea up to 5 lines
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20
    const maxHeight = lineHeight * 5 + 16 // 5 lines + padding
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [input])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Small delay to ensure DOM has updated
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, 100)
  }, [messages, isProcessing])

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus()
    }, 200)
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    // Process each file
    for (const file of Array.from(files)) {
      const tempId = `${Date.now()}-${Math.random()}`
      
      // Add file with loading state
      const newDoc: Attachment = {
        id: tempId,
        name: file.name,
        size: file.size,
        type: file.type,
        file,
        isExtracting: true,
      }
      
      setSessionDocuments((prev) => [...prev, newDoc])
      
      // Extract text asynchronously
      const result = await extractTextFromFile(file)
      
      // Update with extracted text or error
      setSessionDocuments((prev) =>
        prev.map((doc) =>
          doc.id === tempId
            ? {
                ...doc,
                extractedText: result.text,
                extractionError: result.error,
                isExtracting: false,
              }
            : doc
        )
      )
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRemoveDocument = (id: string) => {
    setSessionDocuments((prev) => prev.filter((doc) => doc.id !== id))
  }

  const handleClearAllDocuments = () => {
    setSessionDocuments([])
  }

  const assembleAgentPrompt = (data: { mailbox?: string; suggestFormats?: boolean; signature?: string }): { prompt: string; skills: string[] } => {
    const mailbox = data.mailbox || 'your AP mailbox'
    const signature = data.signature || 'AP Team'
    const prompt = `ROLE: Reject word formatted invoices - automatically rejects invoice files submitted in unsupported formats and notifies the vendor by email

INSTRUCTIONS:
- Check the file extension of each incoming invoice. If the file is in .docx format, reject it immediately.
- Connect to ${mailbox} and compose an automated reply to the original sender

INPUTS:
- Incoming invoice file (format/extension)
- Connected mailbox: ${mailbox}
- Sender email address

STEPS:
1. Check the file extension of each incoming invoice
2. If the file is in .docx format, reject it immediately
3. Connect to ${mailbox} and compose an automated reply to the original sender
4. The reply should explain that .docx files are not accepted as invoice submissions
5. Suggest PDF, XLSX, or JPG as acceptable file formats
6. Sign off the email as: ${signature}
7. Log the rejection and email confirmation for audit purposes

VALIDATIONS:
- Only reject .docx files — all other formats pass through to normal processing
- Ensure the reply email is sent before marking the file as rejected

OUTPUT:
- Rejection status per file
- Confirmation of automated email sent to vendor

ERROR HANDLING:
- If mailbox connection fails → flag for manual follow-up and notify the AP team
- If sender email cannot be determined → flag the file for manual review

EMAIL_TEMPLATE:
From: ${mailbox}
To: {{vendor_email}}
Subject: Invoice Submission Rejected — Unsupported File Format

Dear Vendor,

Thank you for your recent invoice submission. Unfortunately, we are unable to process your invoice as it was submitted in an unsupported file format (.docx).

To ensure your invoice can be processed promptly, please resubmit using one of the following accepted formats:

  • PDF
  • XLSX
  • JPG

If you have any questions regarding this, please don't hesitate to get in touch.

Kind regards,
${signature}`

    return { prompt, skills: ["Send Messages", "Process Documents", "Flag Issues"] }
  }

  const handleEnterScriptedMode = () => {
    setScriptedMode(true)
    setScriptStep(1)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ── Reject Word scripted flow ────────────────────────────────────────────────
  const SCRIPTED_USER_MESSAGES: Record<number, string> = {
    1: "I would like to automatically reject any invoice which comes in Word .docx format and send an automated email to the vendor which explains why it was rejected",
    2: "invoicing@xelix.com",
    3: "Please!",
  }

  const SCRIPTED_DATA = {
    mailbox: "invoicing@xelix.com",
    suggestFormats: true,
  }

  const handleRejectWordScriptedSend = (_userInput: string) => {
    const scriptedContent = SCRIPTED_USER_MESSAGES[scriptStep] ?? _userInput
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: scriptedContent,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setTimeout(() => inputRef.current?.focus(), 100)

    if (scriptStep === 1) {
      setScriptStep(2)
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I can help with that! Which mailbox should I connect to to send replies?",
          timestamp: new Date(),
        }])
      }, 350)
    } else if (scriptStep === 2) {
      setScriptStep(3)
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Should I suggest other formats as acceptable alternatives? (PDF, XLSX, JPG)",
          timestamp: new Date(),
        }])
      }, 350)
    } else if (scriptStep === 3) {
      setScriptStep(4)
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `I have a prompt ready for you to apply. ROLE:\nAutomatically reject any invoices received that are in Word format\n\nINSTRUCTIONS:\n- Scan all incoming invoices for their file format\n- If the invoice is received in Microsoft Word format (.docx), automatically reject the invoice\n- Send rejection notification back to vendor with the provided email template`,
          generatedPrompt: `ROLE: Reject Word Formatted Invoices Agent\n\nINSTRUCTIONS:\n- Scan all incoming invoices for their file format\n- If the invoice is received in Microsoft Word format (.docx), automatically reject the invoice\n- Send rejection notification back to vendor with the provided email template`,
          timestamp: new Date(),
        }])
        if (onStageDetected) onStageDetected("ingestion")
        if (onLaneDetected) onLaneDetected("File Triage")
      }, 350)
    }
  }

  // ── Unit Conversion scripted flow ────────────────────────────────────────────
  const UC_SCRIPTED_USER_MESSAGES: Record<number, string> = {
    1: "Each time JanServ Plc sends us landscaping sand, they put \"each\" on the invoice but we know each bag is actually 50kg. Each time they invoice us, can you add an agent that automatically adjusts the line item to reflect 1 bag is 50kg?",
    2: "Just JanServ for now",
  }

  const handleUnitConversionScriptedSend = (_userInput: string) => {
    const scriptedContent = UC_SCRIPTED_USER_MESSAGES[scriptStep] ?? _userInput
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: scriptedContent,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setTimeout(() => inputRef.current?.focus(), 100)

    if (scriptStep === 1) {
      setScriptStep(2)
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "OK, this looks like it belongs in **Stage: Matching, Lane: Unit Conversion**. I will convert units of measurement and check that the total amounts are the same between invoice and PO line items. Should this apply to all vendors, or just a specific vendor?",
          timestamp: new Date(),
        }])
      }, 350)
    } else if (scriptStep === 2) {
      setScriptStep(3)
      setTimeout(() => {
        const ucPrompt = `ROLE:\nUnit Conversion Matching Agent — adjusts the unit of measure of Landscaping Sand from JanServ Plc (WO-2025-445) from "each" to KG.\n\nINSTRUCTIONS:\n- Identify any line items for Landscaping Sand from JanServ Plc (WO-2025-445), that have a unit of measure of "each"\n- Update the line item on the invoice to reflect that "each" actually refers to 1 bag of 50kg\n- E.g. it means 10 x each will be converted to 500kg`
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `I have a prompt ready for you to apply. ${ucPrompt}`,
          generatedPrompt: ucPrompt,
          timestamp: new Date(),
        }])
        if (onStageDetected) onStageDetected("matching")
        if (onLaneDetected) onLaneDetected("Unit Conversion")
      }, 350)
    }
  }

  const handleScriptedSend = (_userInput: string) => {
    if (scriptedFlow === 'unitConversion') {
      handleUnitConversionScriptedSend(_userInput)
    } else {
      handleRejectWordScriptedSend(_userInput)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return

    if (scriptedMode) {
      handleScriptedSend(input.trim())
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const userInput = input
    setInput("")
    setIsProcessing(true)
    
    // Keep input focused
    setTimeout(() => inputRef.current?.focus(), 100)

    try {
      console.log("[v0] Sending chat request")
      
      // Build document context from session documents
      const documentContext = sessionDocuments
        .filter(doc => doc.extractedText && !doc.extractionError)
        .map(doc => `\n\n--- ATTACHED DOCUMENT: ${doc.name} ---\n${doc.extractedText}\n--- END DOCUMENT ---`)
        .join('')
      
      // Count assistant messages that are questions (not prompts with generatedPrompt)
      const assistantQuestions = messages.filter(m => m.role === "assistant" && !m.generatedPrompt && m.id !== "1")
      const currentQuestionCount = assistantQuestions.length
      
      // Prepare messages for API - add document context to first user message
      const allMessages = [...messages, userMessage]
      const messagesWithContext = allMessages.map((msg, idx) => {
        // Add document context to the first user message (after initial assistant message)
        if (idx === 1 && msg.role === "user" && documentContext) {
          return {
            role: msg.role,
            content: msg.content + documentContext
          }
        }
        return {
          role: msg.role,
          content: msg.content
        }
      })
      
      const response = await fetch("/api/agent-builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesWithContext,
          questionCount: currentQuestionCount,
          currentPrompt: currentPrompt || undefined,
          agentName: currentAgent?.name || undefined,
        }),
      })

      console.log("[v0] Response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        // Use the specific error message from the API (e.g., rate limit details)
        const errorMessage = errorData?.error || errorData?.details || `Server returned ${response.status}`
        throw new Error(errorMessage)
      }

      if (!response.body) {
        throw new Error("No response body received")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ""
      const assistantMessageId = (Date.now() + 1).toString()

      // Create initial assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ])

      console.log("[v0] Starting to read stream")

      // Stream the response and parse SSE format
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log("[v0] Stream complete")
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullResponse += content
                // Update message with streaming content
                setMessages((prev) =>
                  prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: fullResponse } : msg)),
                )
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Extract structured prompt and skills from response
      const { prompt, skills, isQuestion, stage, lane, isSettingsRecommendation, settingsLink, config, proseContent, mode } = extractPromptAndSkills(fullResponse)

      console.log("[v0] Extraction result:", {
        promptLength: prompt.length,
        skillsCount: skills.length,
        isQuestion,
        hasPrompt: !!prompt,
        stage,
        lane,
        isSettingsRecommendation,
        settingsLink,
      })

      // Update question count if this is a question (not a generated prompt)
      if (isQuestion && !prompt) {
        setQuestionCount((prev) => prev + 1)
      }
      
      // If stage was detected, notify parent component to update Stage dropdown
      if (stage && onStageDetected) {
        console.log("[v0] Calling onStageDetected with:", stage)
        onStageDetected(stage)
      }
      
      // If a focus area was detected, notify parent
      if (lane && onLaneDetected) {
        console.log("[v0] Calling onLaneDetected with:", lane)
        onLaneDetected(lane)
      }

      // Rule mode from the configuration (Shadow / Suggest / Auto apply)
      if (mode && onModeDetected) {
        console.log("[v0] Calling onModeDetected with:", mode)
        onModeDetected(mode)
      }

      // Update final message with extracted data
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: fullResponse,
                generatedPrompt: prompt || undefined, // Only set if prompt exists
                config,
                proseContent,
                suggestedSkills: undefined,
                isSettingsRecommendation: isSettingsRecommendation || undefined,
                settingsLink: settingsLink || undefined,
              }
            : msg,
        ),
      )
    } catch (error) {
      console.error("[v0] Chat error:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      
      // Display the specific error message (rate limit, auth, etc.)
      // Only add generic help text for non-specific errors
      const shouldShowGenericHelp = !errorMessage.toLowerCase().includes('rate limit') && 
                                     !errorMessage.toLowerCase().includes('api key');
      const helpText = shouldShowGenericHelp ? 
        '\n\nPlease check that your GROQ_API_KEY environment variable is configured correctly.' : '';
      
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${errorMessage}${helpText}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsProcessing(false)
      // Refocus input after AI responds
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleApplyPrompt = async (prompt: string, skills: string[], messageId: string) => {
    // Mark the message as applied so the button disappears
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, applied: true } : m))

    if (onPromptGenerated) {
      const referencedDocs = sessionDocuments.filter(doc => 
        doc.extractedText && !doc.extractionError
      )

      // Prevent the agentId useEffect from clearing the chat when the agent is
      // created/updated as a result of this action (scripted or otherwise)
      skipNextAgentClear.current = true
      
      // Store documents if agent has an ID
      if (agentId && referencedDocs.length > 0) {
        const storedDocs: AgentDocument[] = []
        
        for (const doc of referencedDocs) {
          try {
            const filePath = await storeDocument(doc.file, agentId)
            storedDocs.push({
              id: doc.id,
              name: doc.name,
              size: doc.size,
              type: doc.type,
              uploadedAt: new Date().toISOString(),
              filePath
            })
          } catch (error) {
            console.error('Failed to store document:', doc.name, error)
          }
        }
        
        onPromptGenerated(prompt, skills, storedDocs)
      } else {
        onPromptGenerated(prompt, skills, [])
      }

      if (scriptedMode) {
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: "assistant",
            content: "Agent successfully created. Would you like to back-test it against your historic invoice data?",
            showTestButton: true,
            timestamp: new Date(),
          }])
        }, 400)
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <div className="max-w-[70%] space-y-2">
              {/* Settings Recommendation Display */}
              {message.role === "assistant" && message.isSettingsRecommendation && (
                <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Settings Recommendation
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                        {message.content.replace(/SETTINGS_RECOMMENDATION\n/, '').replace(/SETTINGS_LINK:.*/, '').trim()}
                      </p>
                      {message.settingsLink && (
                        <a
                          href={message.settingsLink}
                          className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Go to Settings
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Regular message content - hidden only for legacy generated prompts and settings recommendations.
                  Configuration replies keep their conversational text and show the configuration below it. */}
              {!(message.role === "assistant" && message.generatedPrompt && !message.config) && !message.isSettingsRecommendation && (
                <div
                  className={`px-3 py-2 rounded-lg ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.config ? (message.proseContent || message.content) : message.content}</p>
                  {message.showTestButton && onOpenTest && (
                    <button
                      onClick={onOpenTest}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-900 text-white rounded-md hover:bg-purple-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                    >
                      Test agent
                    </button>
                  )}
                </div>
              )}
              
              {/* Xelix configuration block */}
              {message.role === "assistant" && message.config && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-900 text-white">
                      {outputTypeLabel(message.config.outputType)}
                    </span>
                    {configModeLabel(message.config) && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-purple-300 text-purple-900">
                        {configModeLabel(message.config)}
                      </span>
                    )}
                  </div>
                  {message.config.summary && (
                    <p className="text-sm font-medium text-gray-950">{message.config.summary}</p>
                  )}
                  {message.config.description && (
                    <p className="text-xs leading-relaxed text-gray-500">{message.config.description}</p>
                  )}
                  {configFields(message.config).map((field) => (
                    <div key={field.label} className="space-y-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{field.label}</p>
                      {field.values.map((value, i) => (
                        <p key={i} className="text-xs leading-relaxed text-gray-950 whitespace-pre-wrap">{value}</p>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Generated Prompt Display with Apply Button */}
              {message.role === "assistant" && message.generatedPrompt && message.generatedPrompt.length > 0 && (
                <>
                  {!message.config && (
                    <div className="px-3 py-2 rounded-lg bg-muted">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.generatedPrompt}</p>
                    </div>
                  )}
                  {!message.applied && (
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleApplyPrompt(message.generatedPrompt!, [], message.id)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {message.config ? "Apply configuration" : "Apply to Agent"}
                    </Button>
                  )}
                </>
              )}
              
              {/* Fallback: Show apply button if response has structured content but extraction didn't work */}
              {message.role === "assistant" && 
               !message.generatedPrompt && 
               !message.applied &&
               (message.content.includes("ROLE:") || 
                message.content.includes("INPUTS:") || 
                message.content.includes("STEPS:") || 
                message.content.includes("OUTPUT:")) && 
               !message.content.trim().endsWith("?") && (
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleApplyPrompt(message.content, [], message.id)}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Apply to Agent
                </Button>
              )}
            </div>
            {message.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            </div>
          ))}
          {isProcessing && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground animate-pulse" />
              </div>
              <div className="bg-muted px-3 py-2 rounded-lg">
                <p className="text-sm text-muted-foreground">Analyzing and expanding your configuration...</p>
              </div>
            </div>
          )}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Session Documents - shown above input */}
      {sessionDocuments.length > 0 && (
        <div className="border-t border-border p-3 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Reference Documents for this session:</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClearAllDocuments}
              className="h-6 text-xs"
            >
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessionDocuments.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs ${
                  doc.extractionError 
                    ? 'bg-destructive/10 border border-destructive/20' 
                    : doc.isExtracting 
                    ? 'bg-muted border border-border' 
                    : 'bg-background border border-border'
                }`}
              >
                {doc.isExtracting ? (
                  <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                ) : doc.extractionError ? (
                  <AlertCircle className="w-3 h-3 text-destructive" />
                ) : (
                  <FileText className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="max-w-[150px] truncate" title={doc.name}>{doc.name}</span>
                <span className="text-muted-foreground">{formatFileSize(doc.size)}</span>
                {doc.extractionError && (
                  <span className="text-destructive text-[10px]" title={doc.extractionError}>Error</span>
                )}
                {doc.isExtracting && (
                  <span className="text-muted-foreground text-[10px]">Extracting...</span>
                )}
                <button
                  onClick={() => handleRemoveDocument(doc.id)}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                  type="button"
                  disabled={doc.isExtracting}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 items-end">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              multiple
              accept=".pdf,.doc,.docx,.txt,.csv"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="icon"
              variant="outline"
              className="h-9 w-9"
              disabled={isProcessing}
              type="button"
              title="Attach reference documents"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={scriptedMode ? "Type your reply..." : "Describe what your agent should do..."}
              className="flex-1 text-sm resize-none rounded-md border border-input bg-background px-3 py-2 leading-5 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
              style={{ minHeight: '36px', overflowY: 'hidden' }}
              disabled={isProcessing}
            />
            <Button
              onClick={input.trim() ? handleSend : (!scriptedMode && !currentPrompt?.trim() && !isProcessing ? handleEnterScriptedMode : undefined)}
              size="icon"
              className="h-9 w-9"
              disabled={isProcessing || (!input.trim() && (scriptedMode || !!currentPrompt?.trim()))}
              title={!input.trim() && !scriptedMode && !currentPrompt?.trim() ? "Start guided setup" : undefined}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

ChatInterface.displayName = "ChatInterface"

function extractPromptAndSkills(response: string): { prompt: string; skills: string[]; isQuestion: boolean; stage?: string; lane?: string; isSettingsRecommendation?: boolean; settingsLink?: string; config?: XelixConfig; proseContent?: string; mode?: "observe" | "suggest" | "auto-apply" } {
  let prompt = ""
  const skills: string[] = []
  let stage: string | undefined = undefined
  let lane: string | undefined = undefined
  let isSettingsRecommendation: boolean = false
  let settingsLink: string | undefined = undefined

  console.log("[v0] Full AI response:", response.substring(0, 500))

  // Xelix configuration block — the Configuration Agent's output contract.
  // A reply with a block is a finished configuration, not a question.
  const configBlock = extractConfigBlock(response)
  if (configBlock) {
    const { config, blockText } = configBlock
    console.log("[v0] Detected Xelix configuration:", config.outputType)
    return {
      prompt: serialiseConfig(config),
      skills: [],
      isQuestion: false,
      stage: configStage(config),
      lane: outputTypeLabel(config.outputType),
      config,
      proseContent: stripConfigBlock(response, blockText),
      mode: configAgentMode(config),
    }
  }

  // Check for SETTINGS_RECOMMENDATION
  if (response.includes('SETTINGS_RECOMMENDATION')) {
    isSettingsRecommendation = true
    console.log("[v0] Detected settings recommendation")
    
    // Extract settings link if present
    const linkMatch = response.match(/SETTINGS_LINK:\s*([^\n\r]+)/i)
    if (linkMatch) {
      settingsLink = linkMatch[1].trim()
      console.log("[v0] Detected settings link:", settingsLink)
    } else {
      // Default to General Settings page
      settingsLink = '/settings#automation-general-settings'
    }
  }
  
  // Extract DETECTED_STAGE if present (full P2P / AP domains)
  const stageMatch = response.match(/DETECTED_STAGE:\s*(procurement|receiving|ingestion|data-capture|verification|matching|approval|posting|payments|helpdesk|vendor-management|compliance)/i)
  if (stageMatch) {
    stage = stageMatch[1].toLowerCase()
    console.log("[v0] Detected stage:", stage)
  }
  
  // Extract DETECTED_LANE if present — free-text focus label (no fixed list)
  const laneMatch = response.match(/DETECTED_LANE:\s*([^\n\r]+)/i)
  if (laneMatch) {
    lane = laneMatch[1].trim()
    console.log("[v0] Detected lane:", lane)
  }

  const hasStructuredContent =
    response.includes("ROLE:") ||
    response.includes("INPUTS:") ||
    response.includes("INPUT:") ||
    response.includes("STEPS:") ||
    response.includes("STEP:") ||
    response.includes("OUTPUT:") ||
    response.includes("VALIDATIONS:") ||
    response.includes("VALIDATION:") ||
    response.includes("ERROR HANDLING:") ||
    response.includes("ERROR_HANDLING:")

  // Detect if this is a question (not a generated prompt)
  // A question typically:
  // - Doesn't have structured sections
  // - Ends with a question mark
  // - Is conversational
  const isQuestion = !hasStructuredContent && (
    response.trim().endsWith("?") ||
    /^(To help|Could you|What|Which|How|When|Where|Would|Can|Should|Do you|Are you)/i.test(response.trim())
  )

  if (hasStructuredContent) {
    // Split response into lines to process
    const lines = response.split("\n")
    let inStructuredSection = false
    const promptLines: string[] = []
    let foundFirstSection = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Start capturing when we hit a structured section (more flexible matching)
      if (
        /^###?\s*(ROLE|INPUTS?|STEPS?|VALIDATIONS?|OUTPUT|ERROR\s*HANDLING|CONTEXT|AGENT|DESCRIPTION)/i.test(line) ||
        /^\*\*(ROLE|INPUTS?|STEPS?|VALIDATIONS?|OUTPUT|ERROR\s*HANDLING|CONTEXT|AGENT|DESCRIPTION)/i.test(line) ||
        /^(ROLE|INPUTS?|STEPS?|VALIDATIONS?|OUTPUT|ERROR\s*HANDLING|CONTEXT|AGENT|DESCRIPTION):/i.test(line.trim())
      ) {
        inStructuredSection = true
        foundFirstSection = true
        // Include the section header line
        promptLines.push(line)
        continue
      }

      // If we've found the first section, continue capturing until we hit a stop condition
      if (foundFirstSection && inStructuredSection) {
        // Stop capturing at SUGGESTED SKILLS or conversational endings
        if (
          /^###?\s*SUGGESTED\s+(SKILLS|TOOLS)/i.test(line) ||
          /^\*\*SUGGESTED\s+(SKILLS|TOOLS)/i.test(line) ||
          /^SUGGESTED\s+(SKILLS|TOOLS):/i.test(line.trim()) ||
          /^(How does this|Would you like|Let me know|Please let me know|Are there any|To achieve this|To implement this|Here is|This prompt)/i.test(line.trim())
        ) {
          inStructuredSection = false
          break
        }
        // Continue capturing lines
        promptLines.push(line)
      }
    }

    prompt = promptLines.join("\n").trim()
    console.log("[v0] Extracted prompt length:", prompt.length, "chars")
    console.log("[v0] Extracted prompt preview:", prompt.substring(0, 200))
  } else {
    prompt = ""
    console.log("[v0] No structured content found in response")
  }

  // 1. Look for "SUGGESTED SKILLS:" section (also check for TOOLS for backward compatibility)
  const suggestedSkillsMatch = response.match(/\*\*?SUGGESTED\s+(SKILLS|TOOLS):?\*\*?\s*([\s\S]*?)(?=\n\n|###|$)/i)
  if (suggestedSkillsMatch) {
    console.log("[v0] Found SUGGESTED SKILLS/TOOLS section")
    const skillsSection = suggestedSkillsMatch[2]
    AVAILABLE_SKILLS.forEach((skill) => {
      // Match: - Skill, * Skill, • Skill, **Skill**, or just Skill on its own line
      if (new RegExp(`[-•*]?\\s*\\*?\\*?${skill}\\*?\\*?`, "i").test(skillsSection) && !skills.includes(skill)) {
        console.log("[v0] Found skill in SUGGESTED SKILLS:", skill)
        skills.push(skill)
      }
    })
  }

  // 2. Look for skills section with variations (also check for tools for backward compatibility)
  const skillsSectionMatch = response.match(
    /(skills?|tools?) (needed|required)|implement.*using|recommend.*(skills?|tools?):?\s*([\s\S]*?)(?=\n\n|###|$)/i,
  )
  if (skillsSectionMatch && skills.length === 0) {
    console.log("[v0] Found skills/tools section (variation)")
    const sectionText = skillsSectionMatch[skillsSectionMatch.length - 1]
    AVAILABLE_SKILLS.forEach((skill) => {
      if (new RegExp(`[-•*]?\\s*\\*?\\*?${skill}\\*?\\*?`, "i").test(sectionText) && !skills.includes(skill)) {
        console.log("[v0] Found skill in skills section:", skill)
        skills.push(skill)
      }
    })
  }

  // 3. Last resort: scan entire response for skill mentions
  if (skills.length === 0) {
    console.log("[v0] Scanning entire response for skills")
    AVAILABLE_SKILLS.forEach((skill) => {
      if (new RegExp(`\\b${skill}\\b`, "i").test(response)) {
        console.log("[v0] Found skill in full scan:", skill)
        skills.push(skill)
      }
    })
  }

  console.log("[v0] Extracted prompt length:", prompt.length, "chars")
  console.log("[v0] Extracted skills:", skills)
  console.log("[v0] Is question:", isQuestion)
  console.log("[v0] Detected stage:", stage)
  console.log("[v0] Detected lane:", lane)
  console.log("[v0] Is settings recommendation:", isSettingsRecommendation)
  console.log("[v0] Settings link:", settingsLink)

  return { prompt, skills, isQuestion, stage, lane, isSettingsRecommendation, settingsLink }
}

export default ChatInterface
