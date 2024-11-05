const express = require('express');
const path = require('path');
const multiparty = require('multiparty');
const fse = require('fs-extra');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
app.use(cors());

// 所有上传的文件都存放到该目录下
const uploadDir = path.resolve(__dirname, 'uploads'); // 当前运行的目录__dirname， 下的uploads文件夹
// 提取文件后缀名函数
const extractExt = (fileName) => {
  return fileName.slice(fileName.lastIndexOf("."), fileName.length);
}
app.post('/upload', (req, res) => {
    const formData = new multiparty.Form();
    formData.parse(req, async (err, fields, files) => {
      // fields: 字段信息， files: 文件信息
      // 上传失败
      if (err) {
        res.status(401).json({
          ok: false,
          msg: "上传失败",
        });
        return;
      }
      // console.log(fields);
      // console.log(files);
      const fileHash = fields["fileHash"][0];
      const chunkHash = fields["chunkHash"][0];
      const chunkOldPath = files["chunk"][0].path; // 系统路径
      // 临时存放目录
      const chunkDir = path.resolve(uploadDir, fileHash); // 以文件hash值创建文件夹
      if (!fse.existsSync(chunkDir)) {
        // 如果不存在该文件夹，则创建
        await fse.mkdir(chunkDir);
      }
      await fse.move(chunkOldPath, path.resolve(chunkDir, chunkHash)); // 将切片移动到chunkDir文件夹下, 并以chunkHash命名切片文件
      // 上传成功
      res.status(200).json({
        ok: true,
        msg: "上传成功",
      });
    })
});  
app.post('/merge', async (req, res) => {
  const { fileName, fileHash, size } = req.body;
  const filePath = path.resolve(uploadDir, fileHash + extractExt(fileName)); // 完整的文件路径包括文件名
  // 如果已经存在该文件，就不需要合并
  if (fse.existsSync(filePath)) {
    res.status(200).json({
      ok: true,
      msg: "文件已存在",
    });
    return;
  }
  // 如果不存在该文件，则进行合并
  const chunkDir = path.resolve(uploadDir, fileHash); // 切片文件夹路径
  if (!fse.existsSync(chunkDir)) { // 检查切片路径是否存在，不存在要求重新上传切片
    res.status(401).json({
      ok: false,
      msg: "合并失败，请重新上传",
    });
    return;
  }
  // 合并操作
  const chunkNames = await fse.readdir(chunkDir); // 获取切片文件夹下的所有切片文件
  // console.log(chunkNames);
  chunkNames.sort((a, b) => a.split("-")[1] - b.split("-")[1]); // 按切片文件名排序
  const writeChunkPromises = chunkNames.map((chunkName, index) => {
    return new Promise((resolve) => {
      const chunkPath = path.resolve(chunkDir, chunkName); // 切片文件路径
      const readStream = fse.createReadStream(chunkPath); // 创建读取流
      readStream.on("end", async () => {
        // 读取流结束，删除切片文件
        await fse.unlink(chunkPath); // 删除切片文件
        resolve();
      });
      const writeStream = fse.createWriteStream(filePath, {
        // flags: index === 0 ? "w" : "a", // 如果是第一个切片，则使用写入模式，否则使用追加模式
        start: index * size, // 从哪个位置开始写入
        end: (index + 1) * size, // 写到哪个位置结束
      });
      readStream.pipe(writeStream); // 将读取流写入到文件中
    })
  });
  await Promise.all(writeChunkPromises); // 等待所有切片文件合并完成
  await fse.remove(chunkDir);  // 合并完成，删除切片文件夹

  res.status(200).json({
    ok: true,
    msg: "合并成功",
  });
})
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

