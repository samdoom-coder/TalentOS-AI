'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Bot,
  Settings,
  LogOut,
  Zap,
  Menu,
  ChevronLeft
} from 'lucide-react';
import styles from './Sidebar.module.css';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/dashboard/personas', label: 'AI Personas', icon: Bot },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Dynamically update the global CSS variable for sidebar width
    if (isCollapsed) {
      document.documentElement.style.setProperty('--sidebar-width', '80px');
    } else {
      document.documentElement.style.setProperty('--sidebar-width', '260px');
    }
    // Cleanup on unmount (optional but good practice)
    return () => {
      document.documentElement.style.setProperty('--sidebar-width', '260px');
    };
  }, [isCollapsed]);

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.logo}>
        <div className={styles.logoContent}>
          <div className={styles.logoIcon}>
            <Zap size={22} />
          </div>
          {!isCollapsed && <span className={styles.logoText}>HireAI</span>}
        </div>
        <button className={styles.toggleBtn} onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navSection}>
          {!isCollapsed && <span className={styles.navSectionLabel}>Main</span>}
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <item.icon size={18} />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={styles.footer}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>HR</div>
          {!isCollapsed && (
            <div className={styles.userDetails}>
              <span className={styles.userName}>Admin User</span>
              <span className={styles.userRole}>Recruiter</span>
            </div>
          )}
        </div>
        <Link href="/" className={styles.logoutBtn} title="Log Out">
          <LogOut size={16} />
        </Link>
      </div>
    </aside>
  );
}
