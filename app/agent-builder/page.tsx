import { redirect } from 'next/navigation';

export default function AgentBuilderRedirect() {
  redirect('/settings-old?tab=agent-builder-2');
}
