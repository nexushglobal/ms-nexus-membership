export class Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export class PaginationMeta {
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}
