# Orbit 个人工作台

本地优先的个人产品经理工作台，包含 AI 工作台、待办、瞬记和 Markdown 知识库。

## 在新电脑运行

```bash
git clone https://github.com/DonnTang/Donn-dashboard.git
cd Donn-dashboard
npm install
npm run dev
```

打开终端显示的本地地址即可使用。

## 迁移本地数据

数据保存在浏览器 IndexedDB，不会自动随 Git 同步：

1. 在原电脑进入“知识文档”，点击“导出本地备份”。
2. 在新电脑启动工作台后，进入同一页面，点击“恢复备份”并选择 JSON 文件。

备份包含待办、AI 消息、用量、瞬记和知识文档。恢复会覆盖新电脑当前的本地数据。
