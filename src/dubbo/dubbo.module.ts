import { DynamicModule, Module } from '@nestjs/common';
import { Dubbo, dubboSetting } from 'apache-dubbo-consumer';
import { Nacos } from './registry/registry-nacos';
import {
  DUBBO_MODULE_OPTIONS,
  DUBBO_MODULE_PROVIDER,
  DUBBO_MODULE_METADATA,
} from './dubbo.constant';
import {
  DubboMetadata,
  DubboModuleAsyncOptions,
  DubboModuleOptions,
} from './dubbo.interface';

export const registry = Nacos({
  connect: 'ip:port',
  namespace: 'public',
  username: 'nacos',
  password: 'password',
  logger: console,
});

@Module({})
export class DubboModule {
  private static getDubboOptions(dubboMetadata: DubboMetadata) {
    const { services, settings } = dubboMetadata;
    Object.entries(settings).forEach(
      ([dubboInterface, dubboProviderOptions]) => {
        dubboSetting.match([dubboInterface], {
          group: dubboProviderOptions.group,
          version: dubboProviderOptions.version,
        });
      },
    );
    return {
      application: { name: 'hmhao-demo-service' },
      services,
      dubboSetting,
      // dubboVersion: '3.0.0',
      registry,
    };
  }
  public static forRoot(options?: DubboModuleOptions): DynamicModule {
    const providers = [
      {
        provide: DUBBO_MODULE_PROVIDER,
        useFactory: async () => {
          const dubboMetadata = Reflect.getMetadata(
            DUBBO_MODULE_METADATA,
            DubboModule,
          );
          // console.log('dubboMetadata', dubboMetadata);
          const dubbo = new Dubbo({
            ...DubboModule.getDubboOptions(dubboMetadata),
            ...options,
          });
          await dubbo.ready();
          Reflect.defineMetadata(DUBBO_MODULE_PROVIDER, dubbo, DubboModule);
          return dubbo;
        },
      },
    ];

    return {
      global: true,
      module: DubboModule,
      providers,
      exports: providers,
    };
  }

  public static forRootAsync(options: DubboModuleAsyncOptions): DynamicModule {
    const providers = [
      {
        provide: DUBBO_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      {
        provide: DUBBO_MODULE_PROVIDER,
        useFactory: async (dubboOptions?: DubboModuleOptions) => {
          const dubboMetadata = Reflect.getMetadata(
            DUBBO_MODULE_METADATA,
            DubboModule,
          );
          // console.log('dubboMetadata', dubboMetadata);
          const dubbo = new Dubbo({
            ...DubboModule.getDubboOptions(dubboMetadata),
            ...dubboOptions,
          });
          await dubbo.ready();
          Reflect.defineMetadata(DUBBO_MODULE_PROVIDER, dubbo, DubboModule);
          return dubbo;
        },
        inject: [DUBBO_MODULE_OPTIONS],
      },
    ];

    return {
      global: true,
      module: DubboModule,
      imports: options.imports,
      providers,
      exports: providers,
    };
  }
}
