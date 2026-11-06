# Report paper templates

`UTReport`, `MTReport`, `DPTReport` and `ReportTemplate` render the supplied report table grids and merged cells. `MPT` is the database method; `MT` is accepted as an input alias. A4 print CSS is in `report.css`; import it in the containing app route, or inline its contents when creating a standalone HTML/PDF document. The components themselves are pure React and have no database or approval side effects.

Supply letterhead and report values through `ReportDocument`. No real records, logos, seals or signatures are embedded. Preview fixtures are invented and explicitly marked as fake.

The `approval` object must come from a trusted server-side report record. Do not construct approval from browser input. Signature and seal elements, their URLs and the signatory name are absent unless `approved === true`. This is a rendering gate; report approval and permission enforcement belong to the calling workflow and database.

`/report-preview/UT`, `/report-preview/MT` and `/report-preview/DPT` are staff-only draft previews. Their print button uses A4 CSS. No report is sent or persisted by this preview.

Field definitions and validation live in `lib/reports/fields.ts`. Scalar readings use snake_case keys; repeated groups are `technicians[]` and `items[]`. `missingFields()` returns stable missing paths such as `equipment_serial` or `items.0.observations`, ready for `inspections.missing_fields`. It checks presence, not technical correctness or acceptance criteria. The database submission workflow must compute these paths on the server.

The source format grids and cell ordering were inspected locally. The source files use Letter page metadata; A4 output follows the explicit project instruction. Visual comparison with the original Word formats remains a review step; no source documents are committed.
