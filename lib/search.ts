export type SearchGroupName = "Jobs" | "Customers" | "Reports" | "Enquiries" | "Quotations";

export type SearchResultItem = {
  id: string;
  group: SearchGroupName;
  title: string;
  code?: string;
  subtitle?: string;
  href: string;
};

export type SearchGroup = {
  group: SearchGroupName;
  items: SearchResultItem[];
};

export type SearchResponse = {
  query: string;
  groups: SearchGroup[];
  flat: SearchResultItem[];
};

/**
 * Sanitises a search string for PostgREST `.or()` filters the same way `customers/page.tsx` does:
 * commas, parentheses, percent signs and asterisks have filter syntax meaning and are replaced with spaces.
 */
export function sanitizeSearchTerm(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[,()%*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function buildSearchResponse(
  query: string,
  rawGroups: Partial<Record<SearchGroupName, SearchResultItem[]>>
): SearchResponse {
  const order: SearchGroupName[] = ["Jobs", "Customers", "Reports", "Enquiries", "Quotations"];
  const groups: SearchGroup[] = [];
  const flat: SearchResultItem[] = [];

  for (const name of order) {
    const items = rawGroups[name] ?? [];
    if (items.length > 0) {
      groups.push({ group: name, items });
      flat.push(...items);
    }
  }

  return { query, groups, flat };
}

export function moveSearchIndex(current: number, delta: 1 | -1, total: number): number {
  if (total <= 0) return -1;
  if (current < 0 || current >= total) {
    return delta === 1 ? 0 : total - 1;
  }
  return (current + delta + total) % total;
}
