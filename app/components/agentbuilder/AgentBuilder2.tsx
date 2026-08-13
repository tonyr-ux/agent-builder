"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronRight, ChevronDown, Plus, X, Minimize2, Power, Pencil, Play, Loader2, TrendingDown } from "lucide-react"
import { Agent } from "./AgentBuilderPage"
import { ChatInterface, type ChatInterfaceRef } from "./ChatInterface"
import { AgentDetailsView } from "./AgentDetailsView"
import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"

// Import simulation modules
import { generateTestScenarios, type ScenarioConfig, type TimePeriod, type Stage } from './testScenarioGenerator'
import { simulateBaselineProcessingBatch, type BaselineStats } from './baselineSimulator'
import { simulateAgentProcessingBatch, type AgentStats, type AgentConfig as SimAgentConfig } from './agentSimulator'
import { calculateComparisonMetrics, createInvoiceComparisons, formatMetricsForDisplay, generateExecutiveSummary, type ComparisonMetrics, type InvoiceComparison } from './comparisonMetrics'
import { isDemoAgent, buildDemoResults } from './demoFixtures'
import { groupAgentsByStage, normalizeStageId } from "./stageUtils"
import { parseStoredConfig } from "./xelixConfig"

interface AgentMetrics {
  evaluated: number
  actedOn: number
  referred: number
  createdDate?: string
  lastRunDate?: string | null
  avgRuntimeMs?: number
  invoicesProcessed?: number
}

interface AgentBuilder2Props {
  agents: Agent[]
  onCreateAgent: (stageId: string) => void
  currentAgent: Agent | null
  onAgentSelect: (agent: Agent | null) => void
  onSaveAgent: (agent: Agent) => void
  isPreviewMode: boolean
  onToggleActive: (agentId: string) => void
  onEditAgent: (agent: Agent) => void
  onDeleteAgent: (agentId: string) => void
  onOpenTest?: () => void
  testingAgent?: Agent | null
  onCloseTest?: () => void
  agentMetrics?: Record<string, AgentMetrics>
}

