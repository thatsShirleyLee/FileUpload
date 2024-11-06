// 用于 Worker 线程向主线程通信
import { WorkerLabelsEnum } from "../types/WorkerLabelsEnum";

export class WorkerMessage<T = any> {
  label: WorkerLabelsEnum;
  content?: T;

  constructor(label: WorkerLabelsEnum, content?: T) {
    this.label = label;
    this.content = content;
  }
}
