import { Module } from '@nestjs/common';
import { AgentWebSocketGateway } from './websocket.gateway';
import { AgentsModule } from '../modules/agents/agents.module';

@Module({
    imports: [AgentsModule],
    providers: [AgentWebSocketGateway],
    exports: [AgentWebSocketGateway],
})
export class WebSocketModule { }
