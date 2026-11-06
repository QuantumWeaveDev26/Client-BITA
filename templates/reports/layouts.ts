import type { ReportMethod } from "../../lib/reports/fields";

// Grid widths (twips), merged cell spans and row order measured from the supplied Word formats.
// No client records, branding images, certificates, signatures or seals are embedded here.
export const REPORT_LAYOUTS = {
  UT: {
    title: "ULTRASONIC INSPECTION REPORT",
    columns: [1967, 705, 682, 813, 875, 912, 784, 874, 174, 443, 1491],
    header: [6, 2, 3], client: [2, 9], detail: [1, 5, 3, 2],
    technicians: [1, 2, 2, 2, 3, 1], items: [4, 1, 6],
    technicianLabel: "Testing carried out by",
  },
  MPT: {
    title: "MAGNETIC PARTICLE INSPECTION REPORT",
    columns: [2139, 946, 1134, 1701, 33, 1749, 61, 1276, 1417],
    header: [5, 1, 3], client: [2, 7], detail: [1, 4, 1, 3],
    technicians: [1, 2, 1, 3, 1, 1], items: [3, 1, 5],
    technicianLabel: "Inspection carried out by",
  },
  DPT: {
    title: "DYE PENETRANT INSPECTION REPORT",
    columns: [2183, 1294, 492, 1218, 873, 36, 501, 1200, 199, 581, 354, 1536],
    header: [6, 3, 3], client: [2, 10], detail: [1, 6, 3, 2],
    technicians: [1, 2, 3, 2, 3, 1], items: [4, 1, 7],
    technicianLabel: "Test carried by",
  },
} as const satisfies Record<ReportMethod, {
  title: string; columns: readonly number[]; header: readonly number[]; client: readonly number[];
  detail: readonly number[]; technicians: readonly number[]; items: readonly number[]; technicianLabel: string;
}>;