export function AgentBuilder2({
  agents,
  onCreateAgent,
  currentAgent,
  onAgentSelect,
  onSaveAgent,
  isPreviewMode,
  onToggleActive,
  onEditAgent,
  onDeleteAgent,
  onOpenTest,
  testingAgent,
  onCloseTest,
  agentMetrics = {},
}: AgentBuilder2Props) {
  const [chatOpen, setChatOpen] = useState(false)
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const knownStageIdsRef = useRef<Set<string> | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [leftWidth, setLeftWidth] = useState(320) // 320px = w-80
  const [rightWidth, setRightWidth] = useState(400) // 400px default chat width
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const chatRef = useRef<ChatInterfaceRef>(null)
  const [initialScriptedFlow, setInitialScriptedFlow] = useState<'unitConversion' | undefined>(undefined)
  const [chatKey, setChatKey] = useState(0)
  const [detectedStage, setDetectedStage] = useState<string>("")
  const [detectedLane, setDetectedLane] = useState<string>("")
  const [detectedMode, setDetectedMode] = useState<Agent["mode"] | undefined>(undefined)

  // Testing modal state
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<"7days" | "30days" | "3months" | "6months">("7days")
  const [isTesting, setIsTesting] = useState(false)
  const [testProgress, setTestProgress] = useState(0)
  const [comparisonMetrics, setComparisonMetrics] = useState<ComparisonMetrics | null>(null)
  const [invoiceComparisons, setInvoiceComparisons] = useState<InvoiceComparison[]>([])
  const [baselineStats, setBaselineStats] = useState<BaselineStats | null>(null)
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null)
  const [withoutAgentFilter, setWithoutAgentFilter] = useState<"all" | "pass" | "blocked" | "delayed" | "error">("all")
  const [withAgentFilter, setWithAgentFilter] = useState<"all" | "auto_resolved" | "suggested_resolution" | "observed" | "escalated_to_human">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "pass" | "fail">("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage] = useState(50)


  // Auto-show details when currentAgent is loaded (e.g., from URL parameter or new agent creation)
  useEffect(() => {
    // Show details and chat for both preview mode and new agents with prompts
    if (currentAgent && currentAgent.prompt) {
      setShowDetails(true)
      setChatOpen(true) // Keep chat interface available
      
      // Also expand the stage containing this agent
      if (currentAgent.stage) {
        setExpandedStages(prev => {
          const newSet = new Set(prev)
          newSet.add(currentAgent.stage)
          return newSet
        })
      }
    }
  }, [currentAgent?.id])

  // Extract a clean agent name from the prompt
  const extractAgentName = (prompt: string): string => {
    // Xelix configuration blocks carry their own one-line label
    const config = parseStoredConfig(prompt)
    if (config?.summary?.trim()) {
      return config.summary.trim()
    }

    // Try to extract from ROLE line
    const roleMatch = prompt.match(/ROLE:\s*(.+?)(?:\s*-|Agent|\n|$)/i)
    if (roleMatch) {
      let name = roleMatch[1].trim()
      // Remove common suffixes
      name = name.replace(/\s+(Agent|automation|processor|handler|service|system)$/i, '')
      // Capitalize first letter of each word
      name = name.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
      return name + ' Agent'
    }
    
    // Fallback: try to extract from first meaningful line
    const lines = prompt.split('\n').filter(l => l.trim())
    if (lines.length > 0) {
      return lines[0].substring(0, 50).trim() + ' Agent'
    }
    
    return 'New Agent'
  }

  const runBulkTest = async () => {
    if (!testingAgent) return

    // Capture these synchronously before any awaits or re-renders can change them
    const runId = `run-${Date.now()}`
    const capturedAgentName = testingAgent.name
    const capturedTimePeriod = selectedTimePeriod
    const capturedStage = testingAgent.stage || 'matching'
    const capturedLane = testingAgent.lane || ''
    const capturedMode = testingAgent.mode || 'auto-apply'
    const capturedPrompt = testingAgent.prompt || ''
    const capturedSkills = testingAgent.skills || []

    // Close the period-selection modal and signal the settings page to switch to Back Testing tab
    if (onCloseTest) onCloseTest()
    window.dispatchEvent(new CustomEvent('back-test-tab-switch'))

    // ── Demo mode: bypass simulation for specific demo agents ──────────────
    if (isDemoAgent(capturedAgentName)) {
      setIsTesting(true)
      setTestProgress(0)
      setComparisonMetrics(null)
      setInvoiceComparisons([])
      setCurrentPage(1)

      window.dispatchEvent(new CustomEvent('back-test-started', {
        detail: { runId, agentName: capturedAgentName, timePeriod: capturedTimePeriod }
      }))

      const { comparisons: demoComparisons, metrics: demoMetrics } = buildDemoResults(capturedTimePeriod)
      const batchSize = 50

      for (let offset = 0; offset < demoComparisons.length; offset += batchSize) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        const batch = demoComparisons.slice(offset, offset + batchSize)
        const progress = Math.min(((offset + batchSize) / demoComparisons.length) * 100, 100)
        setTestProgress(progress)
        setInvoiceComparisons(prev => [...prev, ...batch])
        window.dispatchEvent(new CustomEvent('back-test-progress', {
          detail: { runId, progress, recentComparisons: batch }
        }))
      }

      setComparisonMetrics(demoMetrics)
      setIsTesting(false)

      try {
        window.dispatchEvent(new CustomEvent('back-test-complete', {
          detail: { runId, metrics: demoMetrics, agentName: capturedAgentName, timePeriod: capturedTimePeriod }
        }))
      } catch (e) {
        console.error('[AgentBuilder2] Failed to dispatch back-test-complete (demo):', e)
      }
      return
    }
    // ── End demo mode ───────────────────────────────────────────────────────

    setIsTesting(true)
    setTestProgress(0)
    setComparisonMetrics(null)
    setInvoiceComparisons([])
    setCurrentPage(1)

    window.dispatchEvent(new CustomEvent('back-test-started', {
      detail: { runId, agentName: capturedAgentName, timePeriod: capturedTimePeriod }
    }))

    // Configure scenario generation
    const scenarioConfig: ScenarioConfig = {
      scenarioTypes: ["all"],
      issueMix: 40,
      stage: capturedStage as Stage,
      lane: capturedLane,
    }

    // Generate test scenarios
    const scenarios = generateTestScenarios(capturedTimePeriod as TimePeriod, scenarioConfig)
    
    // Configure agent for simulation
    const agentConfig: SimAgentConfig = {
      name: capturedAgentName || "Test Agent",
      stage: capturedStage,
      lane: capturedLane,
      mode: capturedMode,
      prompt: capturedPrompt,
      skills: capturedSkills,
    }

    const batchSize = 50
    const totalBatches = Math.ceil(scenarios.length / batchSize)
    
    let allBaselineResults: any[] = []
    let allAgentResults: any[] = []

    // Process in batches for UI responsiveness
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize
      const batchEnd = Math.min(batchStart + batchSize, scenarios.length)
      const batchScenarios = scenarios.slice(batchStart, batchEnd)

      // Simulate processing delay for realism
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Run both baseline and agent simulations
      const { results: baselineResults } = simulateBaselineProcessingBatch(batchScenarios)
      const { results: agentResults } = simulateAgentProcessingBatch(batchScenarios, agentConfig)

      allBaselineResults = [...allBaselineResults, ...baselineResults]
      allAgentResults = [...allAgentResults, ...agentResults]

      // Update progress
      const progress = ((batchEnd) / scenarios.length) * 100
      setTestProgress(progress)

      // Create invoice comparisons for display
      const batchComparisons = createInvoiceComparisons(batchScenarios, baselineResults, agentResults)
      setInvoiceComparisons(prev => [...prev, ...batchComparisons])

      // Broadcast progress to BackTestPanel
      window.dispatchEvent(new CustomEvent('back-test-progress', {
        detail: { runId, progress, recentComparisons: batchComparisons }
      }))
    }

    // Calculate final statistics
    const { stats: finalBaselineStats } = simulateBaselineProcessingBatch(scenarios)
    const { stats: finalAgentStats } = simulateAgentProcessingBatch(scenarios, agentConfig)
    
    setBaselineStats(finalBaselineStats)
    setAgentStats(finalAgentStats)

    // Calculate STP counts from accumulated results
    const stpCountWithout = allBaselineResults.filter((r: any) => r.outcome === "passed" && r.manualTouches === 0).length
    const stpCountWith = allAgentResults.filter((r: any) => r.manualTouches === 0 && (r.agentAction === "auto_resolved" || r.outcome === "passed")).length

    // Calculate comparison metrics
    const metrics = calculateComparisonMetrics(finalBaselineStats, finalAgentStats, scenarios.length, stpCountWithout, stpCountWith)
    setComparisonMetrics(metrics)

    setIsTesting(false)

    // Broadcast completion to BackTestPanel and trigger toast
    try {
      window.dispatchEvent(new CustomEvent('back-test-complete', {
        detail: { runId, metrics, agentName: capturedAgentName, timePeriod: capturedTimePeriod }
      }))
    } catch (e) {
      console.error('[AgentBuilder2] Failed to dispatch back-test-complete:', e)
    }
  }

  const handleCloseTestModal = () => {
    // Just close the period-selection modal overlay; test data stays in the Back Testing tab
    if (onCloseTest) onCloseTest()
  }

  const handleResetTestData = () => {
    setComparisonMetrics(null)
    setInvoiceComparisons([])
    setTestProgress(0)
    setIsTesting(false)
    setCurrentPage(1)
    setWithoutAgentFilter("all")
    setWithAgentFilter("all")
    setStatusFilter("all")
  }

  const exportComparisonToCSV = () => {
    if (!comparisonMetrics || invoiceComparisons.length === 0) return

    // Build CSV content
    const headers = [
      "Invoice ID",
      "Vendor",
      "Amount",
      "Without Agent - Outcome",
      "Without Agent - Time (min)",
      "Without Agent - Manual Touches",
      "With Agent - Action",
      "With Agent - Time (min)",
      "With Agent - Manual Touches",
      "Improvement",
      "Time Saved (min)",
      "Improvement Highlights",
    ]

    const rows = invoiceComparisons.map(comp => [
      comp.invoiceId,
      comp.vendor,
      comp.amount.toFixed(2),
      comp.withoutAgent.outcome,
      comp.withoutAgent.processingTime.toFixed(1),
      comp.withoutAgent.manualTouches,
      comp.withAgent.action,
      comp.withAgent.processingTime.toFixed(1),
      comp.withAgent.manualTouches,
      comp.improvement.outcome,
      comp.improvement.timeSaved.toFixed(1),
      comp.improvement.highlights.join("; "),
    ])

    // Add summary rows
    rows.push([]) // Empty row
    rows.push(["SUMMARY"])
    rows.push(["Total Invoices", String(invoiceComparisons.length)])
    rows.push(["Avg Time Without Agent", comparisonMetrics.avgProcessingTimeWithout.toFixed(1) + " min"])
    rows.push(["Avg Time With Agent", comparisonMetrics.avgProcessingTimeWith.toFixed(1) + " min"])
    rows.push(["Time Reduction", comparisonMetrics.timeReductionPercentage.toFixed(1) + "%"])
    rows.push(["Annual FTE Savings", comparisonMetrics.annualFTESavings.toFixed(2)])
    rows.push(["Annual Cost Savings", "$" + comparisonMetrics.annualCostSavings.toLocaleString()])

    // Convert to CSV
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")

    // Download
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `agent-test-comparison-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePromptGenerated = (prompt: string, _skills: string[], documents?: any[]) => {
    console.log('[AgentBuilder2] handlePromptGenerated called', { currentAgent, prompt: prompt.substring(0, 50) })
    
    const agentName = extractAgentName(prompt)
    
    if (currentAgent) {
      const updatedAgent = {
        ...currentAgent,
        name: currentAgent.name === 'New Agent' || !currentAgent.name ? agentName : currentAgent.name,
        stage: normalizeStageId(detectedStage || currentAgent.stage || ''),
        lane: detectedLane || currentAgent.lane || '',
        mode: detectedMode || currentAgent.mode,
        prompt,
        skills: [],
        documents: documents || currentAgent.documents,
      }
      console.log('[AgentBuilder2] Updating existing agent:', updatedAgent.name)
      onSaveAgent(updatedAgent)
      setShowDetails(true)
    } else {
      // Create a new agent if none is selected
      console.log('[AgentBuilder2] Creating new agent')
      const newAgentId = `agent-${Date.now()}`
      
      // Extract stage from prompt if possible
      const stageMatch = prompt.match(/STAGE:\s*(\w+)/i)
      const stage = stageMatch ? stageMatch[1].toLowerCase() : ''
      
      const newAgent: Agent = {
        id: newAgentId,
        name: agentName,
        stage: normalizeStageId(detectedStage || stage),
        lane: detectedLane,
        active: false,
        mode: detectedMode || 'auto-apply',
        prompt,
        skills: [],
        documents: documents || [],
      }
      
      console.log('[AgentBuilder2] New agent created:', newAgent)
      onSaveAgent(newAgent)
      onAgentSelect(newAgent)
      setShowDetails(true)
    }
  }

  const handleEditAgentDetails = () => {
    setShowDetails(false)
  }

  const handleSaveAgentDetails = () => {
    // Save is already handled by onSaveAgent
    setShowDetails(true)
  }

  const handleCreateNewAgent = (stageId?: string) => {
    const newAgentId = `agent-${Date.now()}`
    const newAgent: Agent = {
      id: newAgentId,
      name: "",
      stage: stageId || "",
      active: false,
      mode: "auto-apply",
      prompt: "",
      skills: [],
      documents: [],
    }
    
    onAgentSelect(newAgent)
    setChatOpen(true)
    setShowDetails(false)
  }

  // Handle left resize
  const handleLeftMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingLeft(true)
  }

  // Handle right resize
  const handleRightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingRight(true)
  }

  // Handle mouse move for resizing
  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingLeft) {
      const newWidth = Math.max(240, Math.min(500, e.clientX))
      setLeftWidth(newWidth)
    }
    if (isDraggingRight) {
      const newWidth = Math.max(300, Math.min(600, window.innerWidth - e.clientX))
      setRightWidth(newWidth)
    }
  }

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDraggingLeft(false)
    setIsDraggingRight(false)
  }

  // Add event listeners for drag
  useEffect(() => {
    if (isDraggingLeft || isDraggingRight) {
      // Set cursor for entire document during drag
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      
      window.addEventListener('mousemove', handleMouseMove as any)
      window.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', handleMouseMove as any)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingLeft, isDraggingRight])

  // Group agents into sections by stage — new stages appear as agents are created
  const agentsByStage = groupAgentsByStage(agents)

  // Auto-expand only newly appeared sections (keep seed stages collapsed on load)
  useEffect(() => {
    const currentIds = agentsByStage.map((s) => s.id)

    if (knownStageIdsRef.current === null) {
      knownStageIdsRef.current = new Set(currentIds)
      return
    }

    setExpandedStages((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const id of currentIds) {
        if (!knownStageIdsRef.current!.has(id)) {
          knownStageIdsRef.current!.add(id)
          next.add(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [agentsByStage.map((s) => s.id).join(",")])

  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(stageId)) {
        newSet.delete(stageId)
      } else {
        newSet.add(stageId)
      }
      return newSet
    })
  }

  return (
    <div className="flex h-full bg-white relative">
      {/* Left Column: Agent List */}
      <div className="border-r border-gray-200 flex flex-col bg-white" style={{ width: `${leftWidth}px` }}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-950 uppercase tracking-wide">Agents</h2>
            <button className="p-1 hover:bg-gray-100 rounded">
              <Minimize2 className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {agentsByStage.map((stage) => (
              <div key={stage.id} className="rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleStage(stage.id)}
                  className="w-full flex items-center gap-2 p-2.5 hover:bg-gray-50 transition-colors rounded-lg"
                >
                  {expandedStages.has(stage.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-950">{stage.name}</div>
                    <div className="text-xs text-gray-500">
                      {stage.activeCount} active, {stage.inactiveCount} inactive
                    </div>
                  </div>
                </button>

                {expandedStages.has(stage.id) && stage.agents.length > 0 && (
                  <div className="space-y-1 mt-1 ml-2 pl-4 border-l border-gray-200">
                    {stage.agents.map((agent) => {
                      const isSelected = currentAgent?.id === agent.id
                      return (
                      <div
                        key={agent.id}
                        onClick={() => {
                          onAgentSelect(agent)
                          if (agent.prompt) {
                            setShowDetails(true)
                            setChatOpen(true)
                          } else {
                            setShowDetails(false)
                          }
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors group cursor-pointer ${
                          isSelected 
                            ? 'bg-purple-50 border-2 border-purple-900 hover:bg-purple-100' 
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`w-7 h-7 shrink-0 ${agent.active ? "text-green-500 hover:text-green-600" : "text-gray-400 hover:text-gray-600"}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleActive(agent.id)
                          }}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${agent.active ? "bg-green-500" : "bg-gray-400"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-950 truncate">{agent.name}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditAgent(agent)
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => handleCreateNewAgent()}
            className="w-full flex items-center justify-start gap-2 px-4 py-2.5 bg-purple-900 text-white rounded-lg hover:bg-purple-800 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Agent
          </button>
        </div>
      </div>

      {/* Left Resize Handle */}
      <div
        onMouseDown={handleLeftMouseDown}
        className={`w-1 hover:w-1.5 bg-transparent hover:bg-purple-600 cursor-col-resize transition-all ${
          isDraggingLeft ? 'w-1.5 bg-purple-600' : ''
        }`}
        style={{ flexShrink: 0 }}
      />

      {/* Middle Column: Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: '400px' }}>
        {showDetails && currentAgent && currentAgent.prompt ? (
          <AgentDetailsView
            agent={currentAgent}
            onToggleActive={onToggleActive}
            onEdit={handleEditAgentDetails}
            onDelete={onDeleteAgent}
            onSave={handleSaveAgentDetails}
            onUpdateAgent={onSaveAgent}
            allAgents={agents}
            onOpenTest={onOpenTest}
            agentMetrics={currentAgent.id ? agentMetrics[currentAgent.id] : undefined}
          />
        ) : chatOpen ? (
          // State when user is creating a new agent (chat is open)
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center px-8">
              <div className="mb-6">
                <img 
                  src="/agent-builder-robot.png" 
                  alt="Start guided agent setup"
                  title="Click to start guided setup"
                  className="w-48 h-48 mx-auto object-contain cursor-pointer hover:scale-105 transition-transform duration-200"
                  onClick={() => {
                    setInitialScriptedFlow('unitConversion')
                    setChatKey(k => k + 1)
                    handleCreateNewAgent()
                  }}
                />
              </div>
              <h3 className="text-2xl font-semibold text-gray-950 mb-4">
                Let's build your agent together
              </h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Use the chat panel on the right to describe what you'd like this agent to do. I'll help configure everything.
              </p>
            </div>
          </div>
        ) : (
          // Initial empty state (no chat, no agent selected)
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center px-8">
              <div className="mb-6">
                <img
                  src="/agent-builder-robot.png"
                  alt="Start guided agent setup"
                  title="Click to start guided setup"
                  className="w-48 h-48 mx-auto object-contain cursor-pointer hover:scale-105 transition-transform duration-200"
                  onClick={() => {
                    setInitialScriptedFlow('unitConversion')
                    setChatKey(k => k + 1) // force ChatInterface to remount with the new prop
                    handleCreateNewAgent()
                  }}
                />
              </div>
              <h3 className="text-xl font-semibold text-gray-950 mb-4">
                Agent builder
              </h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
                An agent is a reusable set of rules that automates a repetitive AP task. Tell us what you want done and we’ll help you build it.
              </p>
              <button
                onClick={() => handleCreateNewAgent()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-900 text-white rounded-lg hover:bg-purple-800 transition-colors text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                Create new agent
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Resize Handle */}
      {chatOpen && (
        <div
          onMouseDown={handleRightMouseDown}
          className={`w-1 hover:w-1.5 bg-transparent hover:bg-purple-600 cursor-col-resize transition-all ${
            isDraggingRight ? 'w-1.5 bg-purple-600' : ''
          }`}
          style={{ flexShrink: 0 }}
        />
      )}

      {/* Right Column: Chat Panel */}
      {chatOpen && (
        <div className="border-l border-gray-200 flex flex-col" style={{ width: `${rightWidth}px` }}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-950">Chat</h2>
            <button
              onClick={() => { chatRef.current?.clearChat(); setInitialScriptedFlow(undefined) }}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Clear chat
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatInterface
              key={chatKey}
              ref={chatRef}
              initialScriptedFlow={initialScriptedFlow}
              currentAgent={currentAgent}
              onPromptGenerated={handlePromptGenerated}
              onStageDetected={(stage) => {
                console.log('[AgentBuilder2] Stage detected:', stage)
                setDetectedStage(stage)
              }}
              onLaneDetected={(lane) => {
                console.log('[AgentBuilder2] Lane detected:', lane)
                setDetectedLane(lane)
              }}
              onModeDetected={(mode) => {
                console.log('[AgentBuilder2] Mode detected:', mode)
                setDetectedMode(mode)
              }}
              agentId={currentAgent?.id}
              currentPrompt={currentAgent?.prompt}
              onOpenTest={onOpenTest}
            />
          </div>
        </div>
      )}

      {/* Test Setup Modal - period selection only; progress & results live in Back Testing tab */}
      {testingAgent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-6">
          <Card className="w-full max-w-lg overflow-hidden flex flex-col shadow-xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-950">Configure Back Test</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {testingAgent.name || "Untitled Agent"} — simulate against historical invoice data
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseTestModal}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <Label className="text-sm font-semibold text-gray-950 mb-3 block">Select time period</Label>
                <div className="grid grid-cols-4 gap-3">
                  {(["7days", "30days", "3months", "6months"] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedTimePeriod(period)}
                      className={`h-16 rounded-lg border-2 flex flex-col items-center justify-center transition-colors ${
                        selectedTimePeriod === period
                          ? "border-purple-700 bg-purple-50 text-purple-900"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <span className="font-bold text-base">{period === "7days" ? "7 days" : period === "30days" ? "30 days" : period === "3months" ? "3 months" : "6 months"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Card className="p-4 bg-gray-50 border-gray-200">
                <h4 className="text-sm font-semibold text-gray-950 mb-2">Test configuration</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Agent:</span><span className="font-medium text-gray-950">{testingAgent.name || "Unnamed Agent"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Stage:</span><span className="font-medium text-gray-950 capitalize">{testingAgent.stage || "N/A"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Mode:</span><span className="font-medium text-gray-950">{testingAgent.mode === "auto-apply" ? "Auto-Apply" : testingAgent.mode || "N/A"}</span></div>
                </div>
              </Card>

              <Button
                onClick={runBulkTest}
                className="w-full h-11 bg-purple-900 hover:bg-purple-800 text-white"
                size="lg"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Test Run
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
