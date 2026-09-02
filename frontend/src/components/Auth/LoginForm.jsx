/**
 * Login form with dual auth: Email/Password or Cookie-based login
 */
import React, { useState } from 'react';
import {
  ArrowLeftRight, ArrowRight, Bot, ChartColumn, Cookie, HelpCircle, KeyRound,
  Loader2, MessageSquare, TriangleAlert,
} from 'lucide-react';
import { authAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea, Label } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PitchBackdrop } from '@/components/ui/football';

const FEATURES = [
  { icon: Bot, label: 'AI transfer suggestions' },
  { icon: ChartColumn, label: 'Fixture & form analysis' },
  { icon: MessageSquare, label: 'Interactive chat advisor' },
  { icon: ArrowLeftRight, label: 'Execute transfers in-app' },
];

const LoginForm = ({ onLoginSuccess }) => {
  const [managerId, setManagerId] = useState('');
  const [fplCookie, setFplCookie] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [loginMethod, setLoginMethod] = useState('credentials'); // 'credentials' or 'cookie'

  const handleCredentialLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await authAPI.loginWithCredentials(email, password);
      if (result.success) {
        onLoginSuccess(result.manager_id, result.cookie);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed. Check your credentials.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleCookieLogin = async (e) => {
    e.preventDefault();
    if (!managerId || !fplCookie) {
      setError('Please provide both Manager ID and FPL Cookie');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await authAPI.login(fplCookie, managerId);
      if (result.success) {
        onLoginSuccess(managerId, fplCookie);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed. Check your cookie.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const submitButton = (label) => (
    <Button type="submit" size="lg" className="w-full" disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="animate-spin" strokeWidth={2} />
          Connecting…
        </>
      ) : (
        <>
          {label}
          <ArrowRight strokeWidth={2} />
        </>
      )}
    </Button>
  );

  return (
    <div className="relative min-h-screen bg-background">
      <PitchBackdrop />
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
        <header className="stagger-item text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            FPL<span className="text-primary"> Agent</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your AI assistant for Fantasy Premier League
          </p>
        </header>

        <Card className="stagger-item">
          <CardContent className="space-y-4 p-5">
            <Tabs
              value={loginMethod}
              onValueChange={(v) => {
                setLoginMethod(v);
                setError('');
              }}
            >
              <TabsList className="w-full [&>*]:flex-1">
                <TabsTrigger value="credentials">
                  <KeyRound strokeWidth={2} /> Email & password
                </TabsTrigger>
                <TabsTrigger value="cookie">
                  <Cookie strokeWidth={2} /> Cookie
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {loginMethod === 'credentials' && (
              <form onSubmit={handleCredentialLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fpl-email">FPL email</Label>
                  <Input
                    id="fpl-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fpl-password">FPL password</Label>
                  <Input
                    id="fpl-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs leading-relaxed text-destructive ring-1 ring-destructive/25">
                    <TriangleAlert className="mt-px size-4 shrink-0" strokeWidth={2} />
                    {error}
                  </div>
                )}
                {submitButton('Connect to FPL')}
              </form>
            )}

            {loginMethod === 'cookie' && (
              <form onSubmit={handleCookieLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="manager-id">Manager ID</Label>
                  <Input
                    id="manager-id"
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    placeholder="e.g. 123456"
                    inputMode="numeric"
                  />
                  <p className="text-[0.68rem] leading-relaxed text-muted-foreground">
                    From your FPL URL: fantasy.premierleague.com/entry/
                    <strong className="text-foreground">123456</strong>/event/1
                  </p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fpl-cookie">FPL cookie</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setShowHelp(!showHelp)}
                      aria-label="How to find your cookie"
                    >
                      <HelpCircle strokeWidth={2} />
                    </Button>
                  </div>
                  <Textarea
                    id="fpl-cookie"
                    value={fplCookie}
                    onChange={(e) => setFplCookie(e.target.value)}
                    placeholder="Paste your full FPL cookie string here…"
                    rows={3}
                  />
                </div>
                {showHelp && (
                  <div className="rounded-md bg-secondary/60 p-3 text-[0.7rem] leading-relaxed text-secondary-foreground">
                    <strong>How to get your FPL cookie</strong>
                    <ol className="ml-4 mt-1 list-decimal space-y-0.5">
                      <li>
                        Log in to{' '}
                        <a
                          href="https://fantasy.premierleague.com"
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary underline-offset-2 hover:underline"
                        >
                          fantasy.premierleague.com
                        </a>
                      </li>
                      <li>Open DevTools (F12) → Application → Cookies</li>
                      <li>Copy all cookie values</li>
                    </ol>
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs leading-relaxed text-destructive ring-1 ring-destructive/25">
                    <TriangleAlert className="mt-px size-4 shrink-0" strokeWidth={2} />
                    {error}
                  </div>
                )}
                {submitButton('Connect to FPL')}
              </form>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="stagger-item flex items-center gap-2 rounded-md bg-card p-3 shadow-raised ring-1 ring-border/60"
            >
              <Icon className="size-4 shrink-0 text-primary" strokeWidth={2} />
              <span className="text-[0.7rem] font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
