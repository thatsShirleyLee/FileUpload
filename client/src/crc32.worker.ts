import { getCrc, getCrcHex } from "./utils/upload-helper";
import { WorkerMessage } from "./utils/WorkerMessage";
import { WorkerLabelsEnum } from "./types/WorkerLabelsEnum";

addEventListener("message", ({ data }: { data: ArrayBuffer }) => {
  const crc = getCrc(data);
  const hash = getCrcHex(crc);

  postMessage(
    new WorkerMessage(WorkerLabelsEnum.DONE, {
      result: hash,
      chunk: data,
    }),
    [data] // 用于 transfer 的数据, 以避免结构化克隆
  );
});
·