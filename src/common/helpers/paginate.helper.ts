import { Paginated } from '../dto/paginated.dto';
import { PaginationDto } from '../dto/pagination.dto';

export const paginate = async <T>(
  data: T[],
  paginationDto: PaginationDto,
): Promise<Paginated<T>> => {
  const { page = 1, limit = 10 } = paginationDto;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedItems = data.slice(start, end);
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    items: await Promise.all(paginatedItems),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
  };
};
