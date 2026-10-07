/** CSV stock is an opening count unless an admin explicitly runs stock opname. */
export function importedStock(current: number | null | undefined, csvStock: number | null, replaceExistingStock: boolean) {
  return replaceExistingStock ? csvStock : current ?? null;
}
