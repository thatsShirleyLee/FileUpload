// WorkerMessage 的进一步封装, 方便传泛型
import { WorkerMessage } from './WorkerMessage';
export interface WorkerRep<T = any> {
  data: WorkerMessage<T>;
}