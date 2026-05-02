"use client";

import { useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, ChevronUp, CloudRain, FileText, MapPin, Users } from "lucide-react";

import Collapsible from "@/app/components/Collapsible";
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
  const [eventOpen, setEventOpen] = useState(true);
  const [situationOpen, setSituationOpen] = useState(false);
  const [casualtiesOpen, setCasualtiesOpen] = useState(false);

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
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 opacity-80" />
              Event
              <HintTooltip text="Capture when and where the scenario takes place so the setup stays grounded in context." />
            </CardTitle>
            <button
              type="button"
              onClick={() => setEventOpen((open) => !open)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--studio-border)] px-2.5 py-1 text-xs font-medium text-[var(--foreground-muted)] transition hover:border-[var(--accent)] hover:text-foreground"
              aria-expanded={eventOpen}
            >
              {eventOpen ? "Hide" : "Show"}
              {eventOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </CardHeader>
        <Collapsible open={eventOpen}>
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
            <div className="space-y-1">
              <label htmlFor={eventLocationLatId} className="text-sm font-semibold">Latitude</label>
              <Input id={eventLocationLatId} value={locationLat} onChange={(e) => setLocationLat(e.target.value)} placeholder="e.g. 49.0097" />
            </div>
            <div className="space-y-1">
              <label htmlFor={eventLocationLngId} className="text-sm font-semibold">Longitude</label>
              <Input id={eventLocationLngId} value={locationLng} onChange={(e) => setLocationLng(e.target.value)} placeholder="e.g. 2.5479" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor={eventWeatherId} className="text-sm font-semibold flex items-center gap-2">
                <CloudRain className="h-4 w-4 opacity-70" />
                Weather
              </label>
              <Input id={eventWeatherId} value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="e.g. Low ceiling and rain" />
            </div>
          </CardContent>
        </Collapsible>
      </Card>

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 opacity-80" />
              Situation
              <HintTooltip text="Describe the type of incident and summarize the operating picture at the start of the exercise." />
            </CardTitle>
            <button
              type="button"
              onClick={() => setSituationOpen((open) => !open)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--studio-border)] px-2.5 py-1 text-xs font-medium text-[var(--foreground-muted)] transition hover:border-[var(--accent)] hover:text-foreground"
              aria-expanded={situationOpen}
            >
              {situationOpen ? "Hide" : "Show"}
              {situationOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </CardHeader>
        <Collapsible open={situationOpen}>
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
        </Collapsible>
      </Card>

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 opacity-80" />
              Initial manifest and casualties
              <HintTooltip text="Use these starting numbers to frame the first operational picture for the scenario and copy them into each new session." />
            </CardTitle>
            <button
              type="button"
              onClick={() => setCasualtiesOpen((open) => !open)}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--studio-border)] px-2.5 py-1 text-xs font-medium text-[var(--foreground-muted)] transition hover:border-[var(--accent)] hover:text-foreground"
              aria-expanded={casualtiesOpen}
            >
              {casualtiesOpen ? "Hide" : "Show"}
              {casualtiesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </CardHeader>
        <Collapsible open={casualtiesOpen}>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor={passengerCountId} className="text-sm font-semibold">Passengers</label>
              <Input id={passengerCountId} value={passengerCount} onChange={(e) => setPassengerCount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor={crewCountId} className="text-sm font-semibold">Crew</label>
              <Input id={crewCountId} value={crewCount} onChange={(e) => setCrewCount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor={cargoWeightKgId} className="text-sm font-semibold">Cargo kg</label>
              <Input id={cargoWeightKgId} value={cargoWeightKg} onChange={(e) => setCargoWeightKg(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor={dangerousGoodsCountId} className="text-sm font-semibold">Dangerous goods</label>
              <Input
                id={dangerousGoodsCountId}
                value={dangerousGoodsCount}
                onChange={(e) => setDangerousGoodsCount(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor={liveAnimalsCountId} className="text-sm font-semibold">Live animals</label>
              <Input id={liveAnimalsCountId} value={liveAnimalsCount} onChange={(e) => setLiveAnimalsCount(e.target.value)} />
            </div>
            <div className="sm:col-span-2 border-t border-[var(--studio-border)]" />
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
        </Collapsible>
      </Card>
    </div>
  );
}
