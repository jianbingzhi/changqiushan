import { EventEmitter } from "node:events";

// 进程内事件总线 — pg-listen 收到 NOTIFY 后推到这里
// SSE Route Handler 订阅相应 topic 把消息流给浏览器

class RealtimeBus extends EventEmitter {
  publish(topic: string, payload: unknown) {
    this.emit(topic, payload);
  }
}

const globalForBus = globalThis as unknown as { __realtimeBus?: RealtimeBus };
export const bus = globalForBus.__realtimeBus ?? new RealtimeBus();
bus.setMaxListeners(0); // 不限制 SSE 客户端数量

if (process.env.NODE_ENV !== "production") globalForBus.__realtimeBus = bus;
