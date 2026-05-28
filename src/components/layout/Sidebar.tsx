'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Upload,
  List,
  Settings,
  CircleDollarSign,
  Menu,
  X,
  Tags,
  LogOut,
  BarChart3,
  Eye,
  EyeOff,
  Repeat,
  Target,
  Brain,
} from 'lucide-react';
import { useSensitiveValues } from '@/components/layout/SensitiveValuesProvider';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const navItems = [
  { href: '/',               label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/reports',        label: 'Reports',           icon: BarChart3 },
  { href: '/goals',          label: 'Goals',             icon: Target },
  { href: '/journey',        label: 'Journey',           icon: Brain },
  { href: '/accounts',       label: 'Accounts',          icon: Wallet },
  { href: '/subscriptions',  label: 'Subscriptions',     icon: Repeat },
  { href: '/statements',     label: 'Statements',        icon: Upload },
  { href: '/transactions',   label: 'Transactions',      icon: List },
  { href: '/categories',     label: 'Categories',        icon: Tags },
  { href: '/settings',       label: 'Settings',          icon: Settings },
];

interface SidebarProps {
  onLogout?: () => void | Promise<void>;
}

export function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { hideSensitiveValues, toggleSensitiveValues } = useSensitiveValues();

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 rounded-lg border border-border bg-card p-2 shadow-sm lg:hidden"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5 text-foreground" />
        ) : (
          <Menu className="h-5 w-5 text-foreground" />
        )}
      </button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <Link href="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
              <CircleDollarSign className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-sidebar-foreground">Xpend</p>
              <p className="text-[11px] text-sidebar-muted-foreground">Personal finance</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground">
            Menu
          </p>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
                    )}
                  >
                    <item.icon
                      className={cn(
                        'h-4 w-4 flex-shrink-0 transition-colors',
                        isActive
                          ? 'text-sidebar-accent-foreground'
                          : 'text-sidebar-muted-foreground group-hover:text-sidebar-foreground',
                      )}
                    />
                    {item.label}
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer actions */}
        <div className="border-t border-sidebar-border px-3 py-3 space-y-0.5">
          <ThemeToggle />

          <button
            type="button"
            onClick={toggleSensitiveValues}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
          >
            {hideSensitiveValues ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            {hideSensitiveValues ? 'Show values' : 'Hide values'}
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={() => { setIsMobileMenuOpen(false); void onLogout(); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          )}

          <p className="px-3 pt-2 text-center text-[10px] text-sidebar-muted-foreground">
            © {new Date().getFullYear()} Xpend
          </p>
        </div>
      </aside>
    </>
  );
}
