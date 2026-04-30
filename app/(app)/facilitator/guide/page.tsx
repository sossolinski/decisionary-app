"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Compass,
  PlayCircle,
  Radio,
  Sparkles,
  Wrench,
} from "lucide-react";

import Collapsible from "@/app/components/Collapsible";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

const jumpLinks = [
  { id: "first-login", label: "First login" },
  { id: "prepare", label: "Prepare" },
  { id: "launch", label: "Launch" },
  { id: "first-rehearsal", label: "First rehearsal" },
  { id: "first-live", label: "First live" },
  { id: "run", label: "Run" },
  { id: "review", label: "Review" },
  { id: "pitfalls", label: "Pitfalls" },
];

const firstRunChecklist = [
  "Choose the active organization in Workspace before you create anything.",
  "Create one simple scenario first: basics, injects, then only the minimum rule logic you actually need.",
  "Run that scenario once in rehearsal mode before you invite anyone into a live session.",
  "Use review after the run to check if the exercise flow made sense before you scale it up.",
];

const roles = [
  {
    title: "Facilitator",
    body: "Builds scenarios, launches sessions, releases injects, guides the live run, and reviews what happened afterwards.",
  },
  {
    title: "Participant",
    body: "Joins a live session and responds to the exercise through the participant or session runtime view.",
  },
  {
    title: "Admin",
    body: "Manages organizations, workspace access, and paid live-session entitlements when needed.",
  },
];

const scenarioChecklist = [
  "Start in Scenario library and create a new scenario draft with a clear title.",
  "Fill Basics, Event, Situation, and starting casualty data so the session opens with context.",
  "Add injects in the order you want them to appear. Use T+ minutes for scheduled pressure.",
  "Use rules only where they genuinely improve realism, for example to create follow-up tasks or consequences after a decision.",
  "Dry-run the scenario once before you rely on it for a live exercise.",
];

const sessionChecklist = [
  "Use rehearsal if you want to test the full flow alone before the live run.",
  "Use live only when your organization has access and you want real participants to join.",
  "Pick the scenario, name the session clearly, then start it when the team is ready.",
  "For live sessions, share join code or manage access through roster.",
];

const runtimeChecklist = [
  "Watch Inbox for operational updates and Pulse for fast-moving claims or public-information pressure.",
  "Select one update at a time and record the next clear step instead of over-explaining every move.",
  "Use COP to keep the shared situation picture current.",
  "Use Facilitator tools to release injects, run manual rules, and inspect runtime traces when something feels off.",
  "Keep the pace believable: not every update needs escalation, and not every rule needs to fire.",
];

const reviewChecklist = [
  "Open session review after the run or during a pause if you want to inspect the timeline so far.",
  "Filter by source or action type when you want a tighter after-action discussion.",
  "Read the session by inject group, not only as isolated actions.",
  "Use export when you need a portable review artifact outside the app.",
];

const rehearsalPath = [
  "Open Scenarios and build one small exercise with only a few injects.",
  "Go to Sessions and create a rehearsal from that scenario.",
  "Start the session and use facilitator tools to release injects one by one.",
  "Watch how Inbox, Pulse, tasks, and consequences behave in the live room.",
  "Finish the run and open Review to see whether the flow was coherent.",
];

const livePath = [
  "Confirm your organization and live entitlement before you create the run.",
  "Create the live session with the right participant cap.",
  "Share join code or assign people through roster before starting.",
  "Start the session only when the team is ready to receive T+ inject timing.",
  "Use Review afterwards to prepare the after-action discussion and export.",
];

const pitfalls = [
  {
    title: "The runtime does not seem to react",
    body: "Check whether the session is actually live. Rule evaluation, overdue processing, and scheduled runtime behavior are intentionally constrained to live runs.",
  },
  {
    title: "An inject did not appear when expected",
    body: "Check the inject timing. Scenario injects now use release offset minutes from session start, so the session needs a started clock before T+ scheduling makes sense.",
  },
  {
    title: "Pulse and Inbox feel different",
    body: "That is intentional. Inbox is the broader update feed. Pulse is the tighter stream for claims and public-facing pressure that often needs confirm or dismiss style handling.",
  },
  {
    title: "Review feels empty or incomplete",
    body: "Review depends on actual session actions. If the team has not recorded decisions or actions yet, the review will naturally stay light.",
  },
  {
    title: "Rules are making the exercise noisy",
    body: "Pull back to the simplest scenario that still teaches something. Too many automatic consequences can make the exercise feel chaotic rather than realistic.",
  },
];

