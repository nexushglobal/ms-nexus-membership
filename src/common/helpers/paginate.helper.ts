import { Paginated } from '../dto/paginated.dto';
import { PaginationDto } from '../dto/pagination.dto';

export const paginate = async <T>(
  data: T[],
  paginationDto: PaginationDto,
): Promise<Paginated<T>> => {
  const { page = 1, limit = 5 } = paginationDto;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedItems = data.slice(start, end);
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / limit);
  return {
    items: await Promise.all(paginatedItems),
    meta: {
      totalItems,
      itemsPerPage: limit,
      totalPages,
      currentPage: page,
    },
  };
};
