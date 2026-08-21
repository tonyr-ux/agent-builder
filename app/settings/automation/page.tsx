import AppLayout from '@/app/components/AppLayout';
import { AutomationWorkspacePanel } from '@/app/components/automation/AutomationWorkspace';

export const metadata = {
  title: 'Agents · Xelix',
  description: 'Set up Xelix automations by talking them through with the Configuration Agent.',
};

export default function AutomationPage() {
  return (
    <AppLayout activeModule="settings">
      <AutomationWorkspacePanel />
    </AppLayout>
  );
}
