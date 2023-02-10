import { Dubbo as DubboConsumer, java } from 'apache-dubbo-consumer';
import { DUBBO_MODULE_PROVIDER, DUBBO_MODULE_METADATA } from './dubbo.constant';
import {
  DubboMetadata,
  DubboProvider,
  DubboProviderMethod,
  DubboProviderOptions,
} from './dubbo.interface';
import { DubboModule, registry } from './dubbo.module';

const genDubboService = (options: DubboProvider) => (dubbo: DubboConsumer) =>
  dubbo.proxyService(options);

const proxyDubboServiceMethod =
  (methodName: string, options: DubboProviderOptions) =>
  async (...args) => {
    try {
      const dubbo = Reflect.getMetadata(DUBBO_MODULE_PROVIDER, DubboModule);
      const params = await dubbo.service[options.dubboInterface][methodName](
        ...args,
      );
      // console.log('params', params);
      return params;
    } catch (e) {
      console.log('proxyDubboServiceMethod error', e);
    }
  };

const proxyTransformDubboParams =
  (
    methodName: string,
    methodFn: DubboProviderMethod,
    options: DubboProviderOptions,
  ) =>
  (...args) => {
    try {
      const params = methodFn(...args);
      const config = registry.getConfig(options.dubboInterface, methodName);
      // console.log('config', config);
      const validParams = config.parameterTypes.map((type, index) => {
        const properties = config.types.find(
          (t) => t.type === type,
        )?.properties;
        const param = params[index];
        const value = Object.entries(param).reduce((result, [k, v]) => {
          result[k] = java(properties[k], v);
          return result;
        }, {});
        return java(type, value);
      });
      // console.log('validParams', validParams);
      return validParams;
    } catch (e) {
      console.log('proxyTransformDubboParams error', e);
    }
  };

/**
 * 装饰器标记一个类为 Dubbo [provider](https://docs.nestjs.com/providers).
 * @param options DubboProvider
 */
export const Dubbo = (options: DubboProviderOptions): ClassDecorator => {
  return (target) => {
    const methods = Object.getOwnPropertyNames(target.prototype) // 不能用Object.keys
      .filter((key) => key !== 'constructor') // 过滤掉constructor
      .reduce((methods, key) => {
        const descriptor = Object.getOwnPropertyDescriptor(
          target.prototype,
          key,
        );
        // 代理dubbo service发送前的参数处理
        methods[key] = proxyTransformDubboParams(
          key,
          descriptor.value,
          options,
        );
        // 代理dubbo service方法
        descriptor.value = proxyDubboServiceMethod(key, options);
        // 用代理方法替换原方法供controller使用
        Object.defineProperty(target.prototype, key, descriptor);
        return methods;
      }, {});

    const dubboMetadata: DubboMetadata = Reflect.getMetadata(
      DUBBO_MODULE_METADATA,
      DubboModule,
    ) || {
      services: {},
      settings: {},
    };

    if (dubboMetadata.services[options.dubboInterface]) {
      console.warn(
        `Override ${dubboMetadata.services[options.dubboInterface]} by ${
          target.name
        }`,
      );
    }
    // 生成dubbo代理服务
    dubboMetadata.services[options.dubboInterface] = genDubboService({
      ...options,
      methods,
    });
    dubboMetadata.settings[options.dubboInterface] = options;
    Reflect.defineMetadata(DUBBO_MODULE_METADATA, dubboMetadata, DubboModule);
  };
};
