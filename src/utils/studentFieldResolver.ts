import type { FormField, FormSection, LetterCardFieldConfig, LetterConfig, UnitFormSchema } from '../types/ppdb';

export const CORE_NAME_FIELD_ID = 'fullName';

export function isLockedNameField(field?: Partial<FormField> | null): boolean {
  if (!field) return false;
  return (
    field.systemKey === 'fullName' ||
    String(field.id || '').toLowerCase() === 'fullname' ||
    field.locked === true
  );
}

export function createDefaultCoreNameField(existing?: Partial<FormField>): FormField {
  const existingLabel = typeof existing?.label === 'string' && existing.label.trim() ? existing.label.trim() : 'Nama Lengkap Calon Siswa';
  return {
    id: CORE_NAME_FIELD_ID,
    label: existingLabel,
    type: 'text',
    required: true,
    helpText:
      typeof existing?.helpText === 'string' && existing.helpText.trim()
        ? existing.helpText
        : 'Nama lengkap calon siswa (wajib & tampil di daftar pendaftar)',
    systemKey: 'fullName',
    locked: true,
  };
}

/**
 * Ensure Section 1 always starts with the non-deletable, label-editable Name field.
 */
export function ensureCoreNameFieldInSections(
  sections?: FormSection[] | null,
  unitId = 'UNIT'
): FormSection[] {
  const safeSections: FormSection[] = Array.isArray(sections)
    ? sections.map((sec) => ({
        ...sec,
        fields: Array.isArray(sec.fields) ? sec.fields.map((f) => ({ ...f })) : [],
      }))
    : [];

  if (safeSections.length === 0) {
    return [
      {
        id: `sec-${unitId.toLowerCase()}-1`,
        title: 'Data Calon Siswa',
        description: 'Identitas utama calon peserta didik',
        fields: [createDefaultCoreNameField()],
      },
    ];
  }

  let foundCoreField: FormField | null = null;
  for (let sIdx = 0; sIdx < safeSections.length; sIdx++) {
    const idx = safeSections[sIdx].fields.findIndex((f) => isLockedNameField(f));
    if (idx !== -1) {
      const target = safeSections[sIdx].fields[idx];
      foundCoreField = {
        ...target,
        id: target.id || CORE_NAME_FIELD_ID,
        type: 'text',
        required: true,
        systemKey: 'fullName',
        locked: true,
      };
      // Remove from original position so it sits cleanly at Section 1, Field 1
      safeSections[sIdx].fields.splice(idx, 1);
      break;
    }
  }

  const coreField = foundCoreField || createDefaultCoreNameField();
  safeSections[0].fields.unshift(coreField);
  return safeSections;
}

export function getLockedNameFieldFromSchema(schema?: UnitFormSchema | null): FormField | undefined {
  if (!schema || !Array.isArray(schema.sections)) return undefined;
  for (const sec of schema.sections) {
    const match = (sec.fields || []).find((f) => isLockedNameField(f));
    if (match) return match;
  }
  return undefined;
}

export function resolveStudentNameFromSchema(
  student: ResolvableStudentData,
  schema?: UnitFormSchema | null
): string {
  const nameField = getLockedNameFieldFromSchema(schema);
  if (nameField) {
    const resolved = resolveFormFieldValue(student, nameField);
    if (resolved !== undefined && resolved !== null && String(resolved).trim() !== '') {
      return String(resolved).trim();
    }
  }
  return (student.fullName && String(student.fullName).trim()) || '-';
}

export interface ResolvableStudentData {
  fullName?: string;
  nisn?: string;
  unit?: string;
  gender?: string;
  birthPlace?: string;
  birthDate?: string;
  address?: string;
  schoolOrigin?: string;
  parentName?: string;
  parentPhone?: string;
  parentJob?: string;
  parentIncome?: string;
  documents?: Record<string, string>;
  dynamicAnswers?: Record<string, any>;
}

