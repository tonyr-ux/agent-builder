import AppLayout from '@/app/components/AppLayout';
import { CreatedAgentsView } from '@/app/components/automation/CreatedAgentsView';

export const metadata = {
  title: 'Agents you have created · Xelix',
  description: 'Agents accepted in this workspace, ready to load into Xelix.',
};

export default function CreatedAgentsPage() {
  return (
    <AppLayout activeModule="settings">
      <CreatedAgentsView />
    </AppLayout>
  );
}