function SectionCard({
  id,
  eyebrow,
  title,
  summary,
  icon,
  children,
  ctas,
}: {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  ctas?: Array<{ href: string; label: string; variant?: "default" | "secondary" | "outline" | "ghost" }>;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="overflow-hidden">
        <CardContent className="relative pt-5 pb-5 md:pt-6 md:pb-6">
          <div className="relative space-y-5">
            <div className="space-y-2">
              <div className="ui-eyebrow">
                {icon}
                {eyebrow}
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
                <p className="max-w-3xl text-sm leading-6 text-[color:var(--studio-muted)]">{summary}</p>
              </div>
            </div>

            <div>{children}</div>

            {ctas?.length ? (
              <div className="flex flex-wrap gap-2">
                {ctas.map((cta) => (
                  <Button key={`${id}-${cta.href}-${cta.label}`} asChild variant={cta.variant ?? "secondary"}>
                    <Link href={cta.href}>{cta.label}</Link>
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ChecklistCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="h-full border border-[var(--studio-border)] bg-[var(--studio-surface)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
            <span>{item}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function FacilitatorGuidePage() {
  const [pitfallsOpen, setPitfallsOpen] = useState(true);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--card)/0.94))]">
        <CardContent className="relative pt-5 pb-5 md:pt-6 md:pb-6">
          <div className="relative space-y-5">
            <div className="ui-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Decisionary manual
            </div>

            <div className="space-y-3">
              <h1 className="text-[30px] font-semibold tracking-tight">Step-by-step guide for your first real run in Decisionary.</h1>
              <p className="max-w-4xl text-sm leading-6 text-[color:var(--studio-muted)]">
                This manual is based on the actual facilitator flow in the app: prepare a scenario, create a session,
                run the exercise from the live room, then review the timeline afterwards. If you have just logged in for
                the first time, start here and move section by section.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/facilitator">
                  Back to overview
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/facilitator/scenarios">Start with scenarios</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/facilitator/sessions#create-session">Jump to create session</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <ChecklistCard title="Your first 30 minutes" items={firstRunChecklist} />

            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Who uses what</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {roles.map((role) => (
                  <div key={role.title} className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">{role.title}</div>
                    <div className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{role.body}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <SectionCard
            id="first-login"
            eyebrow="First login"
            title="Start by orienting yourself in the workspace."
            summary="The first thing to check is not the scenario editor. It is the workspace context: which organization is active, whether you can facilitate, and whether you are aiming for rehearsal or live exercise work."
            icon={<Compass className="h-3.5 w-3.5" />}
            ctas={[
              { href: "/facilitator/workspace", label: "Open workspace", variant: "secondary" },
              { href: "/settings", label: "Open profile settings", variant: "outline" },
            ]}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <ChecklistCard
                title="What to do first"
                items={[
                  "Open Workspace and confirm you are operating in the right organization.",
                  "Make sure you actually have facilitator access before you plan a run.",
                  "Decide whether you are preparing a solo rehearsal or a live exercise with participants.",
                ]}
              />
              <Card className="border border-[var(--studio-border)] bg-[var(--studio-surface)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">What matters here</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  <p>
                    Workspace is where organizational context lives. If the wrong organization is active, the rest of your
                    work will feel confusing because scenarios, sessions, and participant access all depend on it.
                  </p>
                  <p>
                    If you are running your very first exercise, start with rehearsal. It lets you test the full session flow
                    without coordinating real participants or worrying about live entitlement limits.
                  </p>
                </CardContent>
              </Card>
            </div>
          </SectionCard>

          <SectionCard
            id="prepare"
            eyebrow="Prepare"
            title="Build a scenario before you build pressure."
            summary="The scenario editor is where the exercise gets its shape. Good scenarios usually start simple: clear setup, believable injects, only enough rule logic to support realism."
            icon={<BookOpen className="h-3.5 w-3.5" />}
            ctas={[
              { href: "/facilitator/scenarios", label: "Open scenario library", variant: "secondary" },
            ]}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <ChecklistCard title="Scenario building checklist" items={scenarioChecklist} />

              <Card className="border border-[var(--studio-border)] bg-[var(--studio-surface)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">How the scenario editor maps to the app</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  <p>
                    Use <strong>Basics</strong>, <strong>Event</strong>, and <strong>Situation</strong> to define the starting picture.
                    That content later feeds the live session context and COP.
                  </p>
                  <p>
                    Use <strong>Injects</strong> to decide what the team will receive and when. Scheduled injects are based on
                    minutes from session start, not an absolute wall-clock datetime.
                  </p>
                  <p>
                    Use <strong>Rules</strong> when you want the engine to react to events such as released injects, recorded
                    decisions, overdue tasks, or manual triggers. Keep rules sparse at first so the run stays legible.
                  </p>
                </CardContent>
              </Card>
            </div>
          </SectionCard>

          <SectionCard
            id="launch"
            eyebrow="Launch"
            title="Turn a scenario into a session."
            summary="Sessions are where the designed scenario becomes an actual run. The session library lets you create rehearsal or live runs, return to earlier runs, restart them, and open review later."
            icon={<PlayCircle className="h-3.5 w-3.5" />}
            ctas={[
              { href: "/facilitator/sessions", label: "Open sessions", variant: "secondary" },
              { href: "/facilitator/sessions#create-session", label: "Go to create panel", variant: "outline" },
            ]}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <ChecklistCard title="Session launch checklist" items={sessionChecklist} />

              <Card className="border border-[var(--studio-border)] bg-[var(--studio-surface)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Rehearsal vs live</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  <p>
                    <strong>Rehearsal</strong> is for solo testing. It runs the session logic without participant joins.
                  </p>
                  <p>
                    <strong>Live exercise</strong> is for real participants. It depends on organization access and a selected
                    participant tier, and can expose roster and join code flows.
                  </p>
                  <p>
                    The most reliable pattern is simple: build the scenario, rehearse it once, then launch the live run only
                    when the flow already feels coherent.
                  </p>
                </CardContent>
              </Card>
            </div>
          </SectionCard>

          <SectionCard
            id="first-rehearsal"
            eyebrow="First rehearsal"
            title="Use rehearsal as your safe first full-system test."
            summary="If you only do one thing before the first real exercise, do this. Rehearsal lets you validate scenario timing, update flow, Pulse handling, rule behavior, and review quality without adding participant complexity."
            icon={<Wrench className="h-3.5 w-3.5" />}
            ctas={[
              { href: "/facilitator/sessions#create-session", label: "Create rehearsal", variant: "secondary" },
              { href: "/facilitator/scenarios", label: "Adjust scenario first", variant: "outline" },
            ]}
          >
            <ChecklistCard title="Rehearsal path" items={rehearsalPath} />
          </SectionCard>

          <SectionCard
            id="first-live"
            eyebrow="First live exercise"
            title="Move into live only when the exercise logic already feels stable."
            summary="Live is where roster, join code, entitlement, and actual participant behavior all come into play. The best experience is to arrive here after at least one good rehearsal run."
            icon={<Building2 className="h-3.5 w-3.5" />}
            ctas={[
              { href: "/facilitator/sessions#create-session", label: "Create live session", variant: "secondary" },
              { href: "/facilitator/workspace", label: "Check workspace first", variant: "outline" },
            ]}
          >
            <ChecklistCard title="Live path" items={livePath} />
          </SectionCard>

          <SectionCard
            id="run"
            eyebrow="Run"
            title="Operate from the live room one clear decision at a time."
            summary="The session runtime is the operational center. Inbox and Pulse bring in updates, the selected-update panel captures the next step, COP keeps the shared picture current, and facilitator tools let you steer the engine."
            icon={<Radio className="h-3.5 w-3.5" />}
            ctas={[
              { href: "/facilitator/sessions", label: "Open session library", variant: "secondary" },
              { href: "/facilitator", label: "Back to facilitator overview", variant: "outline" },
            ]}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <ChecklistCard title="Live run checklist" items={runtimeChecklist} />

              <Card className="border border-[var(--studio-border)] bg-[var(--studio-surface)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">How the live room is structured</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  <p>
                    <strong>Inbox</strong> is the wider stream of incoming updates. <strong>Pulse</strong> is the tighter stream for
                    fast claims and public-information pressure.
                  </p>
                  <p>
                    The <strong>Selected update</strong> panel is where you record the next operational step. Keep that decision clear
                    and lightweight. You do not need a long note every time.
                  </p>
                  <p>
                    <strong>Facilitator tools</strong> let you release injects, process overdue task pressure, run manual rules, and
                    inspect runtime traces when you need to debug the session engine.
                  </p>
                  <p>
                    <strong>COP</strong> is the shared situation picture. Use it to keep the session grounded in a coherent operational narrative.
                  </p>
                </CardContent>
              </Card>
            </div>
          </SectionCard>

          <SectionCard
            id="review"
            eyebrow="Review"
            title="Use review to see whether the exercise actually made sense."
            summary="Review is not just an export screen. It is the place where you check if the timing, decisions, and follow-up work formed a believable exercise arc."
            icon={<ClipboardList className="h-3.5 w-3.5" />}
            ctas={[
              { href: "/facilitator/sessions", label: "Open session library", variant: "secondary" },
            ]}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <ChecklistCard title="Review checklist" items={reviewChecklist} />

              <Card className="border border-[var(--studio-border)] bg-[var(--studio-surface)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">What to look for in review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  <p>
                    Check whether the team reacted in the right order, whether escalation happened too early or too late, and
                    whether the follow-up work generated by the session was coherent.
                  </p>
                  <p>
                    Group the session mentally by inject and by turning point. That usually produces a stronger after-action
                    conversation than reading the action log as one long flat list.
                  </p>
                  <p>
                    If the review feels thin, the likely issue is not the screen. It usually means the session did not capture
                    enough meaningful actions or decisions during the run.
                  </p>
                </CardContent>
              </Card>
            </div>
          </SectionCard>

          <section id="pitfalls" className="scroll-mt-24">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Common pitfalls
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPitfallsOpen((value) => !value)}
                    className="gap-2"
                    aria-expanded={pitfallsOpen}
                  >
                    {pitfallsOpen ? "Hide" : "Show"}
                    {pitfallsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <Collapsible open={pitfallsOpen}>
                <CardContent className="grid gap-3 pt-0 lg:grid-cols-2">
                  {pitfalls.map((item) => (
                    <div key={item.title} className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3">
                      <div className="text-sm font-semibold text-foreground">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{item.body}</div>
                    </div>
                  ))}
                </CardContent>
              </Collapsible>
            </Card>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Start here</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {jumpLinks.map((link) => (
                <Button key={link.id} asChild variant="outline" size="sm" className="w-full justify-start">
                  <a href={`#${link.id}`}>{link.label}</a>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Choose your path</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3">
                <div className="text-sm font-semibold">First rehearsal</div>
                <div className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  Best if you are new to the app or still shaping the scenario.
                </div>
                <div className="mt-3">
                  <Button asChild size="sm" variant="secondary">
                    <a href="#first-rehearsal">Open rehearsal path</a>
                  </Button>
                </div>
              </div>

              <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3">
                <div className="text-sm font-semibold">First live exercise</div>
                <div className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                  Best after a rehearsal run, when entitlement and participant access are already clear.
                </div>
                <div className="mt-3">
                  <Button asChild size="sm" variant="secondary">
                    <a href="#first-live">Open live path</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Recommended first-time path
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 pt-0">
              <Button asChild variant="outline" className="justify-between">
                <Link href="/facilitator/workspace">
                  1. Workspace
                  <Building2 className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link href="/facilitator/scenarios">
                  2. Scenario library
                  <BookOpen className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link href="/facilitator/sessions#create-session">
                  3. Create session
                  <PlayCircle className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link href="/facilitator/sessions">
                  4. Open review later
                  <ClipboardList className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