/**
 * Resolve value for any Form Builder field from current dynamicAnswers,
 * legacy keys, dropdown options, or DB summary columns.
 */
export function resolveFormFieldValue(
  student: ResolvableStudentData,
  f: Pick<FormField, 'id' | 'label' | 'type'> & { options?: string[] }
): any {
  const dyn = student.dynamicAnswers || {};
  const direct = dyn[f.id];
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
    return f.type === 'date' && typeof direct === 'string' ? direct.slice(0, 10) : direct;
  }

  // Also check exact label key if stored by label in dynamicAnswers
  if (f.label && dyn[f.label] !== undefined && dyn[f.label] !== null && String(dyn[f.label]).trim() !== '') {
    const byLabel = dyn[f.label];
    return f.type === 'date' && typeof byLabel === 'string' ? byLabel.slice(0, 10) : byLabel;
  }

  const l = (f.label || '').toLowerCase();
  const id = (f.id || '').toLowerCase();

  if (f.type === 'file') {
    if (student.documents?.[f.id]) return student.documents[f.id];
    if (/kk|kartu.?keluarga/.test(l) || /kk/.test(id)) return student.documents?.kk || '';
    if (/akta|kelahiran/.test(l) || /akta/.test(id)) return student.documents?.akta || '';
    if (/foto|photo/.test(l) || /photo/.test(id)) return student.documents?.photo || '';
    if (/rapor/.test(l) || /rapor/.test(id)) return student.documents?.rapor || '';
    if (/ijazah|skl/.test(l) || /ijazah/.test(id)) return student.documents?.ijazah || '';
    return '';
  }

  // Check legacy or renamed dynamicAnswers entries
  const dynEntries = Object.entries(dyn).filter(
    ([, v]) => v !== undefined && v !== null && String(v).trim() !== '' && !String(v).startsWith('data:')
  );

  const findLegacyDyn = (keyRegex: RegExp): string | undefined => {
    const hit = dynEntries.find(([k]) => keyRegex.test(k.toLowerCase()));
    return hit ? String(hit[1]) : undefined;
  };

  let matchedDyn: string | undefined;
  if (/panggilan|nickname/.test(l) || /nickname|panggilan/.test(id)) {
    matchedDyn = findLegacyDyn(/nickname|panggilan/) || findLegacyDyn(/fullname|nama_?lengkap/);
  } else if (/nama.?lengkap|nama.?santri|nama.?calon|nama.?peserta/.test(l) || id === 'fullname') {
    matchedDyn = findLegacyDyn(/fullname|nama.?lengkap/);
  } else if (/nisn/.test(l) || /nisn/.test(id)) {
    matchedDyn = findLegacyDyn(/nisn/);
  } else if (/\bnis\b/.test(l) || /\bnis\b/.test(id)) {
    matchedDyn = findLegacyDyn(/\bnis\b|nisn/);
  } else if (/jenis.?kelamin/.test(l) || /gender/.test(id)) {
    matchedDyn = findLegacyDyn(/gender|kelamin/);
  } else if (/tempat.?lahir/.test(l) || /birthplace/.test(id)) {
    matchedDyn = findLegacyDyn(/birthplace|tempat/);
  } else if (/tanggal.?lahir/.test(l) || /birthdate/.test(id)) {
    matchedDyn = findLegacyDyn(/birthdate|tanggal/);
  } else if (/alamat/.test(l) || /address/.test(id)) {
    matchedDyn = findLegacyDyn(/address|alamat/);
  } else if (/tk.?asal|paud|sekolah.?asal|asal.?sekolah|nama.?sekolah/.test(l) || /schoolorigin|tkorigin/.test(id)) {
    matchedDyn = findLegacyDyn(/tkorigin|schoolorigin|sekolah|tk_?asal/);
  } else if (/npsn/.test(l) || /npsn/.test(id)) {
    matchedDyn = findLegacyDyn(/npsn/);
  } else if (/membaca|hijaiyah|latin|iqra/.test(l) || /reading/.test(id)) {
    matchedDyn = findLegacyDyn(/reading|membaca|baca/);
  } else if (/hafalan|surat|tahfidz|juz|quran|qur'an/.test(l) || /tahfidz|hafalan|quran/.test(id)) {
    matchedDyn = findLegacyDyn(/tahfidz|hafalan|quran/);
  } else if (/pilihan.?program/.test(l) || /program/.test(id)) {
    matchedDyn = findLegacyDyn(/program/);
  } else if (/peminatan|jurusan/.test(l) || /peminatan|jurusan/.test(id)) {
    matchedDyn = findLegacyDyn(/peminatan|jurusan/);
  } else if (/kelanjutan.?studi|rencana/.test(l) || /studi/.test(id)) {
    matchedDyn = findLegacyDyn(/studi|rencana/);
  } else if (/nama.?ayah|ayah/.test(l) && /nama/.test(l)) {
    matchedDyn = findLegacyDyn(/parentname|ayah|father/);
  } else if (/nama.?ibu|ibu/.test(l) && /nama/.test(l)) {
    matchedDyn = findLegacyDyn(/ibu|mother/);
  } else if (/nama.?orang.?tua|nama.?wali/.test(l) || /parentname/.test(id)) {
    matchedDyn = findLegacyDyn(/parentname|wali|ayah/);
  } else if (/pekerjaan/.test(l) || /parentjob/.test(id)) {
    matchedDyn = findLegacyDyn(/parentjob|pekerjaan|job/);
  } else if (/penghasilan/.test(l) || /parentincome/.test(id)) {
    matchedDyn = findLegacyDyn(/parentincome|penghasilan|income/);
  } else if (/whatsapp|nomor.?hp|no\.?\s*hp|telepon/.test(l) || /parentphone|phone/.test(id)) {
    matchedDyn = findLegacyDyn(/parentphone|phone|whatsapp|hp|telepon/);
  }

  if (matchedDyn !== undefined) {
    if (f.type === 'dropdown' && Array.isArray(f.options)) {
      const exactOpt = f.options.find((opt) => opt.trim().toLowerCase() === matchedDyn!.trim().toLowerCase());
      if (exactOpt) return exactOpt;
    }
    return f.type === 'date' ? matchedDyn.slice(0, 10) : matchedDyn;
  }

  // Dropdown option exact value match across legacy dynamicAnswers
  if (f.type === 'dropdown' && Array.isArray(f.options) && f.options.length > 0) {
    for (const [, val] of dynEntries) {
      const sVal = String(val).trim().toLowerCase();
      const optMatch = f.options.find((opt) => opt.trim().toLowerCase() === sVal);
      if (optMatch) return optMatch;
    }
  }

  // Fallback to top-level DB student columns
  let colVal = '';
  if (
    isLockedNameField(f as any) ||
    id === 'fullname' ||
    /^\s*nama\s*$/i.test(l) ||
    (/nama.?lengkap|nama.?santri|nama.?calon|nama.?peserta|nama.?anak|nama.?panggilan/.test(l) &&
      !/ayah|ibu|wali|orang.?tua/.test(l))
  ) {
    colVal = student.fullName || '';
  } else if (id === 'nisn' || /nisn/.test(l)) {
    colVal = student.nisn || '';
  } else if (id === 'gender' || /jenis.?kelamin/.test(l)) {
    colVal = student.gender || '';
  } else if (id === 'birthplace' || /tempat.?lahir/.test(l)) {
    colVal = student.birthPlace || '';
  } else if (id === 'birthdate' || /tanggal.?lahir/.test(l)) {
    colVal = student.birthDate ? String(student.birthDate).slice(0, 10) : '';
  } else if (id === 'address' || /alamat/.test(l)) {
    colVal = student.address || '';
  } else if (id === 'schoolorigin' || /sekolah.?asal|asal.?sekolah|nama.?tk|paud|nama.?sekolah/.test(l)) {
    colVal = student.schoolOrigin || '';
  } else if (id === 'parentname' || /nama.?orang.?tua|nama.?wali|nama.?ayah/.test(l)) {
    colVal = student.parentName || '';
  } else if (id === 'parentphone' || /whatsapp|nomor.?hp|no\.?\s*hp|telepon/.test(l)) {
    colVal = student.parentPhone || '';
  } else if (id === 'parentjob' || /pekerjaan/.test(l)) {
    colVal = student.parentJob || '';
  } else if (id === 'parentincome' || /penghasilan/.test(l)) {
    colVal = student.parentIncome || '';
  }

  if (colVal && f.type === 'dropdown' && Array.isArray(f.options)) {
    const optMatch = f.options.find((opt) => opt.trim().toLowerCase() === colVal.trim().toLowerCase());
    return optMatch || '';
  }
  return colVal;
}

