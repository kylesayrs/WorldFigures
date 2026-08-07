export type CsvRow = Record<string, string>;

/** Minimal RFC 4180-ish CSV parser: handles quoted fields, escaped quotes, commas/newlines inside quotes. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }
  // trailing field/row (only if there's content after the last newline)
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Parse a CSV with a header row into objects keyed by header. */
export function parseCsvObjects(text: string): CsvRow[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];
  const [header, ...rest] = rows;
  return rest.map((r) => {
    const obj: CsvRow = {};
    header.forEach((key, i) => {
      obj[key.trim()] = (r[i] ?? '').trim();
    });
    return obj;
  });
}
