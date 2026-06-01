import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { CommonService } from './common.service';
import { cursorPaginationDto } from './dto/cursor-pagination.dto';
import { pagePaginationDto } from './dto/page-pagination.dto';

describe('CommonService', () => {
    let service: CommonService;

    beforeEach(() => {
        service = new CommonService();
    });

    describe('applyPagePaginationParamsToQb', () => {
        it('applies take and skip from page and take', () => {
            const qb = {
                take: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
            } as unknown as SelectQueryBuilder<{ id: number }>;

            const dto: pagePaginationDto = { page: 3, take: 10 };
            service.applyPagePaginationParamsToQb(qb, dto);

            expect(qb.take).toHaveBeenCalledWith(10);
            expect(qb.skip).toHaveBeenCalledWith(20);
        });
    });

    describe('generateNextCursor', () => {
        it('returns null when results are empty', () => {
            expect(service.generateNextCursor([], ['id_DESC'])).toBeNull();
        });

        it('returns base64 cursor with values from last item', () => {
            const results = [
                { id: 1, title: 'a' },
                { id: 2, title: 'b' },
            ];

            const cursor = service.generateNextCursor(results, ['id_ASC']);
            const decoded = JSON.parse(Buffer.from(cursor!, 'base64').toString('utf-8'));

            expect(decoded).toEqual({
                values: { id: 2 },
                order: ['id_ASC'],
            });
        });
    });

    describe('applyCursorPaginationParamsToQb', () => {
        function createQbMock(getManyResult: { id: number }[] = []) {
            return {
                alias: 'movie',
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                addOrderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(getManyResult),
            } as unknown as SelectQueryBuilder<{ id: number }>;
        }

        it('applies order and take without cursor', async () => {
            const qb = createQbMock([{ id: 3 }, { id: 2 }]);
            const dto: cursorPaginationDto = { take: 5, order: ['id_DESC'] };

            const { nextCursor } = await service.applyCursorPaginationParamsToQb(qb, dto);

            expect(qb.orderBy).toHaveBeenCalledWith('movie.id', 'DESC');
            expect(qb.take).toHaveBeenCalledWith(5);
            expect(qb.getMany).toHaveBeenCalled();
            expect(nextCursor).toBeTruthy();

            const decoded = JSON.parse(Buffer.from(nextCursor!, 'base64').toString('utf-8'));
            expect(decoded.values.id).toBe(2);
        });

        it('applies cursor where clause when cursor is provided', async () => {
            const qb = createQbMock([{ id: 1 }]);
            const cursorObj = { values: { id: 5 }, order: ['id_DESC'] };
            const cursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');
            const dto: cursorPaginationDto = { take: 5, order: ['id_ASC'], cursor };

            await service.applyCursorPaginationParamsToQb(qb, dto);

            expect(qb.andWhere).toHaveBeenCalled();
            const [whereSql, parameters] = (qb.andWhere as jest.Mock).mock.calls[0];
            expect(whereSql).toContain('movie.id');
            expect(parameters.movie_id).toBe(5);
            expect(qb.orderBy).toHaveBeenCalledWith('movie.id', 'DESC');
        });

        it('throws BadRequestException for invalid order direction without cursor', async () => {
            const qb = createQbMock();

            await expect(
                service.applyCursorPaginationParamsToQb(qb, {
                    take: 5,
                    order: ['id_INVALID'],
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('uses addOrderBy for secondary sort columns', async () => {
            const qb = createQbMock([{ id: 1 }, { id: 2 }]);

            await service.applyCursorPaginationParamsToQb(qb, {
                take: 5,
                order: ['id_ASC', 'title_DESC'],
            });

            expect(qb.orderBy).toHaveBeenCalledWith('movie.id', 'ASC');
            expect(qb.addOrderBy).toHaveBeenCalledWith('movie.title', 'DESC');
        });

        it('throws BadRequestException for invalid order inside cursor payload', async () => {
            const qb = createQbMock();
            const cursor = Buffer.from(JSON.stringify({ values: { id: 1 }, order: ['id_INVALID'] })).toString('base64');

            await expect(
                service.applyCursorPaginationParamsToQb(qb, {
                    take: 5,
                    order: ['id_ASC'],
                    cursor,
                }),
            ).rejects.toThrow('Order는 ASC 또는 DESC로 입력되어야합니다.');
        });

        it('builds compound cursor where with previous column equality', async () => {
            const qb = createQbMock([{ id: 3 }, { id: 2 }]);
            const cursorObj = {
                values: { id: 5, title: 'mid' },
                order: ['id_ASC', 'title_ASC'],
            };
            const cursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');

            await service.applyCursorPaginationParamsToQb(qb, {
                take: 5,
                order: ['id_DESC'],
                cursor,
            });

            const [whereSql, parameters] = (qb.andWhere as jest.Mock).mock.calls[0];
            expect(whereSql).toContain('movie.id=');
            expect(whereSql).toContain('movie.title');
            expect(parameters.movie_id).toBe(5);
            expect(parameters.movie_title).toBe('mid');
            expect(qb.orderBy).toHaveBeenCalledWith('movie.id', 'ASC');
            expect(qb.addOrderBy).toHaveBeenCalledWith('movie.title', 'ASC');
        });

        it('uses DESC comparison operator in cursor where clause', async () => {
            const qb = createQbMock([{ id: 1 }]);
            const cursor = Buffer.from(JSON.stringify({ values: { id: 10 }, order: ['id_DESC'] })).toString('base64');

            await service.applyCursorPaginationParamsToQb(qb, {
                take: 5,
                order: ['id_ASC'],
                cursor,
            });

            const [whereSql] = (qb.andWhere as jest.Mock).mock.calls[0];
            expect(whereSql).toContain('movie.id <');
        });
    });
});
