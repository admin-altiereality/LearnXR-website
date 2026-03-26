/**
 * WhatsApp-style inbox using Twilio Conversations JS SDK + staff APIs for CRM metadata and templates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Client, Conversation, Message } from '@twilio/conversations';
import { FaComments, FaPaperPlane, FaUserCircle } from 'react-icons/fa';
import { learnXRFontStyle, TrademarkSymbol } from '../../Components/LearnXRTypography';
import { Button } from '../../Components/ui/button';
import { Input } from '../../Components/ui/input';
import { Label } from '../../Components/ui/label';
import { Textarea } from '../../Components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../Components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../Components/ui/card';
import { Badge } from '../../Components/ui/badge';
import { toast } from 'react-toastify';
import {
  fetchConversationSummaries,
  fetchConversationsToken,
  getConversationMeta,
  joinInboxConversation,
  patchConversationMeta,
  sendConversationMessage,
  sendWhatsAppTemplate,
  type ConversationSummaryDto,
  type LeadStatus,
  type WhatsAppInboxMetaDto,
} from '../../services/twilioInboxService';
import {
  attachTwilioConversationsLifecycle,
  connectTwilioConversationsClient,
  disconnectTwilioConversationsClient,
  formatTwilioError,
  type TwilioConnErr,
} from '../../services/twilioConversationsSession';

function statusLabel(s?: LeadStatus): string {
  if (!s) return 'New';
  if (s === 'follow-up') return 'Follow-up';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(d?: Date): string {
  if (!d) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const MAX_SOFT_RETRIES = 5;

const WhatsAppInbox = () => {
  const clientRef = useRef<Client | null>(null);
  const hadConnectedRef = useRef(false);
  const connectionErrorRetryRef = useRef(0);
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [connecting, setConnecting] = useState(true);
  const [sessionSuspended, setSessionSuspended] = useState(false);
  const [softReconnectMsg, setSoftReconnectMsg] = useState<string | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<ConversationSummaryDto[]>([]);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [twilioClient, setTwilioClient] = useState<Client | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [resolvingThread, setResolvingThread] = useState(false);
  const [selectedSid, setSelectedSid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [compose, setCompose] = useState('');
  const [sending, setSending] = useState(false);
  const [meta, setMeta] = useState<WhatsAppInboxMetaDto | null>(null);
  const [metaDraft, setMetaDraft] = useState<Partial<WhatsAppInboxMetaDto>>({});
  const [savingMeta, setSavingMeta] = useState(false);
  const [templateTo, setTemplateTo] = useState('');
  const [templateContentSid, setTemplateContentSid] = useState('');
  const [templateVarsJson, setTemplateVarsJson] = useState('{}');
  /** Matches Twilio session author for staff messages (shared inbox identity). */
  const [inboxAuthorIdentity, setInboxAuthorIdentity] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshSummaries = useCallback(async () => {
    try {
      const { items, emptyHint: hint } = await fetchConversationSummaries();
      setSummaries(items);
      setEmptyHint(hint);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to load conversation list');
    }
  }, []);

  const selectedSummary = useMemo(
    () => summaries.find((s) => s.sid === selectedSid) || null,
    [summaries, selectedSid],
  );

  const loadMessages = useCallback(async (conv: Conversation) => {
    setLoadingMessages(true);
    try {
      const chronological: Message[] = [];
      let page = await conv.getMessages(40);
      for (;;) {
        chronological.push(...page.items);
        if (!page.hasNextPage) break;
        page = await page.nextPage();
      }
      chronological.reverse();
      setMessages(chronological);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to load messages');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const refreshMeta = useCallback(async (sid: string) => {
    try {
      const { meta: m } = await getConversationMeta(sid);
      setMeta(m);
      setMetaDraft({
        leadStatus: m?.leadStatus || 'new',
        notes: m?.notes || '',
        email: m?.email || '',
        budget: m?.budget || '',
        humanHandoffRequested: m?.humanHandoffRequested ?? false,
        pendingDemoForm: m?.pendingDemoForm ?? false,
      });
      if (m?.waFrom) {
        setTemplateTo((prev) => (prev.trim() ? prev : m.waFrom || prev));
      }
    } catch (e: any) {
      setMeta(null);
      setMetaDraft({});
      console.warn('Meta load:', e?.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let client: Client | null = null;

    const scheduleClientRecycle = () => {
      if (cancelled) return;
      setConnError(null);
      setSoftReconnectMsg((prev) => prev || 'Refreshing Twilio session…');
      window.setTimeout(() => {
        if (!cancelled) setConnectAttempt((n) => n + 1);
      }, 400);
    };

    (async () => {
      try {
        if (hadConnectedRef.current) {
          setSessionSuspended(true);
          setConversations([]);
          setSelectedSid(null);
          setMessages([]);
          setMeta(null);
          setMetaDraft({});
        } else {
          setConnecting(true);
        }
        setConnError(null);

        const { token, region, identity } = await fetchConversationsToken();
        if (!cancelled) setInboxAuthorIdentity(identity);
        if (cancelled) return;
        client = await connectTwilioConversationsClient(token, region);
        clientRef.current = client;
        if (!cancelled) setTwilioClient(client);

        attachTwilioConversationsLifecycle({
          client,
          isActive: () => !cancelled,
          onTokenRefreshNeedsRecycle: scheduleClientRecycle,
        });

        client.on('conversationAdded', () => {
          void refreshSummaries();
        });
        client.on('conversationUpdated', () => {
          void refreshSummaries();
        });
        client.on(Client.connectionError, (data: TwilioConnErr) => {
          if (cancelled) return;
          const msg = formatTwilioError('Twilio connection lost', data);
          if (data.terminal) {
            connectionErrorRetryRef.current = 0;
            setSoftReconnectMsg(null);
            setConnError(msg);
            toast.error(msg);
            return;
          }
          connectionErrorRetryRef.current += 1;
          if (connectionErrorRetryRef.current > MAX_SOFT_RETRIES) {
            setSoftReconnectMsg(null);
            setConnError(msg);
            toast.error(msg);
            return;
          }
          const attempt = connectionErrorRetryRef.current;
          const delayMs = Math.min(8000, 1000 * 2 ** (attempt - 1));
          setSoftReconnectMsg(
            `Connection interrupted; retry ${attempt}/${MAX_SOFT_RETRIES} in ${Math.round(delayMs / 1000)}s…`,
          );
          toast.warn(`Twilio reconnecting (${attempt}/${MAX_SOFT_RETRIES})…`);
          window.setTimeout(() => {
            if (cancelled) return;
            setConnectAttempt((n) => n + 1);
          }, delayMs);
        });
        await refreshSummaries();
        if (!cancelled) {
          hadConnectedRef.current = true;
          connectionErrorRetryRef.current = 0;
          setSoftReconnectMsg(null);
          setSessionSuspended(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setSoftReconnectMsg(null);
          setSessionSuspended(false);
          setConnError(e?.message || 'Could not connect to Twilio');
          toast.error(e?.message || 'Twilio connection failed');
        }
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
      setTwilioClient(null);
      disconnectTwilioConversationsClient(client);
      clientRef.current = null;
    };
  }, [refreshSummaries, connectAttempt]);

  useEffect(() => {
    if (!twilioClient || connError || sessionSuspended) return;
    const t = window.setInterval(() => {
      void refreshSummaries();
    }, 20000);
    return () => window.clearInterval(t);
  }, [twilioClient, connError, sessionSuspended, refreshSummaries]);

  useEffect(() => {
    if (!selectedSid || !twilioClient || sessionSuspended) {
      setActiveConversation(null);
      return;
    }
    let cancelled = false;
    setResolvingThread(true);
    void (async () => {
      try {
        await joinInboxConversation(selectedSid);
        const conv = await twilioClient.getConversationBySid(selectedSid);
        if (!cancelled) setActiveConversation(conv);
      } catch (e: any) {
        if (!cancelled) {
          setActiveConversation(null);
          toast.error(e?.message || 'Could not open thread');
        }
      } finally {
        if (!cancelled) setResolvingThread(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSid, twilioClient, sessionSuspended]);

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      setMeta(null);
      return;
    }
    loadMessages(activeConversation);
    refreshMeta(activeConversation.sid);
    const poll = window.setInterval(() => {
      refreshMeta(activeConversation.sid);
      loadMessages(activeConversation);
    }, 12000);
    return () => window.clearInterval(poll);
  }, [activeConversation, loadMessages, refreshMeta]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSend = async () => {
    const text = compose.trim();
    if (!selectedSid || !text || sessionSuspended) return;
    setSending(true);
    try {
      await sendConversationMessage(selectedSid, text);
      setCompose('');
      if (activeConversation) await loadMessages(activeConversation);
      void refreshSummaries();
    } catch (e: any) {
      toast.error(e?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const onSaveMeta = async () => {
    if (!selectedSid || sessionSuspended) return;
    setSavingMeta(true);
    try {
      const { meta: m } = await patchConversationMeta(selectedSid, {
        leadStatus: (metaDraft.leadStatus as LeadStatus) || 'new',
        notes: metaDraft.notes,
        email: metaDraft.email,
        budget: metaDraft.budget,
        humanHandoffRequested: metaDraft.humanHandoffRequested,
        pendingDemoForm: metaDraft.pendingDemoForm,
      });
      setMeta(m);
      toast.success('Lead details saved');
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSavingMeta(false);
    }
  };

  const onSendTemplate = async () => {
    if (sessionSuspended) return;
    if (!templateTo.trim() || !templateContentSid.trim()) {
      toast.error('To and Content SID required');
      return;
    }
    let vars: Record<string, string> | undefined;
    try {
      const parsed = JSON.parse(templateVarsJson || '{}');
      if (parsed && typeof parsed === 'object') vars = parsed as Record<string, string>;
    } catch {
      toast.error('Content variables must be valid JSON object');
      return;
    }
    try {
      await sendWhatsAppTemplate({
        to: templateTo.trim(),
        contentSid: templateContentSid.trim(),
        contentVariables: vars,
      });
      toast.success('Template queued');
      void refreshSummaries();
    } catch (e: any) {
      toast.error(e?.message || 'Template failed');
    }
  };

  if (connecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground text-sm">Connecting to Conversations…</p>
        </div>
      </div>
    );
  }

  if (connError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-lg border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Inbox unavailable</CardTitle>
            <CardDescription>{connError}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setConnError(null);
                setConnectAttempt((n) => n + 1);
              }}
            >
              Retry connection
            </Button>
            <p>
              If the error mentions your profile or Firestore, add{' '}
              <code className="text-xs">users/&lt;uid&gt;</code> with role{' '}
              <code className="text-xs">associate</code>, <code className="text-xs">admin</code>, or{' '}
              <code className="text-xs">superadmin</code>.
            </p>
            <p>
              For Twilio errors, set API Key, Conversations Service SID, and webhooks on the deployed{' '}
              <code className="text-xs">api</code> function. Local dev:{' '}
              <code className="text-xs">VITE_API_BASE_URL=http://localhost:5002/api</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {softReconnectMsg && !connError && (
        <div
          className="shrink-0 border-b border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100 flex items-center gap-2"
          role="status"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span>{softReconnectMsg}</span>
        </div>
      )}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0 bg-card/40">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
          <FaComments className="text-primary text-lg" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={learnXRFontStyle}>
            <span className="text-foreground">Learn</span>
            <span className="text-primary">XR</span>
            <TrademarkSymbol />
          </h1>
          <p className="text-xs text-muted-foreground">WhatsApp inbox (Twilio Conversations)</p>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar — conversations */}
        <aside className="w-full max-w-[320px] border-r border-border flex flex-col bg-card/30">
          <div className="p-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Conversations
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessionSuspended ? (
              <p className="p-4 text-sm text-muted-foreground">Restoring Twilio connection…</p>
            ) : summaries.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground space-y-2">
                <p>No conversations in your Twilio Conversations service yet.</p>
                {emptyHint && <p className="text-xs leading-relaxed opacity-90">{emptyHint}</p>}
                <p className="text-xs">
                  Messaging logs in Twilio (
                  <a
                    href="https://console.twilio.com/us1/monitor/logs/sms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    Monitor → Logs → Messaging
                  </a>
                  ) show API traffic; this inbox lists <strong>Conversations</strong> only after WhatsApp is
                  integrated with your IS… service.
                </p>
              </div>
            ) : (
              summaries.map((c) => {
                const active = c.sid === selectedSid;
                const title = c.friendlyName || c.sid.slice(0, 10);
                const dt = c.dateUpdated ? new Date(c.dateUpdated) : undefined;
                return (
                  <button
                    key={c.sid}
                    type="button"
                    onClick={() => setSelectedSid(c.sid)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border/60 transition-colors ${
                      active ? 'bg-primary/15 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {statusLabel(undefined)}
                      </Badge>
                    </div>
                    {dt && !Number.isNaN(dt.getTime()) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formatTime(dt)}</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Chat */}
        <section className="flex-1 flex flex-col min-w-0 bg-background">
          {sessionSuspended ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm px-4 text-center">
              Restoring connection…
            </div>
          ) : !selectedSid ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation
            </div>
          ) : resolvingThread || !activeConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm px-4 text-center gap-2">
              {resolvingThread ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                  <p>Opening thread…</p>
                </>
              ) : (
                <p>Could not load this thread. Try another or check Twilio Conversations setup.</p>
              )}
            </div>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-muted/20">
                <FaUserCircle className="text-muted-foreground text-xl" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {activeConversation.friendlyName ||
                      selectedSummary?.friendlyName ||
                      activeConversation.sid}
                  </p>
                  {meta?.waFrom && (
                    <p className="text-xs text-muted-foreground truncate">{meta.waFrom}</p>
                  )}
                </div>
              </div>

              {meta?.humanHandoffRequested && (
                <div className="mx-4 mt-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  Human agent requested — prioritize this thread.
                </div>
              )}
              {meta?.pendingDemoForm && (
                <div className="mx-4 mt-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                  Demo interest detected — capture details in the lead panel.
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <p className="text-sm text-muted-foreground">Loading messages…</p>
                ) : (
                  messages.map((m, idx) => {
                    const mine =
                      !!inboxAuthorIdentity && m.author === inboxAuthorIdentity;
                    return (
                      <div
                        key={`${m.sid || idx}-${m.dateCreated?.getTime?.() || idx}`}
                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[min(85%,520px)] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            mine
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted text-foreground rounded-bl-md border border-border'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p
                            className={`text-[10px] mt-1 opacity-70 ${
                              mine ? 'text-primary-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {m.author} · {formatTime(m.dateCreated)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-border flex gap-2 bg-card/40">
                <Input
                  value={compose}
                  onChange={(e) => setCompose(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1"
                  disabled={sessionSuspended}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={onSend}
                  disabled={sending || !compose.trim() || sessionSuspended}
                >
                  <FaPaperPlane className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </section>

        {/* Lead + templates */}
        <aside className="w-full max-w-[340px] border-l border-border flex flex-col bg-card/30 overflow-y-auto">
          <div className="p-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Lead &amp; CRM
          </div>
          {sessionSuspended ? (
            <p className="p-4 text-sm text-muted-foreground">Lead panel available after connection restores.</p>
          ) : !selectedSid ? (
            <p className="p-4 text-sm text-muted-foreground">Select a conversation to edit lead fields.</p>
          ) : (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={(metaDraft.leadStatus as string) || 'new'}
                  onValueChange={(v) =>
                    setMetaDraft((d) => ({ ...d, leadStatus: v as LeadStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={metaDraft.email || ''}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, email: e.target.value }))}
                  placeholder="lead@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Budget / notes</Label>
                <Textarea
                  value={metaDraft.notes || ''}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Internal notes"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Budget (short)</Label>
                <Input
                  value={metaDraft.budget || ''}
                  onChange={(e) => setMetaDraft((d) => ({ ...d, budget: e.target.value }))}
                  placeholder="$5k–10k"
                />
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!metaDraft.humanHandoffRequested}
                    onChange={(e) =>
                      setMetaDraft((d) => ({ ...d, humanHandoffRequested: e.target.checked }))
                    }
                  />
                  Handoff
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!metaDraft.pendingDemoForm}
                    onChange={(e) =>
                      setMetaDraft((d) => ({ ...d, pendingDemoForm: e.target.checked }))
                    }
                  />
                  Demo pending
                </label>
              </div>
              <Button className="w-full" onClick={onSaveMeta} disabled={savingMeta}>
                Save lead details
              </Button>

              <Card className="border-border">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">WhatsApp template</CardTitle>
                  <CardDescription className="text-xs">
                    Approved Content SID; variables as JSON object.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <Input
                    placeholder="To: whatsapp:+15551234567"
                    value={templateTo}
                    onChange={(e) => setTemplateTo(e.target.value)}
                  />
                  <Input
                    placeholder="Content SID (HX...)"
                    value={templateContentSid}
                    onChange={(e) => setTemplateContentSid(e.target.value)}
                  />
                  <Textarea
                    rows={2}
                    className="font-mono text-xs"
                    placeholder='{"1": "Name"}'
                    value={templateVarsJson}
                    onChange={(e) => setTemplateVarsJson(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={onSendTemplate}
                    disabled={sessionSuspended}
                  >
                    Send template
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default WhatsAppInbox;
