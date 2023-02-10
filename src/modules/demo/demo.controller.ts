import { Controller, Get, Query } from '@nestjs/common';
import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Get('hello')
  async getHello(@Query('name') name: string, @Query('data') data: string) {
    const { res, err } = await this.demoService.sayHello(name, data);
    console.log('getHello', res, err);
    if (err) {
      return `err: ${err.message}`;
    }
    return `res: ${res}`;
  }
}
