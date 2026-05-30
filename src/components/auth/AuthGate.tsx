'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button, Card, CardContent, Input, XpendLogo } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      const { data, error: sessionError } = await supabaseBrowser.auth.getSession();
      if (!isMounted) return;
      if (sessionError) setError(sessionError.message);
      setIsAuthenticated(!!data.session);
      setIsReady(true);
    };

    initializeSession();

    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setIsAuthenticated(!!session);
      setIsReady(true);
    });

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    setPassword('');
    setIsSubmitting(false);
  };

  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
    setIsAuthenticated(false);
  };

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        {/* Subtle gradient backdrop */}
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.08),transparent)]" />

        <Card className="relative w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <div className="mb-8 flex items-center gap-4">
              <XpendLogo className="h-12 w-12 rounded-2xl shadow-md shadow-primary/30" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Xpend</p>
                <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                error={error || undefined}
                required
              />
              <Button className="w-full mt-2" size="lg" type="submit" isLoading={isSubmitting}>
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onLogout={handleLogout} />
      <main className="flex-1 min-w-0 p-6 pt-20 lg:ml-64 lg:pt-6">
        {children}
      </main>
    </div>
  );
}
