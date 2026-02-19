import { Module } from '@nestjs/common';
import { AgentWebSocketGateway } from './websocket.gateway';
import { AgentsModule } from '../modules/agents/agents.module';
import { QueuesModule } from '../modules/queues/queues.module';

@Module({
    imports: [AgentsModule, QueuesModule],
    providers: [AgentWebSocketGateway],
    exports: [AgentWebSocketGateway],
})
export class WebSocketModule { }
