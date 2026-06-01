import { BadRequestException } from '@nestjs/common';
import { MovieTitleValidationPipe } from './movie-title-validation.pipe';

describe('MovieTitleValidationPipe', () => {
    const pipe = new MovieTitleValidationPipe();

    it('returns empty value as-is', () => {
        expect(pipe.transform('', { type: 'body' } as never)).toBe('');
    });

    it('throws when title is 2 characters or fewer', () => {
        expect(() => pipe.transform('ab', { type: 'body' } as never)).toThrow(BadRequestException);
    });

    it('returns title when longer than 2 characters', () => {
        expect(pipe.transform('abc', { type: 'body' } as never)).toBe('abc');
    });
});
