import Sidebar from '@/components/Sidebar';
import styles from './layout.module.css';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <Sidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
