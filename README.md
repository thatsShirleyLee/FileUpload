# 大文件上传
## 问题
1. 需要很长时间
2. 一旦出错需要重新上传
3. 服务端对文件大小有限制
   
## 解决
> 分片上传
> 原理：把一个大蛋糕 🎂 切成小块 🍰 一样。首先，我们将要上传的大文件分成许多小块，每个小块大小相等（1MB），然后逐个上传这些小块到服务器。上传的时候，可以同时上传多个小块，也可以一个一个上传。上传每个小块后，服务器会保存这些小块，并记录它们的顺序和位置信息。
![alt text](image.png)

## 好处
1. 减小上传失败的风险 ➡️ 上传中出了问题，只需要重新上传出错的小块
2. 加快上传速度 ➡️ 可以同时上传多个小块，充分利用网络带宽

## 实现
### 搭建
* client：vue3+vite
* server：express框架｜工具包（`multiparty`、`fs-extra`、`cors`、`body-parser`、`nodemon`）
### 读文件
* 监听 `input` 的 `change` 事件：当选取
### 文件分片