export function formatCardFieldDisplayValue(
  rawValue: any,
  field?: Pick<FormField, 'type'> | null
): string {
  if (rawValue === undefined || rawValue === null) return '-';
  if (Array.isArray(rawValue)) {
    const joined = rawValue.map((v) => String(v || '').trim()).filter(Boolean).join(', ');
    return joined || '-';
  }
  const str = String(rawValue).trim();
  if (!str) return '-';
  if (field?.type === 'file' || str.startsWith('data:')) {
    return 'Berkas Terlampir';
  }
  return str;
}

/**
 * Derive default card fields from a unit's Form Builder schema (non-file fields in section order).
 */
export function getDefaultCardFieldsFromSchema(
  unitFormSchema?: UnitFormSchema | null
): LetterCardFieldConfig[] {
  if (!unitFormSchema || !Array.isArray(unitFormSchema.sections)) return [];
  const fields: LetterCardFieldConfig[] = [];
  for (const sec of unitFormSchema.sections) {
    if (!Array.isArray(sec.fields)) continue;
    for (const f of sec.fields) {
      if (f.type === 'file') continue;
      fields.push({
        fieldId: f.id,
        label: f.label,
        sectionTitle: sec.title,
      });
    }
  }
  return fields;
}

/**
 * Build exact [label, ": value"] rows for the Exam Card Biodata table across:
 * 1. Direct Print (#print-area)
 * 2. Client PDF Download (generateStudentCardPdf)
 * 3. Server Email PDF Attachment (generateStudentCardPdfBuffer)
 *
 * Strictly synchronized with Pengaturan Surat (letterConfig.cardFields) and the unit's Form Builder.
 */
