<script setup lang="ts">
defineOptions({
  name: 'App',
})
import SparkMD5 from 'spark-md5';
import {ref} from 'vue';

let fileName = ref<string>('');
let fileHash = ref<string>('');
let persentage = ref<number>(0);
// 节流：控制上传进度
let lastUpdate = 0;
const delay = 100;  // 100ms 更新一次
const updatePersentage = (idx: any, length: any) => {
  const now = Date.now();
  if(now - lastUpdate < delay) return;
  const newPersentage = parseInt(((idx / length) * 100).toFixed(0));
  persentage.value = newPersentage;
  lastUpdate = now;
}

// 1MB = 1024KB = 1024 * 1024B (B: 字节 )
const CHUNK_SIZE = 1024 * 1024 * 5; // 5MB
const createChunks = (file: File): Blob[] => {
  let cur = 0;
  let chunks: Blob[] = [];
  while(cur < file.size) {
    chunks.push(file.slice(cur, cur + CHUNK_SIZE));
    cur += CHUNK_SIZE;
  }
  return chunks;
}

const calculateHash = (chunks: Blob[]) => {
  return new Promise((resolve) => {
    // 1. 头和尾 chunk 文件全部内容 =》hash
    // 2. 其余 chunk，取头部两字节+中间两字节+尾部两字节的内容 =》hash
    const targets: Blob[] = []; // 存储所有参与计算的切片
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();
    chunks.forEach((chunk, index) => {
      if(index === 0 || index === chunks.length - 1) {
        // 第一个和最后一个切片全部参与计算
        targets.push(chunk);
      } else {
        // 其余切片，取头部两字节+中间两字节+尾部两字节的内容
        targets.push(chunk.slice(0, 2));
        targets.push(chunk.slice(CHUNK_SIZE/2, CHUNK_SIZE/2 + 2));
        targets.push(chunk.slice(-2));
      }
    })
    fileReader.onload = (e) => {  // 异步：读取完成后才调用
      spark.append(e.target?.result as ArrayBuffer);
      const hash = spark.end();
      resolve(hash);
    }
    fileReader.readAsArrayBuffer(new Blob(targets));
  });
}

/* 增量计算hash值(解决内存爆炸问题，但不能节省计算hash的时间)
Blob做分片非常快速的原因在于，只存储了文件的基本信息，type、size等，分片时并没有真正使用文本数据。而计算hash值要根据文本数据来计算，对于大文件来说，读取其全部的文本数据到内存是极大的开销，会撑爆内存，所以考虑使用增量计算的方式。【即先用一块文本数据去计算出一个结果，计算完后丢掉，再把结果和下一块文本数据一起去计算下一个结果...】
*/
/* const computeHash = (chunks: Blob[]) => {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5();
    function _read(i: number){
      if(i >= chunks.length) {
        const hash = spark.end();
        resolve(hash);
      }
      const blob = chunks[i];
      const reader =  new FileReader();
      reader.onload = (e) => {
        const bytes = e.target?.result as ArrayBuffer; // 读取到的字节数组
        spark.append(bytes);
        _read(i + 1);
      }
      reader.readAsArrayBuffer(blob);
    }
    _read(0);
  })
} */

const mergeReq = () => {
  fetch('http://127.0.0.1:3000/merge', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      fileName: fileName.value,
      fileHash: fileHash.value,
      size: CHUNK_SIZE
    })
  }).then(res => {
    if(!res.ok) {
      return res.json().then( err => {throw new Error(err.msg)} );
    }
  })
  .then(() => {
    alert('合并成功');
  })
  .catch(err => {
    alert(err.message);
  })
}

const uploadChunks = async (chunks: Blob[], existChunks: string[]) => {
  // 所有分片构成的数组
  const data = chunks.map((chunk, index) => {
    return {
      fileName: fileName.value,  // 大文件名
      fileHash: fileHash.value,  // 大文件hash
      chunk, // 分片对象
      chunkHash: `${fileHash.value}-${index}`,  // 分片hash
    }
  });
  // FormData数组：将每一个分片转为FormData对象，因为上传文件需要用FormData对象
  /* 过滤掉已经上传的chunk，再对每一个chunk转为FormData */
  const formDatas = data.filter(item => !existChunks.includes(item.chunkHash)).map(item => {
    const formData = new FormData();
    // formData.append('fileName', item.fileName);  // 大文件名字
    formData.append('fileHash', item.fileHash);  // 大文件hash
    formData.append('chunk', item.chunk); // 分片对象
    formData.append('chunkHash', item.chunkHash);  // 分片hash
    return formData;
  });
  const max = 6;  // 浏览器并发线程数（同时最多6个并发请求）
  let idx = 0; // 当前上传到第几个
  const taskQueue: any = []  // 请求队列（同时发6个并发请求，如果先完成的1个，会将其他请求补充进队列） 
  while(idx < formDatas.length) {
    const task = fetch('http://127.0.0.1:3000/upload', {  // 分片任务
      method: 'POST',
      body: formDatas[idx]
    })
    task.then(() => {  // 请求完成后从队列中移除
      taskQueue.splice(taskQueue.findIndex((item: any) => item === task));
    })
    taskQueue.push(task); // 放入请求队列
    if(taskQueue.length === max) {  // 请求队列达到最大并发数，等待
      await Promise.race(taskQueue); // 等待最先完成的请求
    }
    idx++;
    updatePersentage(idx, formDatas.length); // 更新进度条
  }
  await Promise.all(taskQueue); // 等待所有请求完成
  persentage.value = 100; // 进度条完成
  // 通知服务器合并文件
  mergeReq();
}

const verifyHashAndChunk = () => {
  return fetch('http://127.0.0.1:3000/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      fileName: fileName.value,
      fileHash: fileHash.value
    })
  }).then(res => res.json())
  .then(res => {
    return res;
  })
}

const handleUpload = async (e: Event) => {
  const files = (e.target as HTMLInputElement).files; // 伪数组，每一个元素是File对象，File对象继承自Blob
  if(!files) return;
  // 读文件
  fileName.value = files[0].name;
  console.log('读取的文件', files[0]);
  // 文件分片
  const chunks = createChunks(files[0]);
  console.log('文件分片', chunks);
  // hash计算
  const hash = await calculateHash(chunks);
  fileHash.value = hash;
  // const hash = await computeHash(chunks); // 增量计算
  console.log('文件hash值', fileHash.value);
  // 校验hash（有这个文件就不上传了，实现秒传）
  const responseData = await verifyHashAndChunk();
  if (!responseData.data.shouldUpload) {
    alert('秒传成功');
    return;
  }
  // 上传分片
  uploadChunks(chunks, responseData.data.existChunks);
}
</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <input type="file" @change="handleUpload">
    <input type="range" :value="persentage" min="0" max="100" step="1" disabled><span>{{persentage}}</span>
  </div>
</template>

<style scoped lang="scss">
  
</style>
