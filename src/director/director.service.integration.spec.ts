import '../../test/load-integration-env';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { integrationTestImports } from '../../test/integration-db.helpers';
import { DirectorService } from './director.service';
import { PrismaModule } from 'src/common/prisma.module';

async function resetDirectorTestData(dataSource: DataSource) {
    await dataSource.query(`
        TRUNCATE TABLE
            movie_user_like,
            movie_file,
            movie_genres_genre,
            movie,
            movie_detail,
            genre,
            director,
            "user"
        RESTART IDENTITY CASCADE
    `);
}

describe('DirectorService - Integration Test', () => {
    let service: DirectorService;
    let dataSource: DataSource;
    let moduleRef: TestingModule;

    const baseDto = () => ({
        name: 'integration-director',
        dob: new Date('1985-05-15'),
        nationality: 'Korean',
    });

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({
            imports: [...integrationTestImports(), PrismaModule],
            providers: [DirectorService],
        }).compile();

        service = moduleRef.get(DirectorService);
        dataSource = moduleRef.get(DataSource);
    }, 30_000);

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.destroy();
        }
        await moduleRef?.close();
    });

    beforeEach(async () => {
        await resetDirectorTestData(dataSource);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('persists a new director', async () => {
            const created = await service.create(baseDto());

            expect(created).toMatchObject({
                name: baseDto().name,
                nationality: baseDto().nationality,
            });
            expect(created.id).toBeDefined();
        });

        it('throws ConflictException for duplicate name and dob', async () => {
            const dto = baseDto();
            await service.create(dto);

            await expect(service.create(dto)).rejects.toThrow(ConflictException);
        });
    });

    describe('update', () => {
        it('updates director fields', async () => {
            const director = await service.create(baseDto());

            const updated = await service.update(director.id, { nationality: 'USA' });

            expect(updated).toMatchObject({
                id: director.id,
                nationality: 'USA',
            });
        });

        it('throws ConflictException when name+dob matches another director', async () => {
            const dtoA = { ...baseDto(), name: 'director-a' };
            const dtoB = { ...baseDto(), name: 'director-b' };
            await service.create(dtoA);
            const directorB = await service.create(dtoB);

            await expect(
                service.update(directorB.id, {
                    name: dtoA.name,
                    dob: dtoA.dob,
                }),
            ).rejects.toThrow(ConflictException);
        });

        it('throws NotFoundException when director does not exist', async () => {
            await expect(service.update(99999, { nationality: 'JP' })).rejects.toThrow(NotFoundException);
        });
    });

    describe('remove', () => {
        it('deletes an existing director', async () => {
            const director = await service.create(baseDto());

            const message = await service.remove(director.id);

            expect(message).toContain(String(director.id));
            expect(await service.findOne(director.id)).toBeNull();
        });

        it('throws NotFoundException when director does not exist', async () => {
            await expect(service.remove(99999)).rejects.toThrow(NotFoundException);
        });
    });
});
