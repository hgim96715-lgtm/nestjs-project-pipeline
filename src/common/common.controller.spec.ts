import { Test, TestingModule } from '@nestjs/testing';
import { CommonController } from './common.controller';

describe('CommonController', () => {
    let controller: CommonController;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CommonController],
        }).compile();

        controller = module.get<CommonController>(CommonController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createVideo', () => {
        it('returns fileName array from uploaded files', () => {
            const movies = [
                { filename: 'a_uuid_1.mp4' },
                { filename: 'b_uuid_2.mp4' },
            ] as Express.Multer.File[];

            expect(controller.createVideo(movies)).toEqual([
                { fileName: 'a_uuid_1.mp4' },
                { fileName: 'b_uuid_2.mp4' },
            ]);
        });
    });
});
