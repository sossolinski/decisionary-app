"use client";

import { AlertTriangle, Calendar, FileText, MapPin, Users } from "lucide-react";

import HintTooltip from "@/app/components/HintTooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";

type ScenarioDetailsSectionProps = {
  basicsTitleId: string;
  basicsDescriptionId: string;
  eventDateId: string;
  eventTimeId: string;
  eventTimezoneId: string;
  eventLocationId: string;
  situationTypeId: string;
  shortDescriptionId: string;
  injuredId: string;
  fatalitiesId: string;
  uninjuredId: string;
  unknownId: string;
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
};

export default function ScenarioDetailsSection({
  basicsTitleId,
  basicsDescriptionId,
  eventDateId,
  eventTimeId,
  eventTimezoneId,
  eventLocationId,
  situationTypeId,
  shortDescriptionId,
  injuredId,
  fatalitiesId,
  uninjuredId,
  unknownId,
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
}: ScenarioDetailsSectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 opacity-80" />
            Basics
            <HintTooltip text="Set the scenario title and a short description that helps facilitators recognize it later." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={basicsTitleId} className="text-sm font-semibold">Title</label>
            <Input id={basicsTitleId} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor={basicsDescriptionId} className="text-sm font-semibold">Description</label>
            <textarea
              id={basicsDescriptionId}
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
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 opacity-80" />
            Event
            <HintTooltip text="Capture when and where the scenario takes place so the setup stays grounded in context." />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={eventDateId} className="text-sm font-semibold">Date</label>
            <Input id={eventDateId} value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="YYYY-MM-DD" />
          </div>
          <div className="space-y-1">
            <label htmlFor={eventTimeId} className="text-sm font-semibold">Time</label>
            <Input id={eventTimeId} value={eventTime} onChange={(e) => setEventTime(e.target.value)} placeholder="HH:MM" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor={eventTimezoneId} className="text-sm font-semibold">Timezone</label>
            <Input id={eventTimezoneId} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g., Europe/Warsaw" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor={eventLocationId} className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 opacity-70" />
              Location
            </label>
            <Input id={eventLocationId} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Airport / city / region…" />
          </div>
        </CardContent>
      </Card>

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 opacity-80" />
            Situation
            <HintTooltip text="Describe the type of incident and summarize the operating picture at the start of the exercise." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={situationTypeId} className="text-sm font-semibold">Situation type</label>
            <Input
              id={situationTypeId}
              value={situationType}
              onChange={(e) => setSituationType(e.target.value)}
              placeholder="e.g., Accident, Disruption, Security…"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={shortDescriptionId} className="text-sm font-semibold">Short description</label>
            <textarea
              id={shortDescriptionId}
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
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 opacity-80" />
            Initial casualties
            <HintTooltip text="Use these starting numbers to frame the first operational picture for the scenario." />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={injuredId} className="text-sm font-semibold">Injured</label>
            <Input id={injuredId} value={injured} onChange={(e) => setInjured(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor={fatalitiesId} className="text-sm font-semibold">Fatalities</label>
            <Input id={fatalitiesId} value={fatalities} onChange={(e) => setFatalities(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor={uninjuredId} className="text-sm font-semibold">Uninjured</label>
            <Input id={uninjuredId} value={uninjured} onChange={(e) => setUninjured(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor={unknownId} className="text-sm font-semibold">Unknown</label>
            <Input id={unknownId} value={unknown} onChange={(e) => setUnknown(e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
