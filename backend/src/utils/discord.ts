type DiscordEventAnnouncementInput = {
  webhookUrl: string;
  organizerName: string;
  eventName: string;
  eventType: "NORMAL" | "MERCH";
  regDeadline: Date;
  startDate: Date;
  endDate: Date;
};

function buildAnnouncementContent(input: DiscordEventAnnouncementInput): string {
  return [
    `new event published by ${input.organizerName}`,
    `event: ${input.eventName}`,
    `type: ${input.eventType}`,
    `registration deadline: ${input.regDeadline.toISOString()}`,
    `starts: ${input.startDate.toISOString()}`,
    `ends: ${input.endDate.toISOString()}`,
  ].join("\n");
}

export async function postEventAnnouncementToDiscord(
  input: DiscordEventAnnouncementInput,
): Promise<void> {
  const response = await fetch(input.webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: buildAnnouncementContent(input),
    }),
  });

  if (!response.ok) {
    throw new Error(`discord webhook failed with status ${response.status}`);
  }
}

export async function postEventAnnouncementToDiscordSafe(
  input: DiscordEventAnnouncementInput,
): Promise<void> {
  try {
    await postEventAnnouncementToDiscord(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn(`discord webhook send failed: ${message}`);
  }
}
