/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import debug from 'debug';
import {
  IRegistryDataConfig,
  IRegistrySubscriber,
  TDubboInterface,
  TDubboUrl,
} from './types';

const log = debug('registry:base~');

/**
 * Extract the base class of the registry
 */
export default class BaseRegistry {
  protected readonly subscribers: Set<IRegistrySubscriber>;
  protected readonly dubboServiceUrlMap: Map<TDubboInterface, Array<TDubboUrl>>;
  protected readonly dubboServiceConfigMap: Map<
    TDubboInterface,
    IRegistryDataConfig
  >;

  constructor() {
    // Save the mapping relationship between the dubbo interface and the service URL
    this.dubboServiceUrlMap = new Map();
    this.dubboServiceConfigMap = new Map();
    this.subscribers = new Set();
  }

  subscribe(subscriber: IRegistrySubscriber) {
    this.subscribers.add(subscriber);
    return this;
  }

  unsubscribe(subscriber: IRegistrySubscriber) {
    this.subscribers.delete(subscriber);
  }

  emitData(map: Map<TDubboInterface, Array<TDubboUrl>>) {
    log('emit data => %O', map);
    this.subscribers.forEach((s) => s.onData(map));
  }

  emitErr(err: Error) {
    log('emit error %s', err);
    this.subscribers.forEach((s) => s.onError(err));
  }
}
