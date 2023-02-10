import { Injectable } from '@nestjs/common';
import { Dubbo, DubboProviderCallResult } from '../../dubbo';

export interface IDemoService {
  sayHello(name: string): DubboProviderCallResult<string>;
}

@Dubbo({
  dubboInterface: 'com.hmhao.demo.service.DemoService',
  group: 'default',
  version: '1.0.0',
})
@Injectable()
export class DemoService implements IDemoService {
  sayHello(name = '', data = '') {
    return [
      {
        name,
        data,
      },
    ] as any;
  }
}
