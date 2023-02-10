import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DemoController } from './modules/demo/demo.controller';
import { DemoService } from './modules/demo/demo.service';
import { DemoModule } from './modules/demo/demo.module';
import { DubboModule } from './dubbo';

@Module({
  imports: [DemoModule, DubboModule.forRoot()],
  controllers: [AppController, DemoController],
  providers: [AppService, DemoService],
})
export class AppModule {}
