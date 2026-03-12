import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface FieldMapping {
  /** Prisma / DTO field name */
  field: string;
  /** Human-readable column header in the spreadsheet */
  header: string;
  /** Reject the row when this field is empty */
  required?: boolean;
}

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

@Injectable()
export class ImportExportService {
  /* ------------------------------------------------------------------ */
  /*  Export helpers                                                      */
  /* ------------------------------------------------------------------ */

  /** Build an XLSX buffer from row data + field mappings. */
  buildXlsx(
    rows: Record<string, unknown>[],
    fields: FieldMapping[],
    sheetName = 'Data',
  ): Buffer {
    const headers = fields.map((f) => f.header);
    const data = rows.map((row) =>
      fields.map((f) => {
        const val = row[f.field];
        if (val instanceof Date) return val.toISOString().slice(0, 10);
        if (val === null || val === undefined) return '';
        return val;
      }),
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  /** Build a blank template XLSX with column headers only. */
  buildTemplate(fields: FieldMapping[], sheetName = 'Template'): Buffer {
    return this.buildXlsx([], fields, sheetName);
  }

  /* ------------------------------------------------------------------ */
  /*  Import helpers                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Parse an uploaded XLSX / CSV buffer using the field mapping.
   * Returns rows mapped to field names and a list of validation errors.
   */
  parseFile(
    buffer: Buffer,
    fields: FieldMapping[],
  ): { parsedRows: Record<string, unknown>[]; errors: Array<{ row: number; message: string }> } {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException(
        'Could not read file. Ensure it is a valid XLSX or CSV.',
      );
    }

    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('The uploaded file has no sheets.');
    }

    const sheet = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });
    if (!rawRows.length) {
      throw new BadRequestException('The uploaded file has no data rows.');
    }

    // Map both human-readable headers and camelCase field names → FieldMapping
    const headerMap = new Map<string, FieldMapping>();
    for (const f of fields) {
      headerMap.set(f.header.toLowerCase().trim(), f);
      headerMap.set(f.field.toLowerCase().trim(), f);
    }

    const parsedRows: Record<string, unknown>[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const mapped: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(raw)) {
        const field = headerMap.get(key.toLowerCase().trim());
        if (field) {
          const strVal = String(value ?? '').trim();
          if (strVal !== '') mapped[field.field] = strVal;
        }
      }

      // Required-field check
      const missing = fields
        .filter((f) => f.required)
        .filter(
          (f) => !mapped[f.field] || String(mapped[f.field]).trim() === '',
        );

      if (missing.length) {
        errors.push({
          row: i + 2,
          message: `Missing required: ${missing.map((f) => f.header).join(', ')}`,
        });
        continue;
      }

      if (Object.keys(mapped).length > 0) {
        parsedRows.push(mapped);
      }
    }

    return { parsedRows, errors };
  }
}
