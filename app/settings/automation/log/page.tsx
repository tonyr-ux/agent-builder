import { SessionLogView } from '@/app/components/automation/SessionLogView';

export const metadata = {
  title: 'Session log · Xelix',
  robots: { index: false, follow: false },
};

/**
 * Deliberately unlinked review page for the Agents workspace session log.
 * Reachable only by URL: /settings/automation/log
 */
export default function SessionLogPage() {
  return <SessionLogView />;
}
