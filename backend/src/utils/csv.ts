export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => unknown;
};

function normalizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(" | ");
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsvString<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const headerLine = columns
    .map((column) => escapeCsvCell(column.header))
    .join(",");

  const lines = rows.map((row) =>
    columns
      .map((column) =>
        escapeCsvCell(normalizeCsvValue(column.value(row))),
      )
      .join(","),
  );

  return `${[headerLine, ...lines].join("\n")}\n`;
}
