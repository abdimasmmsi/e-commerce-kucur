export const paginationPageCount = (totalItems, pageSize) => Math.max(1, Math.ceil(totalItems / pageSize));
export const normalizedPage = (page, totalItems, pageSize) => Math.min(Math.max(1, page), paginationPageCount(totalItems, pageSize));
export const paginate = (items, page, pageSize) => {
  const current = normalizedPage(page, items.length, pageSize);
  return items.slice((current - 1) * pageSize, current * pageSize);
};