export function getCardBiodataRows(
  student: ResolvableStudentData,
  letterConfigs?: Partial<LetterConfig>[] | Partial<LetterConfig> | null,
  unitFormSchema?: UnitFormSchema | null
): [string, string][] {
  const allSchemaFields: FormField[] = [];
  const fieldById = new Map<string, FormField>();
  const fieldByLabelLower = new Map<string, FormField>();

  if (unitFormSchema && Array.isArray(unitFormSchema.sections)) {
    for (const sec of unitFormSchema.sections) {
      if (!Array.isArray(sec.fields)) continue;
      for (const f of sec.fields) {
        allSchemaFields.push(f);
        fieldById.set(f.id, f);
        if (f.label) {
          fieldByLabelLower.set(f.label.trim().toLowerCase(), f);
        }
      }
    }
  }

  let unitConfig: Partial<LetterConfig> | undefined;
  let masterConfig: Partial<LetterConfig> | undefined;

  if (Array.isArray(letterConfigs)) {
    unitConfig = letterConfigs.find((l) => l.unitId === student.unit);
    masterConfig = letterConfigs.find((l) => l.unitId === 'MASTER');
  } else if (letterConfigs && typeof letterConfigs === 'object') {
    if (!letterConfigs.unitId || letterConfigs.unitId === student.unit) {
      unitConfig = letterConfigs;
    } else if (letterConfigs.unitId === 'MASTER') {
      masterConfig = letterConfigs;
    }
  }

  let chosenFields: LetterCardFieldConfig[] | undefined;

  if (unitConfig && Array.isArray(unitConfig.cardFields)) {
    // Unit admin explicitly configured cardFields (even if empty [])
    chosenFields = unitConfig.cardFields;
  } else if (masterConfig && Array.isArray(masterConfig.cardFields) && masterConfig.cardFields.length > 0) {
    // Master fallback: only keep fields that exist in this unit's Form Builder
    const matchingUnitFields = masterConfig.cardFields.filter(
      (cf) => fieldById.has(cf.fieldId) || fieldByLabelLower.has((cf.label || '').trim().toLowerCase())
    );
    if (matchingUnitFields.length > 0) {
      chosenFields = matchingUnitFields;
    }
  }

  if (chosenFields === undefined) {
    // Not customized yet: mirror the unit's current Form Builder non-file fields
    const schemaFields = getDefaultCardFieldsFromSchema(unitFormSchema);
    if (schemaFields.length > 0) {
      chosenFields = schemaFields;
    }
  }

  if (chosenFields !== undefined) {
    return chosenFields.map((cf) => {
      const schemaField =
        fieldById.get(cf.fieldId) ||
        fieldByLabelLower.get((cf.label || '').trim().toLowerCase());
      const syntheticField: Pick<FormField, 'id' | 'label' | 'type'> & { options?: string[] } = {
        id: schemaField?.id || cf.fieldId,
        label: schemaField?.label || cf.label,
        type: schemaField?.type || 'text',
        options: schemaField?.options,
      };
      const rawVal = resolveFormFieldValue(student, syntheticField);
      const formatted = formatCardFieldDisplayValue(rawVal, schemaField || syntheticField);
      return [cf.label, `: ${formatted}`];
    });
  }

  // Last-resort minimal fallback only when both cardFields & unit Form Builder have zero fields
  return [
    ['Nama Lengkap Calon Siswa', `: ${student.fullName || '-'}`],
    ['Unit Sekolah Pilihan', `: ${student.unit || '-'}`],
  ];
}

