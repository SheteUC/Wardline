import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
    const filter = new AllExceptionsFilter();

    function mockHost() {
        const json = jest.fn();
        const status = jest.fn().mockReturnValue({ json });
        const response = { status };
        const request = { url: '/v1/test' };
        return {
            host: {
                switchToHttp: () => ({
                    getResponse: () => response,
                    getRequest: () => request,
                }),
            } as any,
            json,
            status,
            request,
        };
    }

    it('maps HttpException to JSON with status and path', () => {
        const { host, json, status } = mockHost();
        filter.catch(new BadRequestException('bad'), host);
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 400,
                path: '/v1/test',
                message: 'bad',
            }),
        );
    });

    it('merges object response from HttpException', () => {
        const { host, json, status } = mockHost();
        filter.catch(
            new HttpException({ message: ['a', 'b'], error: 'Unprocessable' }, HttpStatus.UNPROCESSABLE_ENTITY),
            host,
        );
        expect(status).toHaveBeenCalledWith(422);
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 422,
                message: ['a', 'b'],
                error: 'Unprocessable',
                path: '/v1/test',
            }),
        );
    });

    it('hides error details in production for unknown errors', () => {
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const { host, json } = mockHost();
        filter.catch(new Error('secret'), host);
        process.env.NODE_ENV = prev;
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 500,
                message: 'Internal server error',
            }),
        );
        expect(json.mock.calls[0][0].stack).toBeUndefined();
        expect(json.mock.calls[0][0].error).toBeUndefined();
    });

    it('includes error message and stack outside production for unknown errors', () => {
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const { host, json } = mockHost();
        filter.catch(new Error('boom'), host);
        process.env.NODE_ENV = prev;
        expect(json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 500,
                message: 'Internal server error',
                error: 'boom',
                stack: expect.any(String),
            }),
        );
    });
});
