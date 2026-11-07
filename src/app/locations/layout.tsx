import Sidebar from '@/components/dashboard/Sidebar';
export default function L({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen bg-gray-950"><Sidebar /><main className="flex-1 pt-14 lg:pt-0 overflow-auto"><div className="p-6">{children}</div></main></div>;
}