export interface ResolvedDocumentSlot {
  key: string;
  label: string;
  url: string;
  required: boolean;
  fromSchema: boolean;
  fileConfig?: FormField['fileConfig'];
}

export function isUploadedDocumentValue(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('/uploads/') ||
    /^https?:\/\//i.test(trimmed)
  );
}

export function isPdfDocumentUrl(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.trim().toLowerCase();
  return lower.startsWith('data:application/pdf') || lower.endsWith('.pdf');
}

export function getSchemaFileFields(unitFormSchema?: UnitFormSchema | null): FormField[] {
  if (!unitFormSchema || !Array.isArray(unitFormSchema.sections)) return [];
  const fields: FormField[] = [];
  for (const sec of unitFormSchema.sections) {
    if (!Array.isArray(sec.fields)) continue;
    for (const f of sec.fields) {
      if (f.type === 'file') fields.push(f);
    }
  }
  return fields;
}

export function getSchemaNonFileFields(
  unitFormSchema?: UnitFormSchema | null,
  options?: { excludeLockedName?: boolean }
): Array<FormField & { sectionTitle: string }> {
  if (!unitFormSchema || !Array.isArray(unitFormSchema.sections)) return [];
  const fields: Array<FormField & { sectionTitle: string }> = [];
  for (const sec of unitFormSchema.sections) {
    if (!Array.isArray(sec.fields)) continue;
    for (const f of sec.fields) {
      if (f.type === 'file') continue;
      if (options?.excludeLockedName && isLockedNameField(f)) continue;
      fields.push({ ...f, sectionTitle: sec.title });
    }
  }
  return fields;
}

