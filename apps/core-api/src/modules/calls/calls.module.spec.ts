import { MODULE_METADATA } from '@nestjs/common/constants';
import { CallsController } from './calls.controller';
import { CallsModule } from './calls.module';
import { CallsProgressController } from './calls-progress.controller';

describe('CallsModule', () => {
    it('registers the progress controller', () => {
        const controllers =
            Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CallsModule) ?? [];

        expect(controllers).toEqual(
            expect.arrayContaining([CallsController, CallsProgressController]),
        );
    });
});
