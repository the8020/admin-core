import type { ValueHelpItem, ValueHelpRequest } from "/p/the8020/db/fields.ts";

/** Page an already bounded reference snapshot through ordinary field help. */
export function choiceHelp<Value>(items: readonly ValueHelpItem<Value>[]) {
  return ({ query, offset, limit }: ValueHelpRequest) => {
    const search = query.trim().toLowerCase();
    const matches = items.filter((item) =>
      `${item.value} ${item.label} ${item.description ?? ""}`.toLowerCase()
        .includes(search)
    );
    return {
      items: matches.slice(offset, offset + limit),
      more: matches.length > offset + limit,
    };
  };
}
