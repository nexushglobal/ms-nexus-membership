import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';
import { paginate } from '../helpers/paginate.helper';
import { Paginated } from '../dto/paginated.dto';

@Injectable()
export abstract class BaseService<T extends object> {
  constructor(private readonly repository: Repository<T>) {}

  async findAllBase<R>(
    data: R[],
    paginationDto: PaginationDto,
  ): Promise<Paginated<R>> {
    return await paginate(data, paginationDto);
  }

  async searchBase<R>(
    data: R[],
    term: string,
    paginationDto: PaginationDto,
    searchFields: (keyof R)[],
  ): Promise<Paginated<R>> {
    const normalizedTerm = term.toLowerCase().trim();

    const filtered = data.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];
        return (
          typeof value === 'string' &&
          value.toLowerCase().includes(normalizedTerm)
        );
      }),
    );
    return await paginate(filtered, paginationDto);
  }

  async deleteAll(): Promise<void> {
    await this.repository.delete({});
  }
}
