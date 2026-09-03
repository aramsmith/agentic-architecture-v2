import type { ValidationError } from "../types.js";
import type { LoadedRecord } from "./records.js";

export function validateRunJournals(
  records: LoadedRecord[],
): ValidationError[] {
  const journals = new Map<string, LoadedRecord[]>();
  for (const record of records.filter(
    ({ value }) => value.recordType === "run-journal-event",
  )) {
    const file = record.file.replace(/:[0-9]+$/u, "");
    const events = journals.get(file) ?? [];
    events.push(record);
    journals.set(file, events);
  }

  const errors: ValidationError[] = [];
  if (journals.size > 1) {
    errors.push({
      file: [...journals.keys()].join("; "),
      invariant: "run-journal-sequence",
      message: "The case contains multiple AFF run journals.",
      remediation:
        "Keep one case-root <artifactPrefix>-run-journal.jsonl append-only history.",
    });
  }
  for (const events of journals.values()) {
    const first = events[0];
    const prefix =
      first && typeof first.value.artifactPrefix === "string"
        ? first.value.artifactPrefix
        : undefined;
    const journalFile = first?.file.replace(/:[0-9]+$/u, "");
    if (prefix && journalFile !== `${prefix}-run-journal.jsonl`) {
      errors.push({
        file: journalFile ?? "run journal",
        invariant: "run-journal-sequence",
        message: "Run journal is not at the contracted case-root filename.",
        remediation: `Use ${prefix}-run-journal.jsonl at the case root.`,
      });
    }
    let previousSequence = 0;
    const eventIds = new Set<string>();
    for (const event of events) {
      const sequence = event.value.sequence;
      const eventId = event.value.eventId;
      if (
        typeof sequence !== "number" ||
        sequence <= previousSequence ||
        (typeof eventId === "string" && eventIds.has(eventId))
      ) {
        errors.push({
          file: event.file,
          invariant: "run-journal-sequence",
          message:
            "Run-journal sequence numbers must increase and event IDs must be unique.",
          remediation:
            "Append a new event with the next sequence and a new immutable event ID.",
        });
      }
      if (typeof sequence === "number") {
        previousSequence = sequence;
      }
      if (typeof eventId === "string") {
        eventIds.add(eventId);
      }
    }
  }
  return errors;
}
