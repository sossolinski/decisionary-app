"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  AlignLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock,
  CloudRain,
  Compass,
  Crosshair,
  FileText,
  Globe2,
  HeartPulse,
  MapPin,
  Package,
  PawPrint,
  ShieldAlert,
  Skull,
  Type,
  UserRound,
  Users,
} from "lucide-react";

import Collapsible from "@/app/components/Collapsible";
import HintTooltip from "@/app/components/HintTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { EDITOR_ICON } from "./scenarioEditorUi";

type ScenarioDetailsSectionProps = {
  basicsTitleId: string;
  basicsDescriptionId: string;
  eventDateId: string;
  eventTimeId: string;
  eventTimezoneId: string;
  eventLocationId: string;
  eventLocationLatId: string;
  eventLocationLngId: string;
  eventWeatherId: string;
  situationTypeId: string;
  shortDescriptionId: string;
  injuredId: string;
  fatalitiesId: string;
  uninjuredId: string;
  unknownId: string;
  passengerCountId: string;
  crewCountId: string;
  cargoWeightKgId: string;
  dangerousGoodsCountId: string;
  liveAnimalsCountId: string;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  eventDate: string;
  setEventDate: (value: string) => void;
  eventTime: string;
  setEventTime: (value: string) => void;
  timezone: string;
  setTimezone: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  locationLat: string;
  setLocationLat: (value: string) => void;
  locationLng: string;
  setLocationLng: (value: string) => void;
  weather: string;
  setWeather: (value: string) => void;
  situationType: string;
  setSituationType: (value: string) => void;
  shortDescription: string;
  setShortDescription: (value: string) => void;
  injured: string;
  setInjured: (value: string) => void;
  fatalities: string;
  setFatalities: (value: string) => void;
  uninjured: string;
  setUninjured: (value: string) => void;
  unknown: string;
  setUnknown: (value: string) => void;
  passengerCount: string;
  setPassengerCount: (value: string) => void;
  crewCount: string;
  setCrewCount: (value: string) => void;
  cargoWeightKg: string;
  setCargoWeightKg: (value: string) => void;
  dangerousGoodsCount: string;
  setDangerousGoodsCount: (value: string) => void;
  liveAnimalsCount: string;
  setLiveAnimalsCount: (value: string) => void;
};

type FieldLabelProps = {
  htmlFor: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
};

function FieldLabel({ htmlFor, icon: Icon, children }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-semibold">
      <Icon className={EDITOR_ICON.field} />
      {children}
    </label>
  );
}

const TIMEZONE_OPTIONS = [
  { value: "Etc/GMT+12", city: "Baker Island" },
  { value: "Pacific/Honolulu", city: "Honolulu" },
  { value: "America/Anchorage", city: "Anchorage" },
  { value: "America/Los_Angeles", city: "Los Angeles" },
  { value: "America/Denver", city: "Denver" },
  { value: "America/Chicago", city: "Chicago" },
  { value: "America/New_York", city: "New York" },
  { value: "America/Sao_Paulo", city: "Sao Paulo" },
  { value: "Atlantic/Azores", city: "Azores" },
  { value: "Europe/London", city: "London" },
  { value: "Europe/Paris", city: "Paris" },
  { value: "Europe/Warsaw", city: "Warsaw" },
  { value: "Europe/Athens", city: "Athens" },
  { value: "Europe/Istanbul", city: "Istanbul" },
  { value: "Asia/Dubai", city: "Dubai" },
  { value: "Asia/Karachi", city: "Karachi" },
  { value: "Asia/Kolkata", city: "Mumbai" },
  { value: "Asia/Bangkok", city: "Bangkok" },
  { value: "Asia/Singapore", city: "Singapore" },
  { value: "Asia/Tokyo", city: "Tokyo" },
  { value: "Australia/Sydney", city: "Sydney" },
  { value: "Pacific/Auckland", city: "Auckland" },
];