export function resolveGuardianSummaryFromSchema(
  student: ResolvableStudentData,
  unitFormSchema?: UnitFormSchema | null
): { name?: string; phone?: string } {
  const nonFileFields = getSchemaNonFileFields(unitFormSchema, { excludeLockedName: true });
  let name = '';
  let phone = '';

  for (const f of nonFileFields) {
    const label = (f.label || '').toLowerCase();
    const id = (f.id || '').toLowerCase();
    if (!name && (/nama.?orang.?tua|nama.?wali|nama.?ayah|nama.?ibu/.test(label) || /parentname/.test(id))) {
      const val = resolveFormFieldValue(student, f);
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        name = String(val).trim();
      }
    }
    if (!phone && (/whatsapp|nomor.?hp|no\.?\s*hp|telepon/.test(label) || /parentphone|phone/.test(id))) {
      const val = resolveFormFieldValue(student, f);
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        phone = String(val).trim();
      }
    }
  }

  return {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
  };
}

export function getActiveAcademicYear(
  academicYears?: Array<{ id?: string; year?: string; startDate?: string; endDate?: string; isActive?: boolean }> | null
) {
  if (!Array.isArray(academicYears) || academicYears.length === 0) return null;
  return academicYears.find((a) => a.isActive) || academicYears[0];
}

export function getActiveAcademicYearLabel(
  academicYears?: Array<{ year?: string; isActive?: boolean }> | null
): string {
  const active = getActiveAcademicYear(academicYears);
  if (active?.year && active.year.trim()) return active.year.trim();
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}

/**
 * Resolve verification/detail document slots strictly from the unit's Form Builder file fields.
 * Never fabricates or leaks static KK/Akta/Foto/Rapor/Ijazah slots when not configured in Form Builder.
 */
export function resolveVerificationDocumentsForStudent(
  student: ResolvableStudentData,
  unitFormSchema?: UnitFormSchema | null
): {
  schemaFileSlots: ResolvedDocumentSlot[];
  extraUploadedDocs: ResolvedDocumentSlot[];
  allSlots: ResolvedDocumentSlot[];
  uploadedSlots: ResolvedDocumentSlot[];
} {
  const schemaFileSlots: ResolvedDocumentSlot[] = [];
  const extraUploadedDocs: ResolvedDocumentSlot[] = [];

  if (unitFormSchema && Array.isArray(unitFormSchema.sections)) {
    for (const sec of unitFormSchema.sections) {
      for (const f of sec.fields || []) {
        if (f.type !== 'file') continue;

        const rawVal = resolveFormFieldValue(student, f);
        const cleanUrl = isUploadedDocumentValue(rawVal) ? rawVal.trim() : '';

        schemaFileSlots.push({
          key: f.id,
          label: f.label,
          url: cleanUrl,
          required: Boolean(f.required),
          fromSchema: true,
          fileConfig: f.fileConfig,
        });
      }
    }
  }

  const allSlots = [...schemaFileSlots];
  const uploadedSlots = allSlots.filter((slot) => Boolean(slot.url));
  return { schemaFileSlots, extraUploadedDocs, allSlots, uploadedSlots };
}

/**
 * Find an uploaded student image photo dynamically from Form Builder photo/image file fields or avatarUrl.
 */
export function resolveStudentPhotoUrl(
  student: ResolvableStudentData & { avatarUrl?: string },
  unitFormSchema?: UnitFormSchema | null
): string | null {
  if (isUploadedDocumentValue(student.avatarUrl) && !isPdfDocumentUrl(student.avatarUrl)) {
    return student.avatarUrl.trim();
  }
  const { schemaFileSlots } = resolveVerificationDocumentsForStudent(student, unitFormSchema);
  const photoSlot = schemaFileSlots.find(
    (s) =>
      Boolean(s.url) &&
      !isPdfDocumentUrl(s.url) &&
      (/foto|photo|pas.?foto/i.test(s.label) || /photo|foto/i.test(s.key))
  );
  if (photoSlot) return photoSlot.url;
  return null;
}

