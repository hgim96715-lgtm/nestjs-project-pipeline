import { BadRequestException } from '@nestjs/common';
import { rename } from 'fs/promises';
import { join } from 'path';
import { MovieFilesPipe } from './movie-files.pipe';

jest.mock('fs/promises', () => ({
    rename: jest.fn(),
}));

jest.mock('crypto', () => ({
    ...jest.requireActual<typeof import('crypto')>('crypto'),
    randomUUID: jest.fn(() => 'test-uuid'),
}));

describe('MovieFilesPipe', () => {
    const options = { maxSize: 800, mimetype: 'video/mp4', maxCount: 3 };
    let pipe: MovieFilesPipe;

    const baseFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
        ({
            fieldname: 'movies',
            originalname: 'clip.mp4',
            encoding: '7bit',
            mimetype: 'video/mp4',
            size: 1000,
            destination: join(process.cwd(), 'public', 'temp'),
            filename: 'uploaded.mp4',
            path: join(process.cwd(), 'public', 'temp', 'uploaded.mp4'),
            buffer: Buffer.from(''),
            stream: null as never,
            ...overrides,
        }) as Express.Multer.File;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, 'now').mockReturnValue(1_780_000_000_000);
        pipe = new MovieFilesPipe(options);
        (rename as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('throws when files are missing', async () => {
        await expect(pipe.transform(undefined as never, { type: 'custom' } as never)).rejects.toThrow(
            BadRequestException,
        );
    });

    it('throws when file exceeds max size', async () => {
        const file = baseFile({ size: options.maxSize * 1_000_000 + 1 });

        await expect(pipe.transform([file], { type: 'custom' } as never)).rejects.toThrow(BadRequestException);
    });

    it('throws when mimetype does not match', async () => {
        const file = baseFile({ mimetype: 'image/png' });

        await expect(pipe.transform([file], { type: 'custom' } as never)).rejects.toThrow(BadRequestException);
    });

    it('throws when file count exceeds maxCount', async () => {
        const files = [baseFile(), baseFile(), baseFile(), baseFile()];

        await expect(pipe.transform(files, { type: 'custom' } as never)).rejects.toThrow(BadRequestException);
    });

    it('renames files to uuid_timestamp extension', async () => {
        const file = baseFile();

        const result = await pipe.transform([file], { type: 'custom' } as never);

        expect(rename).toHaveBeenCalledWith(
            file.path,
            join(file.destination, 'test-uuid_1780000000000.mp4'),
        );
        expect(result[0].filename).toBe('test-uuid_1780000000000.mp4');
        expect(result[0].path).toBe(join(file.destination, 'test-uuid_1780000000000.mp4'));
    });
});
