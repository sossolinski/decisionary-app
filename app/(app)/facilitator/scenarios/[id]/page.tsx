// app/(app)/facilitator/scenarios/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/users";

import {
  getScenario,
  updateScenario,
  listScenarioInjects,
  createInject,
  attachInjectToScenario,
  detachScenarioInject,
  updateScenarioInject,
  type Scenario,
  type ScenarioInject,
  type Inject,
} from "@/lib/scenarios";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

function asInt(v: string) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (x: number) => String(x).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
}

function fromDatetimeLocal(v: string) {
  const s = (v ?? "").trim();
  if (!s) return null;
  try {
    return new Date(s).toISOString();
  } catch {
    return null;
  }
}

export default function FacilitatorScenarioEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [injects, setInjects] = useState<ScenarioInject[]>([]);

  // drafts – scenario
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [timezone, setTimezone] = useState("");
  const [location, setLocation] = useState("");

  const [situationType, setSituationType] = useState("");
  const [shortDescription, setShortDescription] = useState("");

  const [injured, setInjured] = useState("0");
  const [fatalities, setFatalities] = useState("0");
  const [uninjured, setUninjured] = useState("0");
  const [unknown, setUnknown] = useState("0");

  // drafts – new inject
  const [niTitle, setNiTitle] = useState("");
  const [niBody, setNiBody] = useState("");
  const [niChannel, setNiChannel] = useState("ops");
  const [niSeverity, setNiSeverity] = useState<string>("");
  const [niSenderName, setNiSenderName] = useState<string>("Facilitator");
  const [niSenderOrg, setNiSenderOrg] = useState<string>("Decisionary");
  const [niScheduledLocal, setNiScheduledLocal] = useState<string>("");

  // UI
  const [openSiId, setOpenSiId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, si] = await Promise.all([getScenario(id), listScenarioInjects(id)]);
      setScenario(s);
      setInjects(si ?? []);

      // hydrate scenario drafts
      setTitle(s?.title ?? "");
      setDescription(s?.description ?? "");

      setEventDate(s?.event_date ?? "");
      setEventTime(s?.event_time ?? "");
      setTimezone(s?.timezone ?? "");
      setLocation(s?.location ?? "");

      setSituationType(s?.situation_type ?? "");
      setShortDescription(s?.short_description ?? "");

      setInjured(String(s?.injured ?? 0));
      setFatalities(String(s?.fatalities ?? 0));
      setUninjured(String(s?.uninjured ?? 0));
      setUnknown(String(s?.unknown ?? 0));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) return router.replace("/login");
      if (role !== "facilitator") return router.replace("/participant");
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, id]);

  const sortedInjects = useMemo(() => {
    return [...injects].sort((a, b) => {
      const ao = a.order_index ?? 0;
      const bo = b.order_index ?? 0;
      if (ao !== bo) return ao - bo;
      return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    });
  }, [injects]);

  const hasChanges = useMemo(() => {
    if (!scenario) return false;
    return (
      title !== (scenario.title ?? "") ||
      description !== (scenario.description ?? "") ||
      eventDate !== (scenario.event_date ?? "") ||
      eventTime !== (scenario.event_time ?? "") ||
      timezone !== (scenario.timezone ?? "") ||
      location !== (scenario.location ?? "") ||
      situationType !== (scenario.situation_type ?? "") ||
      shortDescription !== (scenario.short_description ?? "") ||
      asInt(injured) !== (scenario.injured ?? 0) ||
      asInt(fatalities) !== (scenario.fatalities ?? 0) ||
      asInt(uninjured) !== (scenario.uninjured ?? 0) ||
      asInt(unknown) !== (scenario.unknown ?? 0)
    );
  }, [
    scenario,
    title,
    description,
    eventDate,
    eventTime,
    timezone,
    location,
    situationType,
    shortDescription,
    injured,
    fatalities,
    uninjured,
    unknown,
  ]);

  async function onSaveScenario() {
    if (!scenario) return;

    setSaving(true);
    setError(null);
    try {
      const patch: Partial<Scenario> = {
        title: title.trim() || "Untitled scenario",
        description: description.trim() || null,

        event_date: eventDate.trim() || null,
        event_time: eventTime.trim() || null,
        timezone: timezone.trim() || null,
        location: location.trim() || null,

        situation_type: situationType.trim() || null,
        short_description: shortDescription.trim() || null,

        injured: asInt(injured),
        fatalities: asInt(fatalities),
        uninjured: asInt(uninjured),
        unknown: asInt(unknown),
      };

      const updated = await updateScenario(id, patch);
      setScenario(updated);

      // sync drafts
      setTitle(updated.title ?? "");
      setDescription(updated.description ?? "");

      setEventDate(updated.event_date ?? "");
      setEventTime(updated.event_time ?? "");
      setTimezone(updated.timezone ?? "");
      setLocation(updated.location ?? "");

      setSituationType(updated.situation_type ?? "");
      setShortDescription(updated.short_description ?? "");

      setInjured(String(updated.injured ?? 0));
      setFatalities(String(updated.fatalities ?? 0));
      setUninjured(String(updated.uninjured ?? 0));
      setUnknown(String(updated.unknown ?? 0));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function onCreateScenarioInject() {
    if (!niTitle.trim() || !niBody.trim()) {
      setError("Inject title and body are required.");
      return;
    }

    setBusyKey("create-inject");
    setError(null);

    try {
      const inject = await createInject({
        title: niTitle.trim(),
        body: niBody.trim(),
        channel: niChannel.trim() || "ops",
        severity: niSeverity.trim() || null,
        sender_name: niSenderName.trim() || null,
        sender_org: niSenderOrg.trim() || null,
      });

      const scheduled_at = fromDatetimeLocal(niScheduledLocal);
      await attachInjectToScenario({
        scenarioId: id,
        injectId: inject.id,
        scheduled_at,
      });

      setNiTitle("");
      setNiBody("");
      setNiChannel("ops");
      setNiSeverity("");
      setNiSenderName("Facilitator");
      setNiSenderOrg("Decisionary");
      setNiScheduledLocal("");

      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function onDetach(siId: string) {
    if (!confirm("Detach this inject from scenario?")) return;
    setBusyKey(`detach:${siId}`);
    setError(null);
    try {
      await detachScenarioInject(siId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function onDeleteInject(injectId: string) {
    if (!confirm("Delete this inject (from injects table)? This may affect other scenarios.")) return;
    setBusyKey(`delinj:${injectId}`);
    setError(null);
    try {
      const { error } = await supabase.from("injects").delete().eq("id", injectId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function onUpdateInject(injectId: string, patch: Partial<Inject>) {
    setBusyKey(`upd:${injectId}`);
    setError(null);
    try {
      const { error } = await supabase.from("injects").update(patch).eq("id", injectId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function onReschedule(siId: string, scheduledLocal: string) {
    setBusyKey(`sched:${siId}`);
    setError(null);
    try {
      await updateScenarioInject({
        id: siId,
        scheduled_at: fromDatetimeLocal(scheduledLocal),
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyKey(null);
    }
  }

  async function onMove(siId: string, dir: -1 | 1) {
    const idx = sortedInjects.findIndex((x) => x.id === siId);
    if (idx < 0) return;

    const otherIdx = idx + dir;
    if (otherIdx < 0 || otherIdx >= sortedInjects.length) return;

    const a = sortedInjects[idx];
    const b = sortedInjects[otherIdx];

    setBusyKey(`move:${siId}`);
    setError(null);

    try {
      // swap order_index
      await Promise.all([
        updateScenarioInject({ id: a.id, order_index: b.order_index }),
        updateScenarioInject({ id: b.id, order_index: a.order_index }),
      ]);
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!scenario) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Scenario not found.</div>
        <div className="mt-3">
          <Button variant="secondary" onClick={() => router.push("/facilitator/scenarios")}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[var(--studio-max)] p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {scenario.title ?? "Scenario"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit scenario details and manage injects.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => router.push("/facilitator/scenarios")}>
            Back
          </Button>
          <Button variant="secondary" onClick={load} disabled={saving}>
            Refresh
          </Button>
          <Button variant="primary" onClick={onSaveScenario} disabled={!hasChanges || saving}>
            {saving ? "..." : "Save changes"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.06)] px-4 py-3 text-sm font-semibold text-[hsl(var(--destructive))]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Basics</CardTitle>
            <CardDescription className="text-sm">Title and description.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Title</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Description</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[88px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                placeholder="Optional…"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Event</CardTitle>
            <CardDescription className="text-sm">When and where.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Date</div>
              <Input value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Time</div>
              <Input value={eventTime} onChange={(e) => setEventTime(e.target.value)} placeholder="HH:MM" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <div className="text-sm font-semibold">Timezone</div>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g., Europe/Warsaw" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <div className="text-sm font-semibold">Location</div>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Airport / city / region…" />
            </div>
          </CardContent>
        </Card>

        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Situation</CardTitle>
            <CardDescription className="text-sm">Classification and summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Situation type</div>
              <Input value={situationType} onChange={(e) => setSituationType(e.target.value)} placeholder="e.g., Accident, Disruption, Security…" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Short description</div>
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className="min-h-[88px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                placeholder="1–2 sentences…"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Initial casualties</CardTitle>
            <CardDescription className="text-sm">Starting numbers.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-semibold">Injured</div>
              <Input value={injured} onChange={(e) => setInjured(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Fatalities</div>
              <Input value={fatalities} onChange={(e) => setFatalities(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Uninjured</div>
              <Input value={uninjured} onChange={(e) => setUninjured(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">Unknown</div>
              <Input value={unknown} onChange={(e) => setUnknown(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Injects</CardTitle>
          <CardDescription className="text-sm">
            Create, edit, reorder and schedule injects.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* NEW INJECT */}
          <div className="rounded-[var(--radius)] border border-border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">New inject</div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold">Title</div>
                <Input value={niTitle} onChange={(e) => setNiTitle(e.target.value)} />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold">Scheduled at</div>
                <Input
                  type="datetime-local"
                  value={niScheduledLocal}
                  onChange={(e) => setNiScheduledLocal(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold">Channel</div>
                <Input value={niChannel} onChange={(e) => setNiChannel(e.target.value)} placeholder="ops / inbox / pulse…" />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold">Severity</div>
                <Input value={niSeverity} onChange={(e) => setNiSeverity(e.target.value)} placeholder="low / medium / high…" />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold">Sender name</div>
                <Input value={niSenderName} onChange={(e) => setNiSenderName(e.target.value)} />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold">Sender org</div>
                <Input value={niSenderOrg} onChange={(e) => setNiSenderOrg(e.target.value)} />
              </div>

              <div className="space-y-1 md:col-span-2">
                <div className="text-sm font-semibold">Body</div>
                <textarea
                  value={niBody}
                  onChange={(e) => setNiBody(e.target.value)}
                  className="min-h-[110px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={onCreateScenarioInject}
                disabled={busyKey === "create-inject"}
              >
                {busyKey === "create-inject" ? "..." : "Create & attach"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setNiTitle("");
                  setNiBody("");
                  setNiChannel("ops");
                  setNiSeverity("");
                  setNiSenderName("Facilitator");
                  setNiSenderOrg("Decisionary");
                  setNiScheduledLocal("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* LIST */}
          {sortedInjects.length === 0 ? (
            <div className="text-sm text-muted-foreground">No injects yet.</div>
          ) : (
            <div className="space-y-2">
              {sortedInjects.map((si, idx) => {
                const inj = si.injects;
                const isOpen = openSiId === si.id;
                const isBusy =
                  busyKey?.includes(`:${si.id}`) ||
                  (inj?.id && busyKey?.includes(`:${inj.id}`)) ||
                  busyKey === `move:${si.id}`;

                const scheduledLocal = toDatetimeLocal(si.scheduled_at);

                return (
                  <div
                    key={si.id}
                    className="rounded-[var(--radius)] border border-border bg-card px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {inj?.title ?? "Untitled inject"}
                          <span className="opacity-60"> · #{si.order_index}</span>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Channel: <b>{inj?.channel ?? "—"}</b> · Severity: <b>{inj?.severity ?? "—"}</b>
                          {" · "}
                          Scheduled: <b>{si.scheduled_at ? new Date(si.scheduled_at).toLocaleString() : "immediate"}</b>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onMove(si.id, -1)}
                          disabled={idx === 0 || !!isBusy}
                          title="Move up"
                        >
                          ↑
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onMove(si.id, 1)}
                          disabled={idx === sortedInjects.length - 1 || !!isBusy}
                          title="Move down"
                        >
                          ↓
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setOpenSiId(isOpen ? null : si.id)}
                        >
                          {isOpen ? "Close" : "Edit"}
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onDetach(si.id)}
                          disabled={!!isBusy}
                        >
                          Detach
                        </Button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Title</div>
                          <Input
                            defaultValue={inj?.title ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { title: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Scheduled at</div>
                          <Input
                            type="datetime-local"
                            defaultValue={scheduledLocal}
                            onBlur={(e) => onReschedule(si.id, e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Channel</div>
                          <Input
                            defaultValue={inj?.channel ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { channel: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Severity</div>
                          <Input
                            defaultValue={inj?.severity ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { severity: e.target.value || null })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Sender name</div>
                          <Input
                            defaultValue={inj?.sender_name ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { sender_name: e.target.value || null })}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Sender org</div>
                          <Input
                            defaultValue={inj?.sender_org ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { sender_org: e.target.value || null })}
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <div className="text-sm font-semibold">Body</div>
                          <textarea
                            defaultValue={inj?.body ?? ""}
                            onBlur={(e) => inj?.id && onUpdateInject(inj.id, { body: e.target.value })}
                            className="min-h-[120px] w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="md:col-span-2 flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setOpenSiId(null)}
                          >
                            Done
                          </Button>

                          {inj?.id ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => onDeleteInject(inj.id)}
                              disabled={!!isBusy}
                            >
                              Delete inject
                            </Button>
                          ) : null}
                        </div>

                        <div className="md:col-span-2 text-xs text-muted-foreground">
                          Tip: changes are saved on field blur (click outside the field).
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {inj?.body ?? ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
