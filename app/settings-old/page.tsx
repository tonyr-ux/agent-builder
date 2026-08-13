'use client';

import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/app/components/AppLayout';
import AgentBuilderPage from '@/app/components/agentbuilder/AgentBuilderPage';
import APAutomationGeneralSettings from '@/app/components/settings/APAutomationGeneralSettings';
import { BackTestPanel, useBackTestActive } from '@/app/components/agentbuilder/BackTestPanel';
import { useToast } from '@/app/components/ui/Toast';

/**
 * The previous settings tabs (dashboard, the older agent builder, back-testing,
 * documents, general settings). Kept at /settings-old and deliberately unlinked:
 * /settings now goes to the Agents workspace. Reachable by URL when needed.
 */
interface SettingsContentProps {
  currentView?: string;
}

function SettingsContent({ currentView = 'dashboard' }: SettingsContentProps) {
  const activeSubTab = currentView;
  const backTestActive = useBackTestActive();
  const { showToast } = useToast();

  useEffect(() => {
    const switchTab = (tab: string) => {
      window.history.pushState({}, '', `/settings-old#${tab}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    };

    const onBackTestTabSwitch = () => switchTab('back-testing');

    const onRunNew = () => switchTab('agent-builder-2');

    const onBackTestComplete = (e: Event) => {
      const { agentName } = (e as CustomEvent).detail ?? {};
      showToast(
        `Back test complete${agentName ? `: ${agentName}` : ''}`,
        'success',
        {
          label: 'View results →',
          onClick: () => switchTab('back-testing'),
        },
        8000
      );
    };

    window.addEventListener('back-test-tab-switch', onBackTestTabSwitch);
    window.addEventListener('back-test-run-new', onRunNew);
    window.addEventListener('back-test-complete', onBackTestComplete);

    return () => {
      window.removeEventListener('back-test-tab-switch', onBackTestTabSwitch);
      window.removeEventListener('back-test-run-new', onRunNew);
      window.removeEventListener('back-test-complete', onBackTestComplete);
    };
  }, [showToast]);

  // Support ?newAgent=true deep link into Agent Builder
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('newAgent') === 'true') {
      window.history.replaceState({}, '', '/settings-old#agent-builder-2');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Back-testing spinner indicator when that tab is active in TopBar context */}
      {activeSubTab === 'back-testing' && backTestActive && (
        <div className="sr-only" aria-live="polite">
          Back test in progress
          <Loader2 className="w-3 h-3 animate-spin" />
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        {activeSubTab === 'general-settings' && (
          <div className="h-full overflow-auto">
            <APAutomationGeneralSettings />
          </div>
        )}
        {activeSubTab === 'dashboard' && (
          <div className="h-full overflow-auto">
            <AgentBuilderPage
              key="dashboard"
              hideNavigation={true}
              defaultMode="executive-dashboard"
              lockMode={true}
            />
          </div>
        )}
        {/* AgentBuilderPage stays mounted while back-testing so the test keeps running */}
        <div
          className={`h-full ${
            activeSubTab === 'agent-builder-2' || activeSubTab === 'back-testing' ? '' : 'hidden'
          }`}
        >
          <AgentBuilderPage key="builder2" hideNavigation={true} defaultMode="build2" />
        </div>
        {/* BackTestPanel is ALWAYS mounted so it never misses events */}
        <div
          className={`absolute inset-0 flex flex-col bg-gray-50 overflow-hidden ${
            activeSubTab !== 'back-testing' ? 'hidden' : ''
          }`}
        >
          <BackTestPanel />
        </div>
        {activeSubTab === 'documents' && (
          <div className="h-full overflow-auto">
            <AgentBuilderPage key="documents" hideNavigation={true} defaultMode="documents" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function LegacySettingsPage() {
  return (
    <AppLayout activeModule="settings-old">
      <SettingsContent />
    </AppLayout>
  );
}
