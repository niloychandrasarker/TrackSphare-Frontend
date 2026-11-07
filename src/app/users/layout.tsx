import Sidebar from '@/components/dashboard/Sidebar';
export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 lg:ml-0 pt-14 lg:pt-0 overflow-auto"><div className="p-6">{children}</div></main>
    </div>
  );
}
