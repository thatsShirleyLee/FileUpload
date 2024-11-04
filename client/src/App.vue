<script setup lang="ts">
defineOptions({
  name: 'App',
})
import SparkMD5 from 'spark-md5';
import {ref} from 'vue';

let fileName = ref<string>('');
let fileHash = ref<string>('');

// 1MB = 1024KB = 1024 * 1024B (B: 字节 )
const CHUNK_SIZE = 1024 * 1024 * 5; // 5MB
const createChunks = (file: File) => {
  let cur = 0;
  let chunks = [];
  while(cur < file.size) {
    const blob = file.slice(cur, cur + CHUNK_SIZE);
    chunks.push(blob);
    cur += CHUNK_SIZE;
  }
  return chunks;
}

const calculateHash = (chunks: Blob[]) => {
  return new Promise((resolve, reject) => {
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

const uploadChunks = (chunks: Blob[]) => {
  // 每一个分片
  const data = chunks.map((chunk, index) => {
    return {
      fileName: fileName.value,  // 大文件名
      fileHash: fileHash.value,  // 大文件hash
      chunk, // 分片对象
      chunkHash: `${fileHash.value}-${index}`,  // 分片hash
      size: chunk.size
    }
  });
  // FormData数组：将每一个分片转为FormData对象，因为上传文件需要用FormData对象
  const formDatas = data.map((item) => {
    const formData = new FormData();
    // 切片文件
    formData.append('chunk', item.chunk);
    // 分片hash
    formData.append('chunkHash', item.chunkHash);
    // 大文件名字
    formData.append('fileName', item.fileName);
    // 大文件hash
    formData.append('fileHash', item.fileHash);
    return formData;
  });
  let idx = 0;
  const max = 6;  // 浏览器并发线程数（同时最多6个并发请求）
  const taskQueue: any = []  // 请求队列（同时发6个并发请求，如果先完成的1个，会将其他请求补充进队列） 
  while(idx < formDatas.length) {
    const task = fetch('http://127.0.0.1:3000/upload', {
      method: 'POST',
      body: formDatas[idx]
    })
    task.then(() => {
      taskQueue.splice(taskQueue.findIndex((item: any) => item === task));
    })
  }
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
  // 上传分片
  uploadChunks(chunks);
}
</script>

<template>
  <div>
    <h1>大文件上传</h1>
    <input type="file" @change="handleUpload">
  </div>
</template>

<style scoped lang="scss">
  
</style>
