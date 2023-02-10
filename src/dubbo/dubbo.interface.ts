import { ModuleMetadata } from '@nestjs/common/interfaces';
import {
  IDubboProps,
  IDubboProvider,
  TDubboCallResult,
} from 'apache-dubbo-consumer/lib/typings/types';

export type DubboProvider = IDubboProvider;
export type DubboProviderCallResult<T> = TDubboCallResult<T>;
export type DubboProviderOptions = Omit<IDubboProvider, 'methods'>;
export type DubboProviderMethod = (...args: any[]) => TDubboCallResult<any>;

export type DubboMetadata = {
  services: Record<string, DubboProviderMethod>;
  settings: Record<string, DubboProviderOptions>;
};

export type DubboModuleOptions = IDubboProps;

export interface DubboModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<DubboModuleOptions> | DubboModuleOptions;
  inject?: any[];
}
