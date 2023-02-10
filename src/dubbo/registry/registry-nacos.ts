/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/ban-types */
import debug from 'debug';
import { util } from 'apache-dubbo-common';
import { NacosConfigClient, NacosNamingClient } from 'nacos';
import BaseRegistry from './registry-base';
import { IRegistry } from './registry';
import {
  INaocsClientProps,
  IRegistryDataConfig,
  TDubboInterface,
  TDubboUrl,
} from './types';

// const path = require('path');
const qs = require('querystring');

// log
const dlog = debug('dubbo:nacos~');

// nacos debug
export class NacosRegistry
  extends BaseRegistry
  implements IRegistry<NacosNamingClient>
{
  // nacos props
  private nacosProps: INaocsClientProps;
  private client: NacosNamingClient;
  private config: NacosConfigClient;

  private readonly readyPromise: Promise<void>;
  private resolve: Function;
  private reject: Function;

  constructor(nacosProps: INaocsClientProps) {
    NacosRegistry.checkProps(nacosProps);
    super();
    dlog(`init nacos with %O`, nacosProps);
    this.nacosProps = nacosProps;
    this.nacosProps.namespace = this.nacosProps.namespace || 'default';

    // init ready promise
    this.readyPromise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });

    // init nacos client
    this.init();
  }

  // ~~~~~~~~~~~~~~~~ private ~~~~~~~~~~~~~~~~~~~~~~~~~~

  // nacos connect
  private async init() {
    // support nacos cluster
    const serverList = this.nacosProps.connect.split(',');
    const namespace = this.nacosProps.namespace || 'public';
    const username = this.nacosProps.username || '';
    const password = this.nacosProps.password || '';
    const logger = this.nacosProps.logger || console;
    dlog(`connecting nacos server ${serverList}`);

    const nacosNamingClientOptions = {
      serverList,
      namespace,
      username,
      password,
      logger,
    };
    this.client = new NacosNamingClient(nacosNamingClientOptions);

    const nacosConfigClientOptions = {
      serverAddr: serverList[0],
      username,
      password,
      // cacheDir: path.join(process.cwd(), '.node-diamond-client-cache'),
    };
    this.config = new NacosConfigClient(nacosConfigClientOptions);

    try {
      await this.client.ready();
      this.resolve();
    } catch (err) {
      this.reject(err);
    }
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  async findDubboServiceUrls(dubboInterfaces: Array<string>) {
    dlog('find dubbo service urls => %O', dubboInterfaces);
    await Promise.all(
      dubboInterfaces.map((dubboInterface) =>
        this.findDubboServiceUrl(dubboInterface),
      ),
    );
  }

  async findDubboServiceUrl(dubboInterface: string) {
    const [, interfaceName] = dubboInterface.split(':');
    this.client.subscribe(dubboInterface, (dubboServiceUrls) => {
      dlog('dubboServiceUrls => %O', dubboServiceUrls);
      const urls = dubboServiceUrls.map((item) => {
        const { ip, port, metadata } = item as any;
        return `beehive://${ip}:${port}/${interfaceName}?${qs.stringify(
          metadata,
        )}`;
      });
      this.dubboServiceUrlMap.set(interfaceName, urls);
      dlog('urls => %O', urls);
      this.emitData(this.dubboServiceUrlMap);

      dubboServiceUrls.forEach((item) => {
        const {
          metadata: { path, version, group, side, application },
        } = item as any;
        const dataId = [path, version, group, side, application].join(':');
        this.config.subscribe(
          {
            dataId,
            group: 'dubbo',
          },
          (content) => {
            let config: IRegistryDataConfig;
            if (typeof content === 'string') {
              try {
                config = JSON.parse(content);
              } catch (e) {
                dlog('content parse err', e, content);
                config = {
                  methods: [],
                  types: [],
                };
              }
            }
            this.dubboServiceConfigMap.set(interfaceName, config);
          },
        );
      });
    });
  }

  // 注册服务提供
  async registerServices(
    services: Array<{
      dubboServiceInterface: TDubboInterface;
      dubboServiceUrl: TDubboUrl;
    }>,
  ) {
    dlog('services => %O', services);
    for (const { dubboServiceInterface, dubboServiceUrl } of services) {
      await this.registerInstance(dubboServiceInterface, dubboServiceUrl);
    }
  }

  // 注册服务消费
  async registerConsumers(
    consumers: Array<{
      dubboServiceInterface: TDubboInterface;
      dubboServiceUrl: TDubboUrl;
    }>,
  ) {
    dlog('consumers => %O', consumers);
    const dubboInterfaces = new Set<string>();
    for (const { dubboServiceInterface, dubboServiceUrl } of consumers) {
      const instance = await this.registerInstance(
        dubboServiceInterface,
        dubboServiceUrl,
      );
      const {
        metadata: { version = '', group = '' },
      } = instance;
      // dubbo的bug，version和group的值反了
      dubboInterfaces.add(
        `providers:${dubboServiceInterface}:${group}:${version}`,
      );
    }
    await this.findDubboServiceUrls([...dubboInterfaces]);
  }

  async registerInstance(
    dubboServiceInterface: string,
    dubboServiceUrl: string,
  ) {
    const metadata: Record<string, any> = {};
    const urlObj = new URL(dubboServiceUrl);
    dlog('urlObj => %O', urlObj);
    const { hostname: ip, port, searchParams } = urlObj;
    for (const key of searchParams.keys()) {
      metadata[key] = searchParams.get(key);
    }
    const instance = {
      ip,
      port: +port || 80,
      metadata,
    };
    await this.client.registerInstance(dubboServiceInterface, instance);
    return instance;
  }

  close(): void {
    (this.client as any)?.close();
  }

  getClient() {
    return this.client;
  }

  getConfig(dubboServiceInterface: string, method: string) {
    const config = this.dubboServiceConfigMap.get(dubboServiceInterface);
    const { methods = [], types = [] } = config || {};
    const methodConfig = methods.find((m) => m.name === method);
    return {
      ...methodConfig,
      types,
    };
  }

  /**
   * check nacos prop
   * @param props
   */
  private static checkProps(props: INaocsClientProps) {
    if (!props.connect) {
      throw new Error(`Please specify nacos props, connect is required`);
    }
    if (!util.isString(props.connect)) {
      throw new Error(`Please specify nacos props, connect should be a string`);
    }
    if (props.namespace && !util.isString(props.namespace)) {
      throw new Error(
        `Please specify nacos props, namespace should be a string`,
      );
    }
    if (!props.logger) {
      throw new Error(`Please specify nacos props, logger is required`);
    }
  }
}

export function Nacos(props: INaocsClientProps) {
  return new NacosRegistry(props);
}