function timezoneOffsetLabel(timeZone: string | null | undefined, eventDateISO?: string | null) {
  const tz = (timeZone ?? "").trim();
  if (!tz) return "UTC";

  if (
    /^utc\s*[+-]?\d{1,2}(?::?\d{2})?$/i.test(tz) ||
    /^gmt\s*[+-]?\d{1,2}(?::?\d{2})?$/i.test(tz)
  ) {
    return tz.toUpperCase().replace("GMT", "UTC").replace(/\s+/g, "");
  }

  const base = eventDateISO ? new Date(eventDateISO) : new Date("2026-01-15T12:00:00Z");
  const d = Number.isNaN(base.getTime()) ? new Date() : base;

  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = dtf.formatToParts(d);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    const asUTC = Date.UTC(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
      Number(get("hour")),
      Number(get("minute")),
      Number(get("second")),
    );
    const offsetMinutes = Math.round((asUTC - d.getTime()) / 60000);
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const hours = String(Math.floor(abs / 60)).padStart(2, "0");
    const minutes = String(abs % 60).padStart(2, "0");

    return `UTC${sign}${hours}:${minutes}`;
  } catch {
    return tz;
  }
}

export default function ScenarioDetailsSection({
  basicsTitleId,
  basicsDescriptionId,
  eventDateId,
  eventTimeId,
  eventTimezoneId,
  eventLocationId,
  eventLocationLatId,
  eventLocationLngId,
  eventWeatherId,
  situationTypeId,
  shortDescriptionId,
  injuredId,
  fatalitiesId,
  uninjuredId,
  unknownId,
  passengerCountId,
  crewCountId,
  cargoWeightKgId,
  dangerousGoodsCountId,
  liveAnimalsCountId,
  title,
  setTitle,
  description,
  setDescription,
  eventDate,
  setEventDate,
  eventTime,
  setEventTime,
  timezone,
  setTimezone,
  location,
  setLocation,
  locationLat,
  setLocationLat,
  locationLng,
  setLocationLng,
  weather,
  setWeather,
  situationType,
  setSituationType,
  shortDescription,
  setShortDescription,
  injured,
  setInjured,
  fatalities,
  setFatalities,
  uninjured,
  setUninjured,
  unknown,
  setUnknown,
  passengerCount,
  setPassengerCount,
  crewCount,
  setCrewCount,
  cargoWeightKg,
  setCargoWeightKg,
  dangerousGoodsCount,
  setDangerousGoodsCount,
  liveAnimalsCount,
  setLiveAnimalsCount,
}: ScenarioDetailsSectionProps) {
  const [initialContextOpen, setInitialContextOpen] = useState(true);
  const timezoneInOptions = TIMEZONE_OPTIONS.some((option) => option.value === timezone);
  const timezoneIsCustom = !timezoneInOptions && timezone.trim().length > 0;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)] lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className={EDITOR_ICON.section} />
            Scenario brief
            <HintTooltip text="Set the exercise title, detailed scenario description, incident category, and short operating summary." />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1">
            <FieldLabel htmlFor={basicsTitleId} icon={Type}>Exercise title</FieldLabel>
            <Input id={basicsTitleId} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor={situationTypeId} icon={AlertTriangle}>Incident category</FieldLabel>
            <Input
              id={situationTypeId}
              value={situationType}
              onChange={(e) => setSituationType(e.target.value)}
              placeholder="e.g., Aircraft accident, Disruption, Security…"
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor={basicsDescriptionId} icon={FileText}>Description</FieldLabel>
            <textarea
              id={basicsDescriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[112px] w-full rounded-[var(--radius)] border border-border bg-[var(--studio-surface2)] px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]"
              placeholder="Detailed scenario description…"
            />
          </div>
          <div className="space-y-1">
            <FieldLabel htmlFor={shortDescriptionId} icon={AlignLeft}>Short description</FieldLabel>
            <textarea
              id={shortDescriptionId}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className="min-h-[112px] w-full rounded-[var(--radius)] border border-border bg-[var(--studio-surface2)] px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]"
              placeholder="1–2 sentence operating summary…"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)] lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className={EDITOR_ICON.section} />
              Event & initial picture
              <HintTooltip text="Capture when and where the scenario starts, plus the initial manifest and casualty picture copied into each new session." />
            </CardTitle>
            <button
              type="button"
              onClick={() => setInitialContextOpen((open) => !open)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-[var(--studio-surface2)] px-2.5 py-1 text-xs font-medium text-[color:var(--studio-muted)] transition hover:border-[var(--studio-border-strong)] hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]"
              aria-expanded={initialContextOpen}
            >
              {initialContextOpen ? "Hide" : "Show"}
              {initialContextOpen ? <ChevronUp className={EDITOR_ICON.chevron} /> : <ChevronDown className={EDITOR_ICON.chevron} />}
            </button>
          </div>
        </CardHeader>
        <Collapsible open={initialContextOpen}>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel htmlFor={eventDateId} icon={Calendar}>Date</FieldLabel>
                <Input id={eventDateId} value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={eventTimeId} icon={Clock}>Time</FieldLabel>
                <Input id={eventTimeId} value={eventTime} onChange={(e) => setEventTime(e.target.value)} placeholder="HH:MM" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <FieldLabel htmlFor={eventTimezoneId} icon={Globe2}>Timezone</FieldLabel>
                <select
                  id={eventTimezoneId}
                  value={timezoneInOptions ? timezone : timezoneIsCustom ? "__custom" : ""}
                  onChange={(e) => {
                    if (e.target.value === "__custom") return;
                    setTimezone(e.target.value);
                  }}
                  className="h-10 w-full rounded-[var(--radius)] border border-border bg-[var(--studio-surface2)] px-3 text-sm text-foreground transition-[box-shadow,border-color,background-color] duration-150 hover:border-[var(--studio-border-strong)] focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]"
                >
                  <option value="">Select timezone…</option>
                  {timezoneIsCustom ? (
                    <option value="__custom">Custom - {timezone}</option>
                  ) : null}
                  {TIMEZONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {timezoneOffsetLabel(option.value, eventDate)} - {option.city}
                    </option>
                  ))}
                </select>
                {timezoneIsCustom ? (
                  <Input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Custom timezone, e.g. UTC+02:00"
                    aria-label="Custom timezone"
                  />
                ) : null}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <FieldLabel htmlFor={eventLocationId} icon={MapPin}>Location</FieldLabel>
                <Input id={eventLocationId} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Airport / city / region…" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={eventLocationLatId} icon={Crosshair}>Latitude</FieldLabel>
                <Input id={eventLocationLatId} value={locationLat} onChange={(e) => setLocationLat(e.target.value)} placeholder="e.g. 49.0097" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={eventLocationLngId} icon={Compass}>Longitude</FieldLabel>
                <Input id={eventLocationLngId} value={locationLng} onChange={(e) => setLocationLng(e.target.value)} placeholder="e.g. 2.5479" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <FieldLabel htmlFor={eventWeatherId} icon={CloudRain}>Weather</FieldLabel>
                <Input id={eventWeatherId} value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="e.g. Low ceiling and rain" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:border-l lg:border-border lg:pl-6">
              <div className="space-y-1">
                <FieldLabel htmlFor={passengerCountId} icon={UserRound}>Passengers</FieldLabel>
                <Input id={passengerCountId} value={passengerCount} onChange={(e) => setPassengerCount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={crewCountId} icon={Users}>Crew</FieldLabel>
                <Input id={crewCountId} value={crewCount} onChange={(e) => setCrewCount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={cargoWeightKgId} icon={Package}>Cargo kg</FieldLabel>
                <Input id={cargoWeightKgId} value={cargoWeightKg} onChange={(e) => setCargoWeightKg(e.target.value)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={dangerousGoodsCountId} icon={ShieldAlert}>Dangerous goods</FieldLabel>
                <Input
                  id={dangerousGoodsCountId}
                  value={dangerousGoodsCount}
                  onChange={(e) => setDangerousGoodsCount(e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <FieldLabel htmlFor={liveAnimalsCountId} icon={PawPrint}>Live animals</FieldLabel>
                <Input id={liveAnimalsCountId} value={liveAnimalsCount} onChange={(e) => setLiveAnimalsCount(e.target.value)} />
              </div>
              <div className="sm:col-span-2 border-t border-[var(--studio-border)]" />
              <div className="space-y-1">
                <FieldLabel htmlFor={injuredId} icon={HeartPulse}>Injured</FieldLabel>
                <Input id={injuredId} value={injured} onChange={(e) => setInjured(e.target.value)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={fatalitiesId} icon={Skull}>Fatalities</FieldLabel>
                <Input id={fatalitiesId} value={fatalities} onChange={(e) => setFatalities(e.target.value)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={uninjuredId} icon={Users}>Uninjured</FieldLabel>
                <Input id={uninjuredId} value={uninjured} onChange={(e) => setUninjured(e.target.value)} />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={unknownId} icon={CircleHelp}>Unknown</FieldLabel>
                <Input id={unknownId} value={unknown} onChange={(e) => setUnknown(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Collapsible>
      </Card>
    </div>
  );
}
