type ErrorDetails = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
    details?: ErrorDetails;
  };
};

function pickFirstDetailMessage(details: ErrorDetails | undefined): string | null {
  if (!details) return null;

  const formError = details.formErrors?.find((entry) => typeof entry === "string" && entry.trim());
  if (formError) return formError;

  if (!details.fieldErrors) return null;

  for (const entries of Object.values(details.fieldErrors)) {
    const fieldError = entries?.find((entry) => typeof entry === "string" && entry.trim());
    if (fieldError) return fieldError;
  }

  return null;
}

export async function readApiErrorMessage(
  res: Response,
  fallback = "Request failed",
): Promise<string> {
  try {
    const data = (await res.json()) as ApiErrorPayload;
    const message = data?.error?.message?.trim();
    const detailMessage = pickFirstDetailMessage(data?.error?.details);
    const isGenericValidationLabel =
      typeof message === "string" &&
      message.toLowerCase().startsWith("invalid ");

    if (message && !isGenericValidationLabel) {
      return message;
    }

    return detailMessage ?? message ?? fallback;
  } catch {
    return fallback;
  }
}
