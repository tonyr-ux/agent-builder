import { redirect } from 'next/navigation';

/** The Agents workspace is the settings landing page; the previous tabs live at /settings-old. */
export default function SettingsPage() {
  redirect('/settings/automation');
}